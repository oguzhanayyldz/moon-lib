import { randomBytes } from 'crypto';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { performance } from 'perf_hooks';
import { BaseApiClient } from '../baseApiClient.service';
import { IntegrationRequestLogService } from '../integrationRequestLog.service';
import { ResourceName } from '../../common';

/**
 * TASK-MUBUQLU1V1NCH (596-F + 602-F) — credential redaction on the IntegrationLog path.
 *
 * Every request goes through the real `BaseApiClient.makeRequest` and the real
 * `IntegrationRequestLogService.logRequest/logResponse`. Only the HTTP transport and the Mongo
 * model are replaced: the model captures the document that would have been written to
 * IntegrationLog, and the assertions read that document.
 *
 * Secret values are generated at run time, so no literal credential sits in this file.
 */
const fake = (label: string): string => `FAKE_${label}_${randomBytes(6).toString('hex')}`;
const MASK = '***REDACTED***';

type Captured = { request?: Record<string, unknown>; response?: Record<string, unknown> };

function capturingLogService(captured: Captured): IntegrationRequestLogService {
    class CapturingModel {
        id = 'log-1';
        constructor(private readonly doc: Record<string, unknown>) {}
        async save(): Promise<void> {
            captured.request = this.doc;
        }
        static async findById(): Promise<Record<string, unknown>> {
            return { requestTime: new Date(), integrationName: ResourceName.N11 };
        }
        static async findByIdAndUpdate(_id: string, update: Record<string, unknown>): Promise<void> {
            captured.response = update;
        }
    }
    return new IntegrationRequestLogService({ model: () => CapturingModel } as any);
}

const clientConfig = {
    rateLimiter: { points: 100, duration: 60 },
    // interval: 0 -> p-queue creates no interval timer (no timer leak after the test)
    queue: { concurrency: 5, intervalCap: 1000, interval: 0 },
    circuitBreaker: {
        failureThreshold: 100,
        resetTimeout: 60000,
        monitoringPeriod: 60000,
        expectedErrors: [],
        fallbackEnabled: false,
        halfOpenMaxCalls: 1
    },
    timeout: 5000
} as any;

class RecordingApiClient extends BaseApiClient {
    constructor(
        private readonly defaultHeaders: Record<string, string>,
        logService: IntegrationRequestLogService,
        reply: { data: unknown; headers?: Record<string, unknown> }
    ) {
        super(clientConfig, 'credential-redaction-test', ResourceName.N11, undefined, logService);
        (this as any).httpClient = {
            request: jest.fn(async (cfg: unknown) => ({ status: 200, headers: reply.headers ?? {}, data: reply.data, config: cfg }))
        };
    }
    getBaseURL(): string { return 'https://api.test.local'; }
    getDefaultHeaders(): Record<string, string> { return this.defaultHeaders; }
    async handleRateLimitError(): Promise<void> { /* noop */ }
    shouldRetry(): boolean { return false; }
}

/** Real axios transport: requests go to `baseUrl` over HTTP. */
class LiveApiClient extends BaseApiClient {
    constructor(private readonly baseUrl: string, logService: IntegrationRequestLogService) {
        super(clientConfig, 'credential-redaction-live-test', ResourceName.WooCommerce, undefined, logService);
        this.reconfigureHttpClient();
    }
    getBaseURL(): string { return this.baseUrl; }
    getDefaultHeaders(): Record<string, string> { return { Accept: 'text/plain' }; }
    async handleRateLimitError(): Promise<void> { /* noop */ }
    shouldRetry(): boolean { return false; }
}

/** Sends one POST through BaseApiClient and returns what reached IntegrationLog. */
async function sendAndCapture(options: {
    headers?: Record<string, string>;
    data?: unknown;
    params?: Record<string, unknown>;
    reply?: unknown;
    replyHeaders?: Record<string, unknown>;
}): Promise<{ request: Record<string, unknown>; response: Record<string, unknown>; text: string }> {
    const captured: Captured = {};
    const client = new RecordingApiClient(
        options.headers ?? { 'Content-Type': 'application/json' },
        capturingLogService(captured),
        { data: options.reply ?? { ok: true }, headers: options.replyHeaders }
    );
    await client.post('/endpoint', options.data, { params: options.params, skipRateLimit: true, skipCircuitBreaker: true } as any);
    expect(captured.request).toBeDefined();
    expect(captured.response).toBeDefined();
    const text = JSON.stringify({ request: captured.request, response: captured.response });
    return { request: captured.request!, response: captured.response!, text };
}

const expectAbsent = (text: string, secrets: string[]): void => {
    for (const secret of secrets) {
        expect(text).not.toContain(secret);
    }
};

