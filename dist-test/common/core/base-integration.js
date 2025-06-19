"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseIntegration = void 0;
class BaseIntegration {
    constructor() {
        this.credentials = this.getDefaultCredentials();
    }
    validateSetupRequirements() {
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
    async setup(user, platform, credentials) {
        if (credentials) {
            this.credentials = Object.assign(Object.assign(Object.assign({}, this.getDefaultCredentials()), credentials), { user,
                platform });
        }
        else {
            this.credentials.user = user;
            this.credentials.platform = platform;
        }
        this.validateSetupRequirements();
        await this.connect();
        return this;
    }
    getIntegrationType() {
        return this.type;
    }
    getPlatformName() {
        return this.platform;
    }
    getCredentials() {
        return this.credentials;
    }
}
exports.BaseIntegration = BaseIntegration;
//# sourceMappingURL=base-integration.js.map