import { Stan } from 'node-nats-streaming';
import { Event } from './event.interface';
export declare abstract class Publisher<T extends Event> {
    abstract subject: T['subject'];
    protected client: Stan;
    constructor(client: Stan);
    publish(data: T['data']): Promise<void>;
}
//# sourceMappingURL=base-publisher.d.ts.map