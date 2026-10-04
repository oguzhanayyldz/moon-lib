import nats from 'node-nats-streaming';
export declare class NatsWrapper {
    private _client?;
    private _isConnected;
    private _closing;
    private _connectionLostCallbacks;
    get client(): nats.Stan;
    get isConnected(): boolean;
    /**
     * Kalıcı bağlantı kaybında (kapanış dışındaki Stan 'close') bir kez çağrılır.
     * Kısa kopmaları nats.js AYNI istemciyle kendisi toparlar ('disconnect' → 'reconnect').
     * Stan 'close' ise istemcinin kalıcı öldüğü anlamına gelir: dinleyiciler, EventPublisherJob ve istemciyi
     * değer olarak tutan her şey ölüdür. Servis bu durumda süreci kapatmalı, k8s yeniden başlatır.
     */
    onConnectionLost(callback: () => void): void;
    /**
     * Kapanışta istemciyi kapatır; bu yoldan gelen 'close' onConnectionLost'u tetiklemez.
     */
    close(): void;
    connect(clusterId: string, clientId: string, url: string): Promise<void>;
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