describe('IntegrationLog credential redaction — Ticimax SOAP (596-F)', () => {
    it('masks a namespaced <tem:UyeKodu> in a SOAP request and keeps the other elements', async () => {
        const uyeKodu = fake('UYEKODU');
        const envelope =
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">' +
            '<soapenv:Body><tem:SelectUrun>' +
            `<tem:UyeKodu>${uyeKodu}</tem:UyeKodu>` +
            '<tem:f><tem:UrunKartiID>4242</tem:UrunKartiID></tem:f>' +
            '</tem:SelectUrun></soapenv:Body></soapenv:Envelope>';

        const { request, text } = await sendAndCapture({ headers: { 'Content-Type': 'text/xml' }, data: envelope });

        expectAbsent(text, [uyeKodu]);
        const logged = JSON.parse(request.requestBody as string).body;
        expect(logged).toContain(`<tem:UyeKodu>${MASK}</tem:UyeKodu>`);
        expect(logged).toContain('<tem:UrunKartiID>4242</tem:UrunKartiID>');
    });

    it('masks a credential element in a SOAP response that arrives as a string, cargo key stays', async () => {
        const token = fake('SOAP_TOKEN');
        const reply = `<soap:Envelope><soap:Body><Result><CargoKey>CK-77</CargoKey><Token>${token}</Token></Result></soap:Body></soap:Envelope>`;

        const { response, text } = await sendAndCapture({ reply });

        expectAbsent(text, [token]);
        expect(response.responseBody).toBe(
            `<soap:Envelope><soap:Body><Result><CargoKey>CK-77</CargoKey><Token>${MASK}</Token></Result></soap:Body></soap:Envelope>`
        );
    });

    it('masks an element that carries attributes and a multi-line value', async () => {
        const uyeKodu = fake('UYEKODU');
        const envelope = `<Body><UyeKodu xsi:type="xsd:string">\n  ${uyeKodu}\n</UyeKodu><Adet>3</Adet></Body>`;

        const { request, text } = await sendAndCapture({ headers: { 'Content-Type': 'text/xml' }, data: envelope });

        expectAbsent(text, [uyeKodu]);
        expect(JSON.parse(request.requestBody as string).body).toBe(
            `<Body><UyeKodu xsi:type="xsd:string">${MASK}</UyeKodu><Adet>3</Adet></Body>`
        );
    });
});

describe('IntegrationLog credential redaction — Mikro JSON (602-F)', () => {
    function mikroBody() {
        const secrets = {
            Sifre: fake('SIFRE'),
            ApiKey: fake('APIKEY'),
            KullaniciKodu: fake('KULLANICIKODU'),
            FirmaKodu: fake('FIRMAKODU')
        };
        return { secrets, body: { Mikro: { ...secrets, CalismaYili: '2026' }, cari_kod: 'C-001' } };
    }

    it('masks Sifre / ApiKey / KullaniciKodu / FirmaKodu in a JSON object body', async () => {
        const { secrets, body } = mikroBody();

        const { request, text } = await sendAndCapture({ data: body });

        expectAbsent(text, Object.values(secrets));
        const logged = JSON.parse(request.requestBody as string);
        expect(logged.body.Mikro).toEqual({
            Sifre: MASK, ApiKey: MASK, KullaniciKodu: MASK, FirmaKodu: MASK, CalismaYili: '2026'
        });
        expect(logged.body.cari_kod).toBe('C-001');
    });

    it('masks the same fields when the body is sent as a JSON string', async () => {
        const { secrets, body } = mikroBody();

        const { request, text } = await sendAndCapture({ data: JSON.stringify(body) });

        expectAbsent(text, Object.values(secrets));
        const logged = JSON.parse(request.requestBody as string);
        expect(JSON.parse(logged.body).Mikro.CalismaYili).toBe('2026');
    });

    it('masks the fields in a JSON string nested inside an object (T-Soft style `{ data: "<json>" }`)', async () => {
        const { secrets, body } = mikroBody();

        const { text } = await sendAndCapture({ data: { data: JSON.stringify([body]) } });

        expectAbsent(text, Object.values(secrets));
        expect(text).toContain('C-001');
    });
});

describe('IntegrationLog credential redaction — headers', () => {
    it('masks credential headers of current integrations (n11 appkey/appsecret, HepsiJet X-Auth-Token, Authorization)', async () => {
        const secrets = {
            appkey: fake('N11_APPKEY'),
            appsecret: fake('N11_APPSECRET'),
            'X-Auth-Token': fake('HEPSIJET_TOKEN'),
            Authorization: `Basic ${fake('BASIC')}`,
            'X-IBM-Client-Secret': fake('MNG_SECRET')
        };

        const { request, text } = await sendAndCapture({ headers: { ...secrets, 'Content-Type': 'application/json', 'User-Agent': 'moontra-ucms' } });

        expectAbsent(text, Object.values(secrets));
        const headers = request.requestHeaders as Record<string, string>;
        expect(headers['Content-Type']).toBe('application/json');
        expect(headers['User-Agent']).toBe('moontra-ucms');
    });

    it('masks a Set-Cookie response header', async () => {
        const cookie = fake('SESSION');

        const { response, text } = await sendAndCapture({ replyHeaders: { 'set-cookie': [`PHPSESSID=${cookie}; path=/`], 'x-request-id': 'req-1' } });

        expectAbsent(text, [cookie]);
        expect((response.responseHeaders as Record<string, unknown>)['x-request-id']).toBe('req-1');
    });
});

