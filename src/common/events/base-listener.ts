import { Message, Stan } from 'node-nats-streaming';
import { Event } from './event.interface';
import { logger } from '../../services/logger.service';

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
            // Hata yakalanmazsa olay döngüsüne (ayrıştırma) ya da unhandledRejection'a (async onMessage) düşer:
            // servisler çöker ya da kapanır (UC-835). Mesaj ack'lenmez, NATS yeniden teslim eder.
            let result: unknown;
            try {
                const parsedData = this.parseMessage(msg);
                result = this.onMessage(parsedData, msg);
            } catch (error) {
                this.logUnhandledError(msg, error);
                return;
            }
            if (result instanceof Promise) {
                result.catch(error => this.logUnhandledError(msg, error));
            }
        })
    }

    private logUnhandledError(msg: Message, error: unknown) {
        logger.error(`Unhandled error in ${this.constructor.name} for ${this.subject} (seq: ${msg.getSequence?.()}), message not acked, NATS will redeliver:`, error);
    }

    parseMessage(msg: Message) {
        const data = msg.getData();
        const parsed = typeof data === 'string'
            ? JSON.parse(data)
            : JSON.parse(data.toString('utf8'));

        return parsed;
    }
}