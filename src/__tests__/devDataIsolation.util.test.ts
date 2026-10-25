import {
    assertDevDataIsolation,
    DEV_DATA_ISOLATION_VARIABLES,
    describeDevDataTargets,
    enforceDevDataIsolation,
    extractConnectionHosts,
    findDevDataIsolationViolations,
    isLocalDataHost
} from '../utils/devDataIsolation.util';

/**
 * Local development must never reach production data (UC-1068).
 *
 * Until October 2026 local skaffold pods ran with NODE_ENV=development and connected to
 * production MongoDB/Redis over the VPN, so development outbox and dead-letter records
 * landed in the production databases. The guard refuses to start such a process.
 *
 * Production pods use single-label cluster service names (`orders-mongodb-srv`,
 * `dev-redis-srv`, `nats-srv`); those are local by definition, so the guard can never stop
 * a production pod even if its NODE_ENV is not `production`.
 */

const LOCAL_ENV = {
    NODE_ENV: 'development',
    MONGO_URI: 'mongodb://dev-mongo-srv:27017/orders',
    REDIS_HOST: 'redis://dev-redis-srv:6379/3',
    NATS_URL: 'http://nats-srv:4222'
};

describe('isLocalDataHost', () => {
    it.each([
        'localhost',
        '127.0.0.1',
        '127.1.2.3',
        '::1',
        'host.docker.internal',
        'dev-mongo-srv',
        'nats-srv',
        'orders-mongodb-srv.default.svc',
        'orders-mongodb-srv.default.svc.cluster.local',
        'DEV-MONGO-SRV'
    ])('%s is local', host => {
        expect(isLocalDataHost(host)).toBe(true);
    });

    it.each([
        '100.64.0.1',
        '10.0.0.5',
        '192.168.1.20',
        '46.0.0.1',
        'mongo.example.com',
        'cluster0.abcde.mongodb.net',
        'svc.example.com',
        ''
    ])('%s is NOT local', host => {
        expect(isLocalDataHost(host)).toBe(false);
    });
});

describe('extractConnectionHosts', () => {
    it('reads every host of a multi-host Mongo URI and drops credentials, ports, path and query', () => {
        expect(
            extractConnectionHosts('mongodb://user:p%40ss@h1:27017,h2:27018/orders?replicaSet=rs0&w=majority')
        ).toEqual(['h1', 'h2']);
    });

    it('takes the host after the LAST @ (a password may contain @ unencoded)', () => {
        expect(extractConnectionHosts('redis://:a@b@dev-redis-srv:6379/3')).toEqual(['dev-redis-srv']);
    });

    it('accepts a bare host[:port] value (REDIS_HOST may be given without scheme)', () => {
        expect(extractConnectionHosts('dev-redis-srv:6379')).toEqual(['dev-redis-srv']);
        expect(extractConnectionHosts('dev-redis-srv')).toEqual(['dev-redis-srv']);
    });

    it('handles bracketed IPv6 hosts', () => {
        expect(extractConnectionHosts('mongodb://[::1]:27017/db')).toEqual(['::1']);
    });

    it('lower-cases hosts and ignores empty entries', () => {
        expect(extractConnectionHosts('nats://NATS-SRV:4222, ,nats://other:4222')).toEqual(['nats-srv', 'other']);
    });
});

