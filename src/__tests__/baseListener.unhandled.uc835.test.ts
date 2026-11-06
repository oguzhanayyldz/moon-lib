import { EventEmitter } from 'events';
import { Message, Stan } from 'node-nats-streaming';
import { Listener } from '../common/events/base-listener';
import { Subjects } from '../common/events/subjects';
import { logger } from '../services/logger.service';

jest.mock('../services/logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

/**
 * UC-835 (F-56, shipment kartından devreden base-listener `.catch`): listen() onMessage'ın reddini ve mesaj ayrıştırma
 * hatasını yakalar. Önceden onMessage await'siz çağrılıyordu: RetryableListener'ın hata yolu (Redis sayacı) fırlarsa red
 * işlenmeden kalıyor, unhandledRejection işleyicisi olan 11 servis gracefulShutdown'a, işleyicisi olmayanlar (Node 18)
 * çöküşe gidiyordu. Mesaj ack'lenmez; NATS yeniden teslim eder (çöküş sonrası da öyleydi).
 */
type TestEvent = { subject: Subjects.OrderCreated; data: { id: string } };

class ProbeListener extends Listener<TestEvent> {
    subject: Subjects.OrderCreated = Subjects.OrderCreated;
    queueGroupName = 'uc835-probe';
    constructor (client: Stan, private readonly handler: (data: TestEvent['data'], msg: Message) => void | Promise<void>) {
        super(client);
    }
    onMessage(data: TestEvent['data'], msg: Message) {
        return this.handler(data, msg);
    }
}

const harness = (handler: (data: TestEvent['data'], msg: Message) => void | Promise<void>) => {
    const subscription = new EventEmitter();
    const options: any = {};
    for (const name of ['setStartWithLastReceived', 'setManualAckMode', 'setAckWait', 'setDurableName']) {
        options[name] = () => options;
    }
    const client = { subscriptionOptions: () => options, subscribe: () => subscription } as unknown as Stan;
    new ProbeListener(client, handler).listen();
    const message = (raw: string) => ({
        getData: () => raw,
        getSequence: () => 7,
        ack: jest.fn()
    }) as unknown as Message & { ack: jest.Mock };
    return { subscription, message };
};

const flush = () => new Promise(resolve => setImmediate(resolve));

describe('Listener.listen — işlenmeyen hatalar (UC-835)', () => {
    let unhandled: unknown[];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);

    beforeAll(() => process.on('unhandledRejection', onUnhandled));
    afterAll(() => process.off('unhandledRejection', onUnhandled));
    beforeEach(() => {
        unhandled = [];
        jest.clearAllMocks();
    });

    it('onMessage reddi loglanır, işlenmeyen red kalmaz, mesaj ack\'lenmez', async () => {
        const { subscription, message } = harness(async () => {
            throw new Error('The client is closed');
        });
        const msg = message('{"id":"o-1"}');

        subscription.emit('message', msg);
        await flush();
        await flush();

        expect(unhandled).toHaveLength(0);
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect((logger.error as jest.Mock).mock.calls[0][0]).toContain(Subjects.OrderCreated);
        expect(msg.ack).not.toHaveBeenCalled();
    });

    it('ayrıştırılamayan mesaj olay döngüsüne fırlamaz, loglanır ve ack\'lenmez', () => {
        const handler = jest.fn();
        const { subscription, message } = harness(handler);
        const msg = message('{bozuk');

        expect(() => subscription.emit('message', msg)).not.toThrow();
        expect(handler).not.toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(msg.ack).not.toHaveBeenCalled();
    });

    it('senkron onMessage aynı turda çalışır (davranış değişmez)', () => {
        const seen: string[] = [];
        const { subscription, message } = harness((data) => { seen.push(data.id); });

        subscription.emit('message', message('{"id":"o-2"}'));

        expect(seen).toEqual(['o-2']);
        expect(logger.error).not.toHaveBeenCalled();
    });

    it('senkron fırlatan onMessage olay döngüsüne fırlamaz, loglanır ve ack\'lenmez', () => {
        const { subscription, message } = harness(() => {
            throw new Error('sync boom');
        });
        const msg = message('{"id":"o-3"}');

        expect(() => subscription.emit('message', msg)).not.toThrow();
        expect(logger.error).toHaveBeenCalledTimes(1);
        expect(msg.ack).not.toHaveBeenCalled();
    });
});
