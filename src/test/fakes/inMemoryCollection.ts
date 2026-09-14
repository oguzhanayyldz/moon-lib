/**
 * In-memory stand-in for the mongoose model methods that EventPublisherJob and
 * DeadLetterProcessorJob call (issue #648).
 *
 * Filters follow MongoDB matching rules for the operators those jobs use:
 * a comparison on a missing field does not match, `null` matches a missing field,
 * ObjectId and Date values are compared by value. Unsupported operators throw.
 * `$expr` supports a single comparison of field paths / literals, e.g. `{ $lt: ['$retryCount', '$maxRetries'] }`.
 */

type Doc = Record<string, any>;
type Filter = Record<string, any>;
type Update = Record<string, any>;
type SortSpec = Record<string, 1 | -1>;

const FIELD_OPERATORS = new Set(['$lt', '$lte', '$gt', '$gte', '$ne', '$in', '$nin', '$exists']);
const EXPRESSION_COMPARISONS = new Set(['$lt', '$lte', '$gt', '$gte']);
const UPDATE_OPERATORS = new Set(['$set', '$inc', '$unset']);

function normalize(value: any): any {
    if (value instanceof Date) return value.getTime();
    if (value && typeof value === 'object' && typeof value.toHexString === 'function') return value.toHexString();
    return value;
}

function valuesEqual(actual: any, expected: any): boolean {
    if (expected === null) return actual === null || actual === undefined;
    return normalize(actual) === normalize(expected);
}

function isOperatorObject(value: any): boolean {
    return value !== null
        && typeof value === 'object'
        && !(value instanceof Date)
        && typeof value.toHexString !== 'function'
        && Object.keys(value).some(key => key.startsWith('$'));
}

function compare(actual: any, expected: any, operator: string): boolean {
    if (actual === undefined || actual === null) return false;
    const a = normalize(actual);
    const b = normalize(expected);
    switch (operator) {
        case '$lt': return a < b;
        case '$lte': return a <= b;
        case '$gt': return a > b;
        default: return a >= b;
    }
}

function matchField(actual: any, condition: any): boolean {
    if (!isOperatorObject(condition)) {
        return valuesEqual(actual, condition);
    }
    return Object.entries(condition).every(([operator, expected]) => {
        if (!FIELD_OPERATORS.has(operator)) {
            throw new Error(`InMemoryCollection: unsupported query operator ${operator}`);
        }
        switch (operator) {
            case '$ne': return !valuesEqual(actual, expected);
            case '$in': return (expected as any[]).some(item => valuesEqual(actual, item));
            case '$nin': return !(expected as any[]).some(item => valuesEqual(actual, item));
            case '$exists': return (actual !== undefined) === expected;
            default: return compare(actual, expected, operator);
        }
    });
}

function resolveOperand(doc: Doc, operand: any): any {
    return typeof operand === 'string' && operand.startsWith('$') ? doc[operand.slice(1)] : operand;
}

/** Aggregation comparison: unlike a query filter, a missing or null value sorts below any other value. */
function matchesExpression(doc: Doc, expression: Filter): boolean {
    const entries = Object.entries(expression);
    const [operator, operands] = entries[0] ?? [];
    if (entries.length !== 1 || !EXPRESSION_COMPARISONS.has(operator) || !Array.isArray(operands) || operands.length !== 2) {
        throw new Error(`InMemoryCollection: unsupported $expr ${JSON.stringify(expression)}`);
    }
    const [left, right] = operands.map(operand => resolveOperand(doc, operand));
    const leftMissing = left === undefined || left === null;
    const rightMissing = right === undefined || right === null;
    if (leftMissing || rightMissing) {
        const order = Number(!leftMissing) - Number(!rightMissing);
        switch (operator) {
            case '$lt': return order < 0;
            case '$lte': return order <= 0;
            case '$gt': return order > 0;
            default: return order >= 0;
        }
    }
    return compare(left, right, operator);
}

export function matchesFilter(doc: Doc, filter: Filter): boolean {
    return Object.entries(filter).every(([key, condition]) => {
        if (key === '$or') return (condition as Filter[]).some(sub => matchesFilter(doc, sub));
        if (key === '$and') return (condition as Filter[]).every(sub => matchesFilter(doc, sub));
        if (key === '$expr') return matchesExpression(doc, condition);
        if (key.startsWith('$')) {
            throw new Error(`InMemoryCollection: unsupported top-level operator ${key}`);
        }
        return matchField(doc[key], condition);
    });
}