describe('findDevDataIsolationViolations', () => {
    it('checks MONGO_URI, REDIS_HOST and NATS_URL', () => {
        expect(DEV_DATA_ISOLATION_VARIABLES).toEqual(['MONGO_URI', 'REDIS_HOST', 'NATS_URL']);
    });

    it('returns nothing for a fully local development config', () => {
        expect(findDevDataIsolationViolations(LOCAL_ENV)).toEqual([]);
    });

    it('flags a development process whose Mongo points at a VPN IP (the UC-1068 config)', () => {
        const violations = findDevDataIsolationViolations({ ...LOCAL_ENV, MONGO_URI: 'mongodb://u:p@100.64.1.2:30021/orders' });
        expect(violations).toEqual([{ variable: 'MONGO_URI', host: '100.64.1.2' }]);
    });

    it('flags Redis and NATS too, one entry per non-local host', () => {
        const violations = findDevDataIsolationViolations({
            ...LOCAL_ENV,
            REDIS_HOST: 'redis://:secret@100.64.1.2:30379/3',
            NATS_URL: 'nats://nats.example.com:4222'
        });
        expect(violations).toEqual([
            { variable: 'REDIS_HOST', host: '100.64.1.2' },
            { variable: 'NATS_URL', host: 'nats.example.com' }
        ]);
    });

    it('flags a mongodb+srv URI (always a public DNS name)', () => {
        const violations = findDevDataIsolationViolations({ ...LOCAL_ENV, MONGO_URI: 'mongodb+srv://u:p@cluster0.x.mongodb.net/db' });
        expect(violations).toEqual([{ variable: 'MONGO_URI', host: 'cluster0.x.mongodb.net' }]);
    });

    it('never reports a password in a violation', () => {
        const violations = findDevDataIsolationViolations({ ...LOCAL_ENV, REDIS_HOST: 'redis://:topsecret@100.64.1.2:30379/3' });
        expect(JSON.stringify(violations)).not.toContain('topsecret');
    });

    it.each(['production', 'test'])('does nothing when NODE_ENV=%s', nodeEnv => {
        expect(
            findDevDataIsolationViolations({ ...LOCAL_ENV, NODE_ENV: nodeEnv, MONGO_URI: 'mongodb://100.64.1.2:30021/orders' })
        ).toEqual([]);
    });

    it.each([undefined, '', 'staging'])('still checks when NODE_ENV=%s (pnpm dev runs without NODE_ENV)', nodeEnv => {
        expect(
            findDevDataIsolationViolations({ ...LOCAL_ENV, NODE_ENV: nodeEnv, MONGO_URI: 'mongodb://100.64.1.2:30021/orders' })
        ).toEqual([{ variable: 'MONGO_URI', host: '100.64.1.2' }]);
    });

    it('ignores variables that are not set', () => {
        expect(findDevDataIsolationViolations({ NODE_ENV: 'development' })).toEqual([]);
    });

    it('names an unset NODE_ENV in the error', () => {
        expect(() => assertDevDataIsolation({ MONGO_URI: 'mongodb://100.64.1.2:30021/orders' })).toThrow(
            'NODE_ENV=<unset>'
        );
    });

    it('lets every production host shape pass even under NODE_ENV=development', () => {
        expect(
            findDevDataIsolationViolations({
                NODE_ENV: 'development',
                MONGO_URI: 'mongodb://u:p@invoice-mongodb-srv:27017/invoice?authSource=admin',
                REDIS_HOST: 'redis://:p@dev-redis-srv:6379/12',
                NATS_URL: 'http://nats-srv:4222'
            })
        ).toEqual([]);
    });
});

describe('assertDevDataIsolation', () => {
    it('passes silently for a local config', () => {
        expect(() => assertDevDataIsolation(LOCAL_ENV)).not.toThrow();
    });

    it('throws a message naming the variable and host, without the password', () => {
        let message = '';
        try {
            assertDevDataIsolation({ ...LOCAL_ENV, MONGO_URI: 'mongodb://admin:hunter2@100.64.1.2:30021/orders' });
        } catch (error) {
            message = (error as Error).message;
        }
        expect(message).toContain('DEV_DATA_ISOLATION');
        expect(message).toContain('MONGO_URI');
        expect(message).toContain('100.64.1.2');
        expect(message).not.toContain('hunter2');
    });
});

describe('describeDevDataTargets', () => {
    it('lists the host of every configured variable without credentials', () => {
        const text = describeDevDataTargets({ ...LOCAL_ENV, REDIS_HOST: 'redis://:pw@dev-redis-srv:6379/3' });
        expect(text).toBe('MONGO_URI=dev-mongo-srv REDIS_HOST=dev-redis-srv NATS_URL=nats-srv');
        expect(text).not.toContain('pw');
    });
});

describe('enforceDevDataIsolation', () => {
    let exitSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
        errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        exitSpy.mockRestore();
        errorSpy.mockRestore();
        logSpy.mockRestore();
    });

    it('exits with code 1 when a development process targets production', () => {
        enforceDevDataIsolation({ ...LOCAL_ENV, REDIS_HOST: 'redis://:pw@100.64.1.2:30379/3' });
        expect(exitSpy).toHaveBeenCalledWith(1);
        expect(errorSpy.mock.calls[0][0]).toContain('REDIS_HOST -> 100.64.1.2');
        expect(errorSpy.mock.calls[0][0]).not.toContain('pw@');
    });

    it('logs the local targets and keeps running for a local config', () => {
        enforceDevDataIsolation(LOCAL_ENV);
        expect(exitSpy).not.toHaveBeenCalled();
        expect(logSpy).toHaveBeenCalledWith(
            'DEV_DATA_ISOLATION ok: MONGO_URI=dev-mongo-srv REDIS_HOST=dev-redis-srv NATS_URL=nats-srv'
        );
    });

    it('stays silent and never exits for production or test', () => {
        enforceDevDataIsolation({ ...LOCAL_ENV, NODE_ENV: 'production', MONGO_URI: 'mongodb://100.64.1.2:30021/x' });
        expect(exitSpy).not.toHaveBeenCalled();
        expect(logSpy).not.toHaveBeenCalled();
    });
});
