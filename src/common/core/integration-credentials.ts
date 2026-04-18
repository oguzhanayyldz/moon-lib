import { ResourceName } from "../types/resourceName";

export class IntegrationCredentials {
    public user!: string;
    public platform!: ResourceName;
    public integration_active!: boolean;
    public integrationId?: string; // Integration MongoDB ID — auth failure tracking (issue #521)
    [key: string]: any;
}
