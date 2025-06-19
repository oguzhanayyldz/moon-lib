"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    setup(user, platform, credentials) {
        return __awaiter(this, void 0, void 0, function* () {
            if (credentials) {
                this.credentials = Object.assign(Object.assign(Object.assign({}, this.getDefaultCredentials()), credentials), { user,
                    platform });
            }
            else {
                this.credentials.user = user;
                this.credentials.platform = platform;
            }
            this.validateSetupRequirements();
            yield this.connect();
            return this;
        });
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
