import { Subjects } from "./subjects";
import { StockCountScope } from "./types/stock-count-status";
/**
 * Depo sayımı başladı (issue #637)
 *
 * Yayınlayan: inventory (POST /api/stock/count/start)
 * Dinleyen:   integration, orders (FOREIGN ActiveStockCount kaydı + guard)
 *
 * NEDEN EVENT (paylaşılan Redis anahtarı DEĞİL):
 * Redis her serviste ayrı DB/secret ile izole (inventory `/6`, integration `/0`).
 * Kilidi tüketici servislere taşıyan tek güvenilir yol NATS.
 *
 * `warehouseAlternativeId` GEREKLİ: raf barkodu `{depo}X{raf}X{satır}X{sütun}`
 * formatında olduğu için tüketici servisler DB'ye gitmeden depo çözebilir
 * (bkz. `common/methods/core.ts` → encodeShelfBarcode).
 *
 * `expiresAt` GEREKLİ: StockCountFinished event'i kaybolursa tüketici tarafta
 * defensive expiry ile kilit yok sayılır — hesabın kalıcı kilitlenmesini önler.
 */
export interface StockCountStartedEvent {
    subject: Subjects.StockCountStarted;
    data: {
        /** StockCount doküman id'si — idempotency ve kilit kaydı anahtarı */
        countId: string;
        /** Sayımı yürüten hesap (ana kullanıcı) */
        userId: string;
        /** Sayılan deponun doküman id'si */
        warehouseId: string;
        /** Raf barkodundan depo çözmek için — DB lookup'sız guard */
        warehouseAlternativeId: number;
        scope: StockCountScope;
        /** Scope=Shelves ise sayılan rafların alternativeId listesi; Warehouse ise boş */
        shelfAlternativeIds: number[];
        startedAt: string;
        /** ISO tarih — tüketici tarafta defensive expiry için ZORUNLU */
        expiresAt: string;
    };
}
//# sourceMappingURL=stock-count-started-event.d.ts.map