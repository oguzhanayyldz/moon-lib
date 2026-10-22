import nats, { Stan, Subscription } from 'node-nats-streaming';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.service';
import { sanitizeConnectionError, toSafeError } from '../utils/logSafety.util';

export class NatsWrapper {
    private _client?: Stan;
    private _isConnected: boolean = false;
    private _closing: boolean = false;
    private _connectionLostCallbacks: Array<() => void> = [];

    get client() {
        if (!this._client) {
            throw new Error("Cannot access NATS client before connecting");
        }
        return this._client;
    }

    get isConnected(): boolean {
        return this._isConnected;
    }

    /**
     * Kalıcı bağlantı kaybında (kapanış dışındaki Stan 'close') bir kez çağrılır.
     * Kısa kopmaları nats.js AYNI istemciyle kendisi toparlar ('disconnect' → 'reconnect').
     * Stan 'close' ise istemcinin kalıcı öldüğü anlamına gelir: dinleyiciler, EventPublisherJob ve istemciyi
     * değer olarak tutan her şey ölüdür. Servis bu durumda süreci kapatmalı, k8s yeniden başlatır.
     */
    onConnectionLost(callback: () => void): void {
        this._connectionLostCallbacks.push(callback);
    }

    /**
     * Kapanışta istemciyi kapatır; bu yoldan gelen 'close' onConnectionLost'u tetiklemez.
     */
    close(): void {
        this._closing = true;
        this._client?.close();
    }

    async connect(clusterId: string, clientId: string, url: string) {
        let client: Stan;
        try {
            client = nats.connect(clusterId, clientId, { url });
        } catch (error) {
            // An invalid URL error (ERR_INVALID_URL) carries the address in `input`; never log the raw error.
            const safeError = sanitizeConnectionError(error);
            logger.error('Failed to connect to NATS:', safeError);
            throw toSafeError(safeError);
        }
        this._client = client;
        this._closing = false;
        let connectedOnce = false;
        let connectionLostNotified = false;

        client.on('disconnect', () => {
            // nats.js reconnects this same client by itself (stan maxReconnectAttempts=-1); never open a second client here.
            logger.info('Disconnected from NATS');
            this._isConnected = false;
        });

        client.on('reconnect', () => {
            logger.info('Reconnected to NATS (same client)');
            this._isConnected = true;
        });

        client.on('close', () => {
            this._isConnected = false;
            // Stan can emit 'close' twice (closeWithError and the underlying nats close); notify once.
            if (!connectedOnce || this._closing || connectionLostNotified) {
                return;
            }
            connectionLostNotified = true;
            logger.error('NATS connection lost permanently (client closed)');
            this._connectionLostCallbacks.forEach((callback) => callback());
        });

        return new Promise<void>((resolve, reject) => {
            client.on('connect', () => {
                logger.info('Connected to NATS');
                connectedOnce = true;
                this._isConnected = true;
                resolve();
            });
            client.on('error', (err) => {
                // The raw error carries the address (ERR_INVALID_URL etc.); never reject with or log it directly.
                const safeError = sanitizeConnectionError(err);
                if (connectedOnce) {
                    logger.error('NATS client error:', safeError);
                    return;
                }
                reject(toSafeError(safeError));
            });
        });
    }

    /**
     * Request-Reply pattern implementasyonu
     * Stan üzerinde doğrudan request metodu olmadığı için manuel olarak implemente ediyoruz
     */
    async request<T = any>(subject: string, data: any, options: { timeout?: number; max?: number } = {}): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const replyTo = `${subject}.reply.${uuidv4()}`;
            const timeout = options.timeout || 10000;
            
            // NATS streaming için subscription
            let subscription: Subscription;
            
            // Basit subscribe ile çalış, manuel olarak unsubscribe yap
            subscription = this.client.subscribe(replyTo);
            
            // Timeout işlemi
            const timeoutId = setTimeout(() => {
                subscription.unsubscribe();
                reject(new Error(`Request timeout after ${timeout}ms for ${subject}`));
            }, timeout);
            
            // Mesaj alındığında
            subscription.on('message', (msg) => {
                clearTimeout(timeoutId);
                
                // Beklenilen cevap geldiğinde manuel unsubscribe
                subscription.unsubscribe();
                
                try {
                    const response = JSON.parse(msg.getData().toString());
                    resolve(response);
                } catch (err) {
                    reject(err);
                }
            });
            
            // İsteği yayınla
            this.client.publish(subject, JSON.stringify({
                ...data,
                replyTo
            }));
        });
    }
}

/** Core NATS inbox öneki; replyTo bununla başlıyorsa istekçi yanıtı core NATS'te bekliyor demektir. */
export const CORE_REPLY_PREFIX = '_INBOX.';

// node-nats-streaming 0.3.x'in altındaki nats 1.x bağlantısı (Stan#nc); tiplerde yer almadığı için daraltılmış arayüz.
interface CoreNatsConnection {
    publish(subject: string, data: Buffer): void;
}

const coreConnection = (client: Stan): CoreNatsConnection => {
    const nc = (client as unknown as { nc?: CoreNatsConnection }).nc;
    if (!nc) {
        throw new Error('NATS core connection is not available');
    }
    return nc;
};

/**
 * request() ile gelen komutun yanıtını gönderir.
 * Core NATS inbox'ında (`_INBOX.`) bekleyen istekçiye core NATS'ten, eski biçimdeki istekçiye
 * (`<subject>.reply.<uuid>`) STAN kanalından yanıt verir. Yanıtlayanlar istekçilerden önce bu sürüme
 * geçer (UC-950 Faz 1); istekçiler core inbox'a ancak tüm yanıtlayanlar canlıda güncellendikten sonra geçer (Faz 2).
 */
export const publishReply = (client: Stan, replyTo: string, data: string): void => {
    if (replyTo.startsWith(CORE_REPLY_PREFIX)) {
        coreConnection(client).publish(replyTo, Buffer.from(data, 'utf8'));
        return;
    }
    client.publish(replyTo, data);
};

export const createNatsWrapper = () => new NatsWrapper();