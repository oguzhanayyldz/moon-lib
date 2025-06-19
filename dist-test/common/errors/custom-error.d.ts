export declare abstract class CustomError extends Error {
    abstract statusCode: number;
    constructor(message: string);
    abstract serializeErrors(): {
        message: string;
        field?: string;
    }[];
}
//# sourceMappingURL=custom-error.d.ts.map