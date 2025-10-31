import { CustomError } from "./custom-error";
export declare class NotAuthorizedError extends CustomError {
    message: string;
    statusCode: number;
    constructor(message?: string);
    serializeErrors(): {
        message: string;
    }[];
}
//# sourceMappingURL=not-authorized-error.d.ts.map