export abstract class BaseIntegration {
    protected credentials: any;
    protected type: string | undefined;
    protected platform: string | undefined;

    constructor() {
        this.credentials = this.getDefaultCredentials();
    }

    protected abstract getDefaultCredentials(): any;
    protected abstract validatePlatformCredentials(): void;
    protected abstract connect(): Promise<void>;

    validateSetupRequirements(): void {
        //Her entegrasyonda olması gereken ortak alanların kontrolü
        const requiredFields = ['user', 'platform', 'integration_active'];
        for (const field of requiredFields) {
            if (!this.credentials[field]) {
                throw new Error(`${field} is required`);
            }
        }

        if (!this.credentials) {
            throw new Error('Credentials are required');
        }

        if (!this.credentials.integration_active) {
            throw new Error('Integration is not active');
        }

        // Platform-specific validations
        this.validatePlatformCredentials();
    }

    async setup(user: string, platform: string, credentials?: any): Promise<BaseIntegration> {
        if (credentials) {
            this.credentials = {
                ...this.getDefaultCredentials(),
                ...credentials,
                user,
                platform
            };
        } else {
            this.credentials.user = user;
            this.credentials.platform = platform;
        }

        this.validateSetupRequirements();
        await this.connect();
        return this;
    }

    getIntegrationType(): string | undefined {
        return this.type;
    }

    getPlatformName(): string | undefined {
        return this.platform;
    }

    getCredentials(): any {
        return this.credentials;
    }
}
