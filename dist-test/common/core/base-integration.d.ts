export declare abstract class BaseIntegration {
    protected credentials: any;
    protected type: string | undefined;
    protected platform: string | undefined;
    constructor();
    protected abstract getDefaultCredentials(): any;
    protected abstract validatePlatformCredentials(): void;
    protected abstract connect(): Promise<void>;
    validateSetupRequirements(): void;
    setup(user: string, platform: string, credentials?: any): Promise<BaseIntegration>;
    getIntegrationType(): string | undefined;
    getPlatformName(): string | undefined;
    getCredentials(): any;
}
//# sourceMappingURL=base-integration.d.ts.map