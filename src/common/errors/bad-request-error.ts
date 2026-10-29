import { CustomError } from "./custom-error";

export class BadRequestError extends CustomError {
    statusCode = 400;

    constructor(public message: string, public details?: Record<string, any>) {
        super(message);

        Object.setPrototypeOf(this, BadRequestError.prototype);
    }

    serializeErrors(){
        return [{ message: this.message, ...(this.details ? { details: this.details } : {}) }];
    }
}
