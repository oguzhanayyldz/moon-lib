import { inspect } from 'util';
import { redisWrapper } from '../redisWrapper.service';
import { logger } from '../logger.service';

// Gerçek `redis` istemcisi + gerçek DNS: `.invalid` TLD hiçbir zaman çözülmez (RFC 2606) (UC-1770).
jest.mock('../logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));

const FAKE_PASSWORD = `uc1770-${Date.now().toString(36)}`;
const mockedLogger = jest.mocked(logger);

describe('redisWrapper — parolalı URL + çözülemeyen host (UC-1770)', () => {
    beforeAll(() => {
        process.env.REDIS_STARTUP_MAX_WAIT_MS = '0';
    });
    afterAll(() => {
        delete process.env.REDIS_STARTUP_MAX_WAIT_MS;
    });

    it('DNS hatası loglarında ve atılan hatada parola görünmez', async () => {
        const url = `redis://default:${FAKE_PASSWORD}@nohost-uc1770.invalid:6379/0`;

        const rejected = await redisWrapper.connect(url, 2000).catch((e) => e);
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(rejected).toBeInstanceOf(Error);
        const logged = inspect(
            [mockedLogger.info.mock.calls, mockedLogger.warn.mock.calls, mockedLogger.error.mock.calls],
            { depth: 8, showHidden: true }
        );
        // Testin gerçekten DNS hatasını gördüğünü kanıtla (boş log yeşil sayılmasın)
        expect(logged).toMatch(/ENOTFOUND|EAI_AGAIN/);
        expect(logged).toContain('nohost-uc1770.invalid');
        expect(logged).not.toContain(FAKE_PASSWORD);
        expect(inspect(rejected, { depth: 8, showHidden: true })).not.toContain(FAKE_PASSWORD);
    });
});
