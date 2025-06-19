import { CustomError } from "./custom-error";
export declare class NotAuthorizedError extends CustomError {
    statusCode: number;
    constructor();
    serializeErrors(): {
        message: string;
    }[];
}
//# sourceMappingURL=not-authorized-error.d.ts.map