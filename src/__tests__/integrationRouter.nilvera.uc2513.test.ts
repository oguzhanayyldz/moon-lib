/**
 * UC-2513 — ResourceName.Nilvera kaydı ve IntegrationRouter eşlemesi.
 *
 * Eşleme olmazsa getIntegrationType varsayılan MarketPlace'e düşer; invoice servisi
 * ERP komutunu `integration:marketplace:nilvera:command`'a yollar ve nilvera servisi hiç duymaz.
 */
import { ResourceName } from '../common/types/resourceName';
import { IntegrationRouter } from '../services/integrationRouter.service';
import { IntegrationType } from '../common/types/integration-type';

describe('UC-2513 Nilvera kaydı', () => {
    it('ResourceName.Nilvera değeri katalog adıyla aynı', () => {
        expect(ResourceName.Nilvera).toBe('Nilvera');
    });

    it('Nilvera → Erp, haritadan (varsayılan MarketPlace değil)', () => {
        expect((IntegrationRouter as any).PLATFORM_TYPE_MAP[ResourceName.Nilvera]).toBe(IntegrationType.Erp);
        expect(IntegrationRouter.getIntegrationType(ResourceName.Nilvera)).toBe(IntegrationType.Erp);
    });

    it('NATS subject nilvera servisinin dinlediği konu', () => {
        expect(IntegrationRouter.getTargetSubject(IntegrationRouter.getIntegrationType(ResourceName.Nilvera), ResourceName.Nilvera))
            .toBe('integration:erp:nilvera:command');
    });
});