function applyUpdate(doc: Doc, update: Update): void {
    for (const [operator, fields] of Object.entries(update)) {
        if (!UPDATE_OPERATORS.has(operator)) {
            throw new Error(`InMemoryCollection: unsupported update operator ${operator}`);
        }
        for (const [field, value] of Object.entries(fields as Doc)) {
            if (operator === '$set') doc[field] = value;
            if (operator === '$inc') doc[field] = (doc[field] ?? 0) + (value as number);
            if (operator === '$unset') delete doc[field];
        }
    }
}

function sortDocs(docs: Doc[], spec: SortSpec): Doc[] {
    return [...docs].sort((left, right) => {
        for (const [field, direction] of Object.entries(spec)) {
            const a = normalize(left[field]);
            const b = normalize(right[field]);
            if (a === b) continue;
            if (a === undefined || a === null) return -direction;
            if (b === undefined || b === null) return direction;
            return a < b ? -direction : direction;
        }
        return 0;
    });
}

class InMemoryQuery implements PromiseLike<Doc[]> {
    private sortSpec: SortSpec | null = null;
    private limitCount: number | null = null;

    constructor (private readonly source: () => Doc[]) { }

    sort(spec: SortSpec): this {
        this.sortSpec = spec;
        return this;
    }

    limit(count: number): this {
        this.limitCount = count;
        return this;
    }

    lean(): this {
        return this;
    }

    exec(): Promise<Doc[]> {
        let docs = this.source();
        if (this.sortSpec) docs = sortDocs(docs, this.sortSpec);
        if (this.limitCount !== null) docs = docs.slice(0, this.limitCount);
        return Promise.resolve(docs.map(doc => ({ ...doc })));
    }

    then<R1 = Doc[], R2 = never>(
        onFulfilled?: ((value: Doc[]) => R1 | PromiseLike<R1>) | null,
        onRejected?: ((reason: any) => R2 | PromiseLike<R2>) | null
    ): PromiseLike<R1 | R2> {
        return this.exec().then(onFulfilled, onRejected);
    }
}

export class InMemoryCollection {
    readonly docs: Doc[] = [];

    insert(doc: Doc): Doc {
        const stored = { ...doc };
        if (stored._id !== undefined && stored.id === undefined) {
            stored.id = String(normalize(stored._id));
        }
        this.docs.push(stored);
        return stored;
    }

    find(filter: Filter): InMemoryQuery {
        return new InMemoryQuery(() => this.docs.filter(doc => matchesFilter(doc, filter)));
    }

    async distinct(field: string, filter: Filter): Promise<any[]> {
        const values = this.docs.filter(doc => matchesFilter(doc, filter)).map(doc => doc[field]);
        return [...new Set(values)];
    }

    async countDocuments(filter: Filter): Promise<number> {
        return this.docs.filter(doc => matchesFilter(doc, filter)).length;
    }

    async updateOne(filter: Filter, update: Update): Promise<{ matchedCount: number; modifiedCount: number }> {
        const doc = this.docs.find(candidate => matchesFilter(candidate, filter));
        if (!doc) return { matchedCount: 0, modifiedCount: 0 };
        applyUpdate(doc, update);
        return { matchedCount: 1, modifiedCount: 1 };
    }

    async updateMany(filter: Filter, update: Update): Promise<{ matchedCount: number; modifiedCount: number }> {
        const matched = this.docs.filter(doc => matchesFilter(doc, filter));
        matched.forEach(doc => applyUpdate(doc, update));
        return { matchedCount: matched.length, modifiedCount: matched.length };
    }

    async findOneAndUpdate(
        filter: Filter,
        update: Update,
        options: { sort?: SortSpec; new?: boolean } = {}
    ): Promise<Doc | null> {
        const candidates = this.docs.filter(doc => matchesFilter(doc, filter));
        const [doc] = options.sort ? sortDocs(candidates, options.sort) : candidates;
        if (!doc) return null;
        const before = { ...doc };
        applyUpdate(doc, update);
        return options.new ? { ...doc } : before;
    }
}
