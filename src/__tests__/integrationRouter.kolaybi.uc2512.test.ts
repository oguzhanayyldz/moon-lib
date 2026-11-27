/**
 * UC-2512 — ResourceName.KolayBi kaydı ve IntegrationRouter eşlemesi.
 *
 * Eşleme olmazsa getIntegrationType varsayılan MarketPlace'e düşer; invoice servisi
 * ERP komutunu `integration:marketplace:kolaybi:command`'a yollar ve kolaybi servisi hiç duymaz.
 */
import { ResourceName } from '../common/types/resourceName';
import { IntegrationRouter } from '../services/integrationRouter.service';
import { IntegrationType } from '../common/types/integration-type';

describe('UC-2512 Kolay Bi kaydı', () => {
    it('ResourceName.KolayBi değeri katalog adıyla aynı', () => {
        expect(ResourceName.KolayBi).toBe('KolayBi');
    });

    it('KolayBi → Erp, haritadan (varsayılan MarketPlace değil)', () => {
        expect((IntegrationRouter as any).PLATFORM_TYPE_MAP[ResourceName.KolayBi]).toBe(IntegrationType.Erp);
        expect(IntegrationRouter.getIntegrationType(ResourceName.KolayBi)).toBe(IntegrationType.Erp);
    });

    it('NATS subject kolaybi servisinin dinlediği konu', () => {
        expect(IntegrationRouter.getTargetSubject(IntegrationRouter.getIntegrationType(ResourceName.KolayBi), ResourceName.KolayBi))
            .toBe('integration:erp:kolaybi:command');
    });
});
