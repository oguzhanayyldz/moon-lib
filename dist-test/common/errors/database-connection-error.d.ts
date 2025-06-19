import { CustomError } from "./custom-error";
export declare class DatabaseConnectionError extends CustomError {
    statusCode: number;
    reason: string;
    constructor();
    serializeErrors(): {
        message: string;
    }[];
}
//# sourceMappingURL=database-connection-error.d.ts.map