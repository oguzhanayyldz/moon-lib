import nats, { Stan, Subscription } from 'node-nats-streaming';
import { v4 as uuidv4 } from 'uuid';

export class NatsWrapper {
    private _client?: Stan;
    private _isConnected: boolean = false;
    private _reconnectInterval: number = 5000;

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
                console.log('Connected to NATS');
                this._isConnected = true;
            });

            this._client.on('disconnect', () => {
                console.log('Disconnected from NATS');
                this._isConnected = false;
                this.attemptReconnect(clusterId, clientId, url);
            });

            return new Promise<void>((resolve, reject) => {
                this.client!.on('connect', () => resolve());
                this.client!.on('error', (err) => reject(err));
            });
        } catch (error) {
            console.error('Failed to connect to NATS:', error);
            this.attemptReconnect(clusterId, clientId, url);
        }
    }

    private attemptReconnect(clusterId: string, clientId: string, url: string) {
        setTimeout(() => {
            console.log('Attempting to reconnect to NATS...');
            this.connect(clusterId, clientId, url);
        }, this._reconnectInterval);
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