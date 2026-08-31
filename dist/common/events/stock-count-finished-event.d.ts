import { Subjects } from "./subjects";
import { StockCountFinishReason } from "./types/stock-count-status";
/**
 * Depo sayımı bitti (issue #637)
 *
 * Yayınlayan: inventory (finalize / abort / expiry cron)
 * Dinleyen:   integration, orders (FOREIGN ActiveStockCount kaydını hard delete)
 *
 * Bu event kaybolursa tüketici servisler kilidi `expiresAt` ile kendileri
 * düşürür (defensive expiry) — event kaybı hesabı kalıcı kilitlemez.
 */
export interface StockCountFinishedEvent {
    subject: Subjects.StockCountFinished;
    data: {
        countId: string;
        userId: string;
        warehouseId: string;
        warehouseAlternativeId: number;
        finishedAt: string;
        reason: StockCountFinishReason;
    };
}
