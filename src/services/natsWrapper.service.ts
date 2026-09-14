import nats, { Stan, Subscription } from 'node-nats-streaming';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.service';
import { sanitizeConnectionError, toSafeError } from '../utils/logSafety.util';

export class NatsWrapper {
    private _client?: Stan;
    private _isConnected: boolean = false;
    private _reconnectInterval: number = 5000;
    private _reconnectAttempts: number = 0;
    private _maxReconnectAttempts: number = 10;

    get client() {
        if (!this._client) {
            throw new Error("Cannot access NATS client before connecting");
        }
        return this._client;
    }

    get isConnected(): boolean {
        return this._isConnected;
    }

    async connect(clusterId: string, clientId: string, url: string) {
        try {
            this._client = nats.connect(clusterId, clientId, { url });

            this._client.on('connect', () => {
                logger.info('Connected to NATS');
                this._isConnected = true;
                this._reconnectAttempts = 0; // Reset reconnection attempts on successful connection
            });

            this._client.on('disconnect', () => {
                logger.info('Disconnected from NATS');
                this._isConnected = false;
                this.attemptReconnect(clusterId, clientId, url);
            });

            return new Promise<void>((resolve, reject) => {
                this.client!.on('connect', () => resolve());
                // The raw error carries the address (ERR_INVALID_URL etc.); never reject with it directly.
                this.client!.on('error', (err) => reject(toSafeError(sanitizeConnectionError(err))));
            });
        } catch (error) {
            // An invalid URL error (ERR_INVALID_URL) carries the address in `input`; never log the raw error.
            logger.error('Failed to connect to NATS:', sanitizeConnectionError(error));
            this.attemptReconnect(clusterId, clientId, url);
        }
    }

    private attemptReconnect(clusterId: string, clientId: string, url: string) {
        // Check if max reconnection attempts reached
        if (this._reconnectAttempts >= this._maxReconnectAttempts) {
            logger.error(`❌ Max reconnect attempts (${this._maxReconnectAttempts}) reached. Stopping reconnection.`);
            logger.error('⚠️ Service may be degraded. Please check NATS server status.');
            return;
        }

        this._reconnectAttempts++;

        // Exponential backoff: increase delay with each attempt (max 30 seconds)
        const backoffTime = Math.min(this._reconnectInterval * this._reconnectAttempts, 30000);

        setTimeout(() => {
            logger.info(`🔄 Attempting to reconnect to NATS (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})...`);
            this.connect(clusterId, clientId, url)
                .then(() => {
                    logger.info('✅ NATS reconnection successful');
                })
                .catch(err => {
                    logger.error(`❌ Reconnect attempt ${this._reconnectAttempts} failed:`, sanitizeConnectionError(err));
                    // attemptReconnect will be called again from connect() error handler if needed
                });
        }, backoffTime);
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

export const createNatsWrapper = () => new NatsWrapper();