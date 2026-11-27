import { ChildProcess, execFileSync, spawn } from 'child_process';
import net from 'net';
import { redisWrapper } from '../redisWrapper.service';

/**
 * UC-2494 gerçek ölçüm: yerel, geçici redis-server SIGKILL ile düşürülüp aynı portta yeniden açılır.
 * Açılışta saklanan istemci referansı (RateLimiter gibi) yeniden komut çalıştırabilmeli.
 * redis-server PATH'te yoksa atlanır. Canlı Redis'e dokunmaz.
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

const startRedis = (port: number): ChildProcess =>
    spawn(redisServerPath as string, ['--port', String(port), '--save', '', '--appendonly', 'no'], { stdio: 'ignore' });

const killRedis = (proc: ChildProcess | undefined): Promise<void> => new Promise((resolve) => {
    if (!proc || proc.exitCode !== null) return resolve();
    proc.once('exit', () => resolve());
    proc.kill('SIGKILL');
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describeIfRedis('redisWrapper survives Redis restarts against a real redis-server (UC-2494)', () => {
    let redisProcess: ChildProcess | undefined;

    afterEach(async () => {
        await redisWrapper.disconnect().catch(() => undefined);
        await killRedis(redisProcess);
        redisProcess = undefined;
    });

    it('Redis restarts 3 times in a row: the client held since startup runs commands again', async () => {
        const port = await freePort();
        redisProcess = startRedis(port);
        await redisWrapper.connect(`redis://127.0.0.1:${port}`, 1000);
        const heldByRateLimiter = redisWrapper.client;

        for (let restart = 1; restart <= 3; restart++) {
            await killRedis(redisProcess);
            await sleep(500);
            redisProcess = startRedis(port);

            // Bağlantı gelene kadar komut çevrimdışı kuyrukta bekler; vazgeçilmediği için sonunda çalışır.
            await heldByRateLimiter.set('uc2494:probe', `restart-${restart}`);
            expect(await heldByRateLimiter.get('uc2494:probe')).toBe(`restart-${restart}`);
            expect(redisWrapper.client).toBe(heldByRateLimiter);
            expect(heldByRateLimiter.isReady).toBe(true);
        }
    }, 60000);
});
