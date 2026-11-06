/**
 * Toplu (BULK) listener'larda kalem düzeyi hatayı yutmadan topla-fırlat (UC-866, UC-833 deseni).
 * Döngü her kalemi dener (bir kalemin hatası diğerlerini durdurmaz); hatalar sonda tek noktadan fırlatılır:
 *  - deterministik hata (veri/kod kusuru, yeniden teslimle düzelmez) → fırlatılmaz, `record` false döner (çağıran loglar);
 *  - geçici hata → `firstError`; duplicate-key → `dupError`. Genel hata > duplicate-key: dup-key'i öne almak,
 *    kardeş kalemin geçici hatasını retry'siz ack'letirdi (RetryableListener E11000'i yeniden denemeden ack'ler).
 * Orijinal hata nesnesi fırlatılır, SARMA yok: ad (kalıcı sınıflama) ve `code` (E11000) korunur; birleşik
 * mesajlı yeni `Error` ilk hata E11000 ise `\bE11000\b` regex'iyle dup-key sayılıp diğer hataları kaybettirirdi.
 */
export declare class ItemErrorCollector {
    private firstError?;
    private dupError?;
    /** Hatayı sınıflayıp saklar. Fırlatılacak (kalıcı olmayan) hata ise true, yutulacak deterministik ise false döner. */
    record(error: unknown): boolean;
    /** Döngü sonunda çağrılır: geçici hata varsa onu, yoksa duplicate-key hatasını orijinal nesneyle fırlatır. */
    throwIfAny(): void;
}
