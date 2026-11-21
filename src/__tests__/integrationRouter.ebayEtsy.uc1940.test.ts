/**
 * UC-1940 — ResourceName.Ebay / ResourceName.Etsy kaydı ve IntegrationRouter eşlemesi.
 */
import { ResourceName } from '../common/types/resourceName';
import { IntegrationRouter } from '../services/integrationRouter.service';
import { IntegrationType } from '../common/types/integration-type';

describe('UC-1940 Ebay + Etsy kaydı', () => {
    it('ResourceName üyeleri doğru değerde', () => {
        expect(ResourceName.Ebay).toBe('Ebay');
        expect(ResourceName.Etsy).toBe('Etsy');
    });

    it.each([ResourceName.Ebay, ResourceName.Etsy])('%s → MarketPlace, haritadan', (platform) => {
        expect((IntegrationRouter as any).PLATFORM_TYPE_MAP[platform]).toBe(IntegrationType.MarketPlace);
        expect(IntegrationRouter.getIntegrationType(platform)).toBe(IntegrationType.MarketPlace);
    });

    it('NATS subject biçimi', () => {
        expect(IntegrationRouter.getTargetSubject('marketplace', ResourceName.Ebay)).toBe('integration:marketplace:ebay:command');
        expect(IntegrationRouter.getTargetSubject('marketplace', ResourceName.Etsy)).toBe('integration:marketplace:etsy:command');
    });
});
