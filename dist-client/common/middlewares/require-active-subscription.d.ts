import { Request, Response, NextFunction } from 'express';
interface RequireActiveSubscriptionOptions {
    allowRead?: boolean;
}
export declare const requireActiveSubscription: (options?: RequireActiveSubscriptionOptions) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export {};
