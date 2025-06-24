import { RedisClientType } from 'redis';
declare class RedisWrapper {
    private static instances;
    private _client?;
    private _url?;
    get client(): RedisClientType;
    connect(url: string): Promise<void>;
    deleteOrder(userId: string, purchaseNumber: string, platformNumber: string): Promise<boolean>;
    setOrder(userId: string, purchaseNumber: string, platformNumber: string, orderData: any): Promise<void>;
    getOrder(userId: string, purchaseNumber: string, platformNumber: string): Promise<{
        [x: string]: string;
    } | null>;
    updateOrderStatus(userId: string, purchaseNumber: string, platformNumber: string, status: string): Promise<void>;
    deleteCredentials(userId: string, platform: string): Promise<void>;
    setCredentials(userId: string, platform: string, credentials: any): Promise<void>;
    getCredentials(userId: string, platform: string): Promise<{
        [x: string]: string;
    } | null>;
    updateCredentials(userId: string, platform: string, credentials: any): Promise<void>;
    eval(script: string, params: {
        keys: string[];
        arguments: string[];
    }): Promise<any>;
    setNX(key: string, value: string, expireSeconds: number): Promise<boolean>;
    disconnect(): Promise<void>;
    getConnectionStats(): {
        totalInstances: number;
        currentUrl: string | undefined;
        isConnected: boolean;
    };
    getActiveConnections(): number;
    static getInstanceUrls(): string[];
}
export declare const redisWrapper: RedisWrapper;
export {};
//# sourceMappingURL=redisWrapper.service.d.ts.map