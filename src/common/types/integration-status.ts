export enum IntegrationStatus {
    Active = 'active',
    Inactive = 'inactive',
    Pending = 'pending',
    // Ürün pazaryerine gönderildi/eşleşti ama pazaryeri henüz ONAYLAMADI (ara statü).
    // Pending ("henüz senkron olmadı") ile karıştırma. matchProducts bu üründe eşleşmeye
    // devam eder; pazaryeri onaylayınca sonraki run'da Active'e döner.
    PendingApproval = 'pending_approval',
    Failed = 'failed',
    Syncing = 'syncing',
    SyncFailed = 'sync_failed',
    Deleted = 'deleted'
}