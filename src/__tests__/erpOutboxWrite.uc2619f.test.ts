/**
 * UC-2619F (Y1) — ERP stok olayı, SERVİSİN enjekte ettiği mongoose bağlantısıyla gerçek Outbox'a yazılır (taklit YOK).
 * - Bağlantı verilmeden yazım denenirse sessizce takılmaz, açık hata verir.
 * - Bağlantı verilince olay o bağlantının `outboxes` koleksiyonunda 'pending' olarak görünür.
 */
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ErpIntegration } from '../common/core/erp-integration';
import { ErpCatalogCursor, ErpCatalogPage } from '../common/interfaces/erp-catalog.interface';
import { Subjects } from '../common/events/subjects';
import { ResourceName } from '../common/types/resourceName';
import { createOutboxModel } from '../models/outbox.schema';

jest.mock('../services/logger.service', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}));
jest.setTimeout(120000);

/** writeOutboxEvent'i EZMEZ: gerçek yazım yolu denenir. */
class RealWriteErp extends ErpIntegration {
    protected getDefaultCredentials() { return {}; }
    protected validatePlatformCredentials() {}
    protected async connect() {}
    protected async syncProducts() {}
    protected async createInvoice() { return ''; }
    protected async syncContacts() {}
    protected async updateStock() {}
    protected formalizeInvoice = undefined;
    protected updatePrice = undefined;
    protected checkBalance = undefined;
    protected deleteInvoice = undefined;
    protected async listCatalogPage(_cursor: ErpCatalogCursor | undefined): Promise<ErpCatalogPage> {
        return { items: [{ erpId: 'e1', sku: 'SKU-1', barcode: '869000', stock: 5, salePriceVatIncluded: true }] };
    }
    setCredentials(c: any) { this.credentials = c; }
}

const credentials = {
    user: 'user-1',
    platform: ResourceName.KolayBi,
    integrationId: 'erp-1',
    stock_update_settings: { enabled: true, sources: [{ integrationId: 'erp-1', enabled: true, warehouseId: 'W1', sourceLocationId: null }] }
};

describe('UC-2619F Y1 — ErpIntegration Outbox yazımı (gerçek Mongo, enjekte bağlantı)', () => {
    let mms: MongoMemoryServer;
    let conn: mongoose.Connection;

    beforeAll(async () => {
        mms = await MongoMemoryServer.create({ binary: { version: '6.0.4' } });
        conn = await mongoose.createConnection(mms.getUri()).asPromise();
        await createOutboxModel(conn).createCollection();
    });
    afterAll(async () => {
        await conn.close();
        await mms.stop();
    });

    it('bağlantı verilmeden yazım denenirse AÇIK hata verir (sessizce takılmaz)', async () => {
        (ErpIntegration as any).outboxConnection = undefined;
        const erp = new RealWriteErp();
        erp.setCredentials(credentials);
        await expect(erp.fetchStocks()).rejects.toThrow(/initializeOutbox/);
        expect(await conn.collection('outboxes').countDocuments()).toBe(0);
    });

    it('bağlantı verilince olay servisin Outbox koleksiyonuna pending olarak yazılır', async () => {
        ErpIntegration.initializeOutbox(conn);
        const erp = new RealWriteErp();
        erp.setCredentials(credentials);
        const result: any = await erp.fetchStocks();
        expect(result.data).toEqual({ pages: 1, rows: 1, events: 1 });
        const docs = await conn.collection('outboxes').find({ eventType: Subjects.ProductStockIntegrationUpdated }).toArray();
        expect(docs).toHaveLength(1);
        expect(docs[0].status).toBe('pending');
        expect(docs[0].payload.userId).toBe('user-1');
        expect(docs[0].payload.data[0]).toMatchObject({ sku: 'SKU-1', quantity: 5, warehouseId: 'W1' });
    });
});
