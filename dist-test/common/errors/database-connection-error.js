"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseConnectionError = void 0;
const custom_error_1 = require("./custom-error");
class DatabaseConnectionError extends custom_error_1.CustomError {
    constructor() {
        super('Error connecting to database');
        this.statusCode = 500;
        this.reason = 'Error connecting to database';
        // Only because we are extending a built in class
        Object.setPrototypeOf(this, DatabaseConnectionError.prototype);
    }
    serializeErrors() {
        return [
            { message: this.reason }
        ];
    }
}
exports.DatabaseConnectionError = DatabaseConnectionError;
//# sourceMappingURL=database-connection-error.js.map