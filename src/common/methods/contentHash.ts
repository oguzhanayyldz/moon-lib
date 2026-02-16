import crypto from 'crypto';

/**
 * Brand verisinin content hash'ini hesaplar.
 * Delta sync için kullanılır - hash değişmemişse veri değişmemiştir.
 */
export function calculateBrandContentHash(data: {
    name: string;
    code?: string;
    metadata?: Record<string, any>;
}): string {
    const hashInput = JSON.stringify({
        name: data.name,
        code: data.code || '',
        // metadata'yı sıralı key'lerle serialize et (deterministik hash için)
        metadata: data.metadata ? sortObject(data.metadata) : {}
    });
    return crypto.createHash('md5').update(hashInput).digest('hex');
}

/**
 * Category verisinin content hash'ini hesaplar.
 * Delta sync için kullanılır - hash değişmemişse veri değişmemiştir.
 */
export function calculateCategoryContentHash(data: {
    name: string;
    parentId?: string;
    level?: number;
    isLeaf?: boolean;
    metadata?: Record<string, any>;
}): string {
    const hashInput = JSON.stringify({
        name: data.name,
        parentId: data.parentId || '',
        level: data.level ?? 0,
        isLeaf: data.isLeaf ?? false,
        // metadata'dan sadece önemli alanları al
        path: data.metadata?.path || '',
        displayOrder: data.metadata?.displayOrder ?? 0
    });
    return crypto.createHash('md5').update(hashInput).digest('hex');
}

/**
 * Object'i key'lere göre sıralar (deterministik JSON stringify için).
 * Nested object'ler için recursive çalışır.
 */
function sortObject(obj: Record<string, any>): Record<string, any> {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sortObject(item));
    }

    const sorted: Record<string, any> = {};
    const keys = Object.keys(obj).sort();

    for (const key of keys) {
        sorted[key] = sortObject(obj[key]);
    }

    return sorted;
}
