import nats from 'node-nats-streaming';
export declare class NatsWrapper {
    private _client?;
    private _isConnected;
    private _reconnectInterval;
    private _reconnectAttempts;
    private _maxReconnectAttempts;
    get client(): nats.Stan;
    get isConnected(): boolean;
    connect(clusterId: string, clientId: string, url: string): Promise<void>;
    private attemptReconnect;
    /**
     * Request-Reply pattern implementasyonu
     * Stan üzerinde doğrudan request metodu olmadığı için manuel olarak implemente ediyoruz
     */
    request<T = any>(subject: string, data: any, options?: {
        timeout?: number;
        max?: number;
    }): Promise<T>;
}
export declare const createNatsWrapper: () => NatsWrapper;
//# sourceMappingURL=natsWrapper.service.d.ts.map