import { Publisher, Subjects, UpdateOrderCargoLabelEvent } from '../../common';

/**
 * UpdateOrderCargoLabel Publisher
 *
 * Kargo etiketi bilgisi güncellendiğinde event yayınlar.
 * Integration Service'ler tarafından kullanılır.
 *
 * Kullanım senaryoları:
 * - Hepsiburada'da paket oluşturulduktan sonra etiket çekildiğinde
 * - Trendyol'da Picking durumuna geçildikten sonra etiket çekildiğinde
 */
export class UpdateOrderCargoLabelPublisher extends Publisher<UpdateOrderCargoLabelEvent> {
    subject: Subjects.UpdateOrderCargoLabel = Subjects.UpdateOrderCargoLabel;
}
