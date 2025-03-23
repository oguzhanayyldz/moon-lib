import nats, { Stan } from 'node-nats-streaming';

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
}

export const createNatsWrapper = () => new NatsWrapper();