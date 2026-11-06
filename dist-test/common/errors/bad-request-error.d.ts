import { CustomError } from "./custom-error";
export declare class BadRequestError extends CustomError {
    message: string;
    details?: Record<string, any> | undefined;
    statusCode: number;
    constructor(message: string, details?: Record<string, any> | undefined);
    serializeErrors(): {
        details?: Record<string, any> | undefined;
        message: string;
    }[];
}
//# sourceMappingURL=bad-request-error.d.ts.map