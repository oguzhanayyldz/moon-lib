import { ResourceName } from "../types/resourceName";

export class IntegrationCredentials {
    public user!: string;
    public platform!: ResourceName;
    public integration_active!: boolean;
    [key: string]: any;
}
