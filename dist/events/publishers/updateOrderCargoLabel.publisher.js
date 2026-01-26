"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateOrderCargoLabelPublisher = void 0;
const common_1 = require("../../common");
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
class UpdateOrderCargoLabelPublisher extends common_1.Publisher {
    constructor() {
        super(...arguments);
        this.subject = common_1.Subjects.UpdateOrderCargoLabel;
    }
}
exports.UpdateOrderCargoLabelPublisher = UpdateOrderCargoLabelPublisher;
