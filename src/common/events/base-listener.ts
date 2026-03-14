import { Message, Stan } from 'node-nats-streaming';
import { Event } from './event.interface';
import { EncryptionUtil } from '../../utils/encryption.util';

export abstract class Listener<T extends Event> {
    abstract subject: T['subject'];
    abstract queueGroupName: string;
    abstract onMessage(data: T['data'], msg: Message): void;
    protected client: Stan;
    protected ackWait: number = 5 * 1000;

    constructor(client: Stan) {
        this.client = client;
    }

    subscriptionOptions() {
        return this.client
            .subscriptionOptions()
            .setStartWithLastReceived()
            .setManualAckMode(true)
            .setAckWait(this.ackWait)
            .setDurableName(this.queueGroupName);
    }

    listen() {
        const subscription = this.client.subscribe(
            this.subject,
            this.queueGroupName,
            this.subscriptionOptions()
        );

        subscription.on('message', (msg: Message) => {
            // Message received
            const parsedData = this.parseMessage(msg);
            this.onMessage(parsedData, msg);
            // msg.ack();
        })
    }

    parseMessage(msg: Message) {
        const data = msg.getData();
        const parsed = typeof data === 'string'
            ? JSON.parse(data)
            : JSON.parse(data.toString('utf8'));

        // Outbox payload encryption: şifreli payload'ı decrypt et
        if (parsed && parsed._encrypted && typeof parsed._encrypted === 'string' && process.env.ENCRYPTION_KEY) {
            try {
                const decrypted = EncryptionUtil.decrypt(parsed._encrypted);
                return JSON.parse(decrypted);
            } catch {
                // Decrypt başarısız olursa orijinal parsed veriyi dön (backward compat)
                return parsed;
            }
        }

        return parsed;
    }
}