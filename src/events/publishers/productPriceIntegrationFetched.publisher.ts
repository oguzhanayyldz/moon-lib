import { Publisher, Subjects, ProductPriceIntegrationFetchedEvent } from '../../common';

/** UC-2595 (B4): ERP fiyat sayfası (ham, KDV dahil) → integration `ProductPriceIntegrationFetchedListener`. */
export class ProductPriceIntegrationFetchedPublisher extends Publisher<ProductPriceIntegrationFetchedEvent> {
    subject: Subjects.ProductPriceIntegrationFetched = Subjects.ProductPriceIntegrationFetched;
}
