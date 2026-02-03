"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkPackageActionType = void 0;
/**
 * İş Paketi Aksiyon Tipleri
 * Detaylı loglama için tüm aksiyon türleri
 */
var WorkPackageActionType;
(function (WorkPackageActionType) {
    // İş Paketi Aksiyonları
    /** İş paketi oluşturuldu */
    WorkPackageActionType["PackageCreated"] = "PackageCreated";
    /** İş paketi başlatıldı */
    WorkPackageActionType["PackageStarted"] = "PackageStarted";
    /** İş paketi iptal edildi */
    WorkPackageActionType["PackageCancelled"] = "PackageCancelled";
    /** İş paketi tamamlandı */
    WorkPackageActionType["PackageCompleted"] = "PackageCompleted";
    // Personel Aksiyonları
    /** Personel atandı */
    WorkPackageActionType["AssigneeChanged"] = "AssigneeChanged";
    // Araç Aksiyonları
    /** Toplama arabası okutuldu */
    WorkPackageActionType["PickingCartScanned"] = "PickingCartScanned";
    /** Ayrıştırma rafı okutuldu */
    WorkPackageActionType["SortingRackScanned"] = "SortingRackScanned";
    /** Araç serbest bırakıldı */
    WorkPackageActionType["DeviceReleased"] = "DeviceReleased";
    // Toplama Aksiyonları
    /** Toplama başladı */
    WorkPackageActionType["PickingStarted"] = "PickingStarted";
    /** Ürün toplandı */
    WorkPackageActionType["ItemPicked"] = "ItemPicked";
    /** Ürün bulunamadı */
    WorkPackageActionType["ItemNotFound"] = "ItemNotFound";
    /** Alternatif rota oluşturuldu */
    WorkPackageActionType["AlternativeRouteCreated"] = "AlternativeRouteCreated";
    /** Toplama tamamlandı */
    WorkPackageActionType["PickingCompleted"] = "PickingCompleted";
    // Ayrıştırma Aksiyonları
    /** Ayrıştırma başladı */
    WorkPackageActionType["SortingStarted"] = "SortingStarted";
    /** Ürün kutuya yerleştirildi */
    WorkPackageActionType["ItemSorted"] = "ItemSorted";
    /** Ayrıştırma tamamlandı */
    WorkPackageActionType["SortingCompleted"] = "SortingCompleted";
    // Paketleme Aksiyonları
    /** Paketleme başladı */
    WorkPackageActionType["PackingStarted"] = "PackingStarted";
    /** Sipariş paketlendi */
    WorkPackageActionType["OrderPacked"] = "OrderPacked";
    /** Fatura yazdırıldı */
    WorkPackageActionType["InvoicePrinted"] = "InvoicePrinted";
    /** Kargo etiketi yazdırıldı */
    WorkPackageActionType["LabelPrinted"] = "LabelPrinted";
    /** Paketleme tamamlandı */
    WorkPackageActionType["PackingCompleted"] = "PackingCompleted";
    // Sorun Aksiyonları
    /** Sipariş sorunlu işaretlendi */
    WorkPackageActionType["OrderMarkedProblematic"] = "OrderMarkedProblematic";
    /** Sorunlu sipariş çözüldü */
    WorkPackageActionType["ProblematicOrderResolved"] = "ProblematicOrderResolved";
    // Stok Aksiyonları
    /** Stok bloke edildi */
    WorkPackageActionType["StockBlocked"] = "StockBlocked";
    /** Stok blokesi serbest bırakıldı (blockedQuantity azaltıldı) */
    WorkPackageActionType["StockBlockedReleased"] = "StockBlockedReleased";
    /** Stok serbest bırakıldı */
    WorkPackageActionType["StockReleased"] = "StockReleased";
    /** Stok düşüldü */
    WorkPackageActionType["StockDeducted"] = "StockDeducted";
    // Session Aksiyonları
    /** Session başlatıldı */
    WorkPackageActionType["SessionStarted"] = "SessionStarted";
    /** Session devam etti */
    WorkPackageActionType["SessionResumed"] = "SessionResumed";
    /** Session duraklatıldı */
    WorkPackageActionType["SessionPaused"] = "SessionPaused";
    /** Session zaman aşımı */
    WorkPackageActionType["SessionTimeout"] = "SessionTimeout";
    // Batch Aksiyonları
    /** Batch toplama tamamlandı */
    WorkPackageActionType["BatchPickingCompleted"] = "BatchPickingCompleted";
    /** Batch ayrıştırma tamamlandı */
    WorkPackageActionType["BatchSortingCompleted"] = "BatchSortingCompleted";
    // Performans Aksiyonları
    /** Performans metrikleri kaydedildi */
    WorkPackageActionType["PhaseMetricsRecorded"] = "PhaseMetricsRecorded";
    // Frontend-First Aksiyonları
    /** İlerleme kaydedildi (ara kayıt - sayfa terk edilirken) */
    WorkPackageActionType["ProgressSaved"] = "ProgressSaved";
    /** Slot atandı (ayrıştırma için) */
    WorkPackageActionType["SlotAssigned"] = "SlotAssigned";
    /** Ürün doğrulandı (paketleme için) */
    WorkPackageActionType["ItemVerified"] = "ItemVerified";
})(WorkPackageActionType || (exports.WorkPackageActionType = WorkPackageActionType = {}));
