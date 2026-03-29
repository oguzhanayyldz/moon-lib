import { Request, Response, NextFunction } from 'express';
import { Schema } from 'express-validator';
export declare const validateBody: (schema: Schema) => (req: Request, res: Response, next: NextFunction) => void;
