import { ChildProcess, execFileSync, spawn } from 'child_process';
import net from 'net';
import { redisWrapper } from '../redisWrapper.service';

/**
 * UC-1043 gerçek ölçüm: servis Redis'ten önce açılır, Redis birkaç saniye sonra gelir.
 * Gerçek redis-server ve gerçek node-redis istemcisiyle koşar; redis-server PATH'te yoksa atlanır.
 */
const findRedisServer = (): string | null => {
    try {
        return execFileSync('which', ['redis-server'], { encoding: 'utf8' }).trim() || null;
    } catch {
        return null;
    }
};

const redisServerPath = findRedisServer();
const describeIfRedis = redisServerPath ? describe : describe.skip;

const freePort = (): Promise<number> => new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
        const { port } = server.address() as net.AddressInfo;
        server.close(() => resolve(port));
    });
});

describeIfRedis('redisWrapper startup retry against a real redis-server (UC-1043)', () => {
    let redisProcess: ChildProcess | undefined;

    afterEach(async () => {
        await redisWrapper.disconnect().catch(() => undefined);
        redisProcess?.kill('SIGKILL');
        redisProcess = undefined;
        delete process.env.REDIS_STARTUP_MAX_WAIT_MS;
    });

    it('service starts before Redis, Redis comes up 2.5 s later: connect() recovers and commands work', async () => {
        const port = await freePort();
        const url = `redis://127.0.0.1:${port}`;
        const startedAt = Date.now();

        setTimeout(() => {
            redisProcess = spawn(redisServerPath as string, ['--port', String(port), '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });
        }, 2500);

        // Deneme başına 1 sn zaman aşımı: ilk denemeler ECONNREFUSED/timeout ile düşer
        await redisWrapper.connect(url, 1000);
        const elapsed = Date.now() - startedAt;

        expect(elapsed).toBeGreaterThanOrEqual(2500);
        await redisWrapper.client.set('uc1043:probe', 'ok');
        expect(await redisWrapper.client.get('uc1043:probe')).toBe('ok');
        expect(redisWrapper.getActiveConnections()).toBe(1);
    }, 30000);

    it('REDIS_STARTUP_MAX_WAIT_MS=0: Redis absent → rejects after a single attempt (old behaviour)', async () => {
        (redisWrapper as any).hasConnected = false;
        process.env.REDIS_STARTUP_MAX_WAIT_MS = '0';
        const port = await freePort();

        const startedAt = Date.now();
        await expect(redisWrapper.connect(`redis://127.0.0.1:${port}`, 1000)).rejects.toBeTruthy();
        expect(Date.now() - startedAt).toBeLessThan(5000);
    }, 30000);
});
