"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BadRequestError = void 0;
const custom_error_1 = require("./custom-error");
class BadRequestError extends custom_error_1.CustomError {
    constructor(message, details) {
        super(message);
        this.message = message;
        this.details = details;
        this.statusCode = 400;
        Object.setPrototypeOf(this, BadRequestError.prototype);
    }
    serializeErrors() {
        return [Object.assign({ message: this.message }, (this.details ? { details: this.details } : {}))];
    }
}
exports.BadRequestError = BadRequestError;
