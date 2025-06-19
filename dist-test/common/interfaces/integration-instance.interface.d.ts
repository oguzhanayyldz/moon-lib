import { BaseIntegration } from "../core/base-integration";
import { ResourceName } from "../types/resourceName";
export interface IntegrationInstance {
    user: string;
    platform: ResourceName;
    instanceId: string;
    integration: BaseIntegration;
    lastUsed: Date;
}
//# sourceMappingURL=integration-instance.interface.d.ts.map