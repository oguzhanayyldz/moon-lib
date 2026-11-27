/**
 * UC-2511 — ResourceName.MikroErp kaydı ve IntegrationRouter eşlemesi.
 * Haritada olmayan platform sessizce MarketPlace'e düşer ve komut yanlış subject'e gider
 * (integration:marketplace:mikroerp:command); ERP servisi o subject'i dinlemez.
 */
import { ResourceName } from '../common/types/resourceName';
import { IntegrationRouter } from '../services/integrationRouter.service';
import { IntegrationType } from '../common/types/integration-type';

describe('UC-2511 MikroErp kaydı', () => {
    it('ResourceName üyesi doğru değerde', () => {
        expect(ResourceName.MikroErp).toBe('MikroErp');
    });

    it('MikroErp → Erp, haritadan (varsayılan MarketPlace yedeğinden değil)', () => {
        expect((IntegrationRouter as any).PLATFORM_TYPE_MAP[ResourceName.MikroErp]).toBe(IntegrationType.Erp);
        expect(IntegrationRouter.getIntegrationType(ResourceName.MikroErp)).toBe(IntegrationType.Erp);
    });

    it('NATS subject biçimi: servis bu subject’i dinler', () => {
        const type = IntegrationRouter.getIntegrationType(ResourceName.MikroErp);
        expect(IntegrationRouter.getTargetSubject(type, ResourceName.MikroErp)).toBe('integration:erp:mikroerp:command');
    });
});
