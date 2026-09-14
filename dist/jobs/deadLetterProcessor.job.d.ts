import mongoose from 'mongoose';
import { Stan } from 'node-nats-streaming';
export declare class DeadLetterProcessorJob {
    private connection;
    private static readonly PROCESSOR_INTERVAL;
    private static readonly MAX_RETRY_DELAY;
    private static readonly BUSY_RETRY_DELAY;
    private static readonly MAX_REPLAYS_PER_CYCLE;
    private static readonly PROCESSING_TIMEOUT;
    private intervalId;
    private stuckCheckIntervalId;
    private running;
    private readonly deadLetterModel;
    /**
     * @param natsClient Servislerdeki mevcut çağrıyla uyum için imzada kalır. Hedefli oynatma (issue #648 DLQ-H)
     * NATS'e yayın yapmaz: kaydı, kaydı yazan listener bu süreçte işler.
     */
    constructor(natsClient: Stan, connection?: mongoose.Connection);
    /**
     * DLQ oynatmasının kapatma anahtarı. Varsayılan KAPALI: DEAD_LETTER_REPLAY_ENABLED 'true' değilse
     * hiçbir kayıt claim edilmez, kayıtlar bekler ve silinmez.
     */
    private static isReplayEnabled;
    start(): void;
    stop(): void;
    /**
     * Zamanı gelmiş DLQ kayıtlarını, kaydı yazan listener'a bu süreçte oynat (issue #648 DLQ-H).
     * - Yalnız bu süreçte kayıtlı ve oynatması açık listener'ların kayıtları claim edilir. Başka kuyruk grubunun
     *   kaydı, oynatması kapalı listener'ın kaydı ve listenerKey'i olmayan eski kayıt seçilmez.
     * - Bir tur sürerken yeni tur başlamaz; bir turda en fazla MAX_REPLAYS_PER_CYCLE kayıt işlenir.
     * - Bir oynatma en fazla PROCESSING_TIMEOUT beklenir; dönmeyen handler turu durduramaz.
     */
    private processPendingEvents;
    /**
     * Sıradaki kaydı atomik olarak claim et
     */
    private claimNextEvent;
    /**
     * Tek bir dead letter olayını kaydı yazan listener'a oynat ve sonucu aynı kayda yaz
     */
    private processEvent;
    /**
     * Oynatmayı PROCESSING_TIMEOUT ile sınırlar: dönmeyen bir handler bu işlemcinin turunu süresiz durdurmasın.
     * Süre dolunca handler iptal edilemez, arka planda sürer ve geç gelen sonucu yazılmaz; kayıt deneme bütçesi
     * tüketilmeden geri bırakılır. Süre, takılı kaydın başka işleyiciye geçtiği süreyle aynıdır; kayıt bu arada
     * devralındıysa geri bırakma yazılmaz (claimedBy).
     * Zaman aşımı `busy` döner, oysa handler başlamıştır: sonuç ve metrik etiketi kilitli olayın `busy`'siyle ortaktır,
     * yalnız warn logu ayırt eder. Bütçe tüketilmediği için hep dönmeyen bir handler ~11 dk'da bir yeniden oynatılır,
     * her denemede bir yürütme arka planda kalır ve kayıt `failed` olmaz; olay kilidi dolduğu için tek pod'da da aynı
     * olay eşzamanlı işlenebilir. Ardışık zaman aşımına sınır yoktur.
     */
    private replayWithinTimeout;
    /**
     * Başarısız oynatma aynı kaydın sayacını artırır; bütçe dolunca kayıt `failed` olur ve bir daha oynatılmaz
     */
    private markReplayFailed;
    /**
     * Kaydı sayacını artırmadan yeniden kuyruğa al
     */
    private requeue;
    /**
     * Kayıt hâlâ bu işleyicide mi: takılı sayılıp başka işleyiciye geçen kayda dokunulmaz
     */
    private claimedBy;
    /**
     * Takılı kalan işlemleri serbest bırak ve bu süreçte oynatıcısı olmayan bekleyen kayıtları logla
     */
    private releaseStuckEvents;
}