describe('IntegrationLog credential redaction — responses and query parameters of current integrations', () => {
    it('masks camelCase secrets in a response body (T-Soft login secretKey, Amazon restrictedDataToken)', async () => {
        const secrets = { secretKey: fake('TSOFT_SECRETKEY'), token: fake('TSOFT_TOKEN'), restrictedDataToken: fake('AMAZON_RDT') };

        const { response, text } = await sendAndCapture({
            reply: { success: true, data: [{ userId: 7, secretKey: secrets.secretKey, token: secrets.token }], restrictedDataToken: secrets.restrictedDataToken, expiresIn: 3600 }
        });

        expectAbsent(text, Object.values(secrets));
        const logged = JSON.parse(response.responseBody as string);
        expect(logged.expiresIn).toBe(3600);
        expect(logged.data[0].userId).toBe(7);
    });

    it('masks the WooCommerce OAuth consumer key sent as a query parameter', async () => {
        const consumerKey = fake('CK');

        const { request, text } = await sendAndCapture({ params: { per_page: 50, oauth_consumer_key: consumerKey } });

        expectAbsent(text, [consumerKey]);
        expect(JSON.parse(request.requestBody as string).queryParams.per_page).toBe(50);
    });
});

describe('IntegrationLog credential redaction — behaviour that already worked stays', () => {
    it('Aras: <Password>/<UserName>/<CustomerCode> inside a CDATA loginInfo', async () => {
        const secrets = { user: fake('ARAS_USER'), pass: fake('ARAS_PASS'), code: fake('ARAS_CODE') };
        const loginInfo = `<LoginInfo><UserName>${secrets.user}</UserName><Password>${secrets.pass}</Password><CustomerCode>${secrets.code}</CustomerCode></LoginInfo>`;
        const envelope = `<soap:Envelope><soap:Body><tem:GetQueryJSON><tem:loginInfo><![CDATA[${loginInfo}]]></tem:loginInfo></tem:GetQueryJSON></soap:Body></soap:Envelope>`;

        const { text } = await sendAndCapture({ headers: { 'Content-Type': 'text/xml' }, data: envelope });

        expectAbsent(text, Object.values(secrets));
    });

    it('T-Soft: url-encoded `pass=` body', async () => {
        const pass = fake('TSOFT_PASS');

        const { text } = await sendAndCapture({ data: `pass=${pass}` });

        expectAbsent(text, [pass]);
    });
});

describe('IntegrationLog credential redaction — measured false positives stay visible', () => {
    it('stores a non-object response (a bare count) as it is', async () => {
        const { response } = await sendAndCapture({ reply: 42 });

        expect(response.responseBody).toBe(42);
    });

    it('keeps SEO keywords, cargo key, pagination token and sort key readable', async () => {
        const reply = {
            metaKeywords: 'kupa, bardak',
            searchKeywords: 'seramik',
            cargoKey: 'CK-0001',
            nextPageToken: 'page-2',
            NextToken: 'amazon-page-2',
            sortKey: 'UPDATED_AT'
        };

        const { response } = await sendAndCapture({ reply });

        expect(JSON.parse(response.responseBody as string)).toEqual(reply);
    });
});

describe('IntegrationLog credential redaction — a hostile text response does not stall the service (TASK-MUBXAY9XUFBXH B1)', () => {
    it('logs a 200 KB escaped-quote text/plain reply from a tenant-controlled site without blocking the event loop', async () => {
        // WooCommerce / T-Soft / IdeaSoft `siteUrl` is entered by the tenant, so the reply body is theirs.
        // Before the fix this reply blocked the event loop for 9.5 s on the same path.
        const reply = 'x' + '"\\'.repeat(100000);
        const server = createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain', Connection: 'close' });
            res.end(reply);
        });
        await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
        const captured: Captured = {};
        const client = new LiveApiClient(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, capturingLogService(captured));

        let lastTick = performance.now();
        let maxGapMs = 0;
        const recordGap = (): void => {
            const now = performance.now();
            maxGapMs = Math.max(maxGapMs, now - lastTick);
            lastTick = now;
        };
        const ticker = setInterval(recordGap, 5);
        try {
            const data = await client.get<string>('/wp-json/wc/v3/products', { skipRateLimit: true, skipCircuitBreaker: true } as any);
            // A block right before this line is not seen by the interval, so the last gap is recorded here.
            recordGap();
            expect(data).toBe(reply);
        } finally {
            clearInterval(ticker);
            await new Promise((resolve) => server.close(resolve));
        }

        expect(captured.response?.responseBody).toBe(reply);
        expect(maxGapMs).toBeLessThan(200);
    });
});
