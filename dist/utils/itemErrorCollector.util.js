"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ItemErrorCollector = void 0;
const duplicateKeyError_util_1 = require("./duplicateKeyError.util");
const eventErrorClassification_util_1 = require("./eventErrorClassification.util");
/**
 * Toplu (BULK) listener'larda kalem düzeyi hatayı yutmadan topla-fırlat (UC-866, UC-833 deseni).
 * Döngü her kalemi dener (bir kalemin hatası diğerlerini durdurmaz); hatalar sonda tek noktadan fırlatılır:
 *  - deterministik hata (veri/kod kusuru, yeniden teslimle düzelmez) → fırlatılmaz, `record` false döner (çağıran loglar);
 *  - geçici hata → `firstError`; duplicate-key → `dupError`. Genel hata > duplicate-key: dup-key'i öne almak,
 *    kardeş kalemin geçici hatasını retry'siz ack'letirdi (RetryableListener E11000'i yeniden denemeden ack'ler).
 * Orijinal hata nesnesi fırlatılır, SARMA yok: ad (kalıcı sınıflama) ve `code` (E11000) korunur; birleşik
 * mesajlı yeni `Error` ilk hata E11000 ise `\bE11000\b` regex'iyle dup-key sayılıp diğer hataları kaybettirirdi.
 */
class ItemErrorCollector {
    /** Hatayı sınıflayıp saklar. Fırlatılacak (kalıcı olmayan) hata ise true, yutulacak deterministik ise false döner. */
    record(error) {
        var _a, _b;
        if ((0, eventErrorClassification_util_1.isDeterministicEventError)(error)) {
            return false;
        }
        if ((0, duplicateKeyError_util_1.isDuplicateKeyError)(error)) {
            (_a = this.dupError) !== null && _a !== void 0 ? _a : (this.dupError = error);
        }
        else {
            (_b = this.firstError) !== null && _b !== void 0 ? _b : (this.firstError = error);
        }
        return true;
    }
    /** Döngü sonunda çağrılır: geçici hata varsa onu, yoksa duplicate-key hatasını orijinal nesneyle fırlatır. */
    throwIfAny() {
        var _a;
        const error = (_a = this.firstError) !== null && _a !== void 0 ? _a : this.dupError;
        if (error !== undefined) {
            throw error;
        }
    }
}
exports.ItemErrorCollector = ItemErrorCollector;
