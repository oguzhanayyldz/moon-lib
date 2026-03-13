"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionUtil = void 0;
const crypto_1 = __importDefault(require("crypto"));
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const SEPARATOR = ':';
/**
 * AES-256-GCM encryption/decryption utility for at-rest data protection.
 * Used for credential encryption and PII protection (Amazon SP-API DPP compliance).
 *
 * Encrypted format: iv:authTag:ciphertext (hex encoded)
 */
class EncryptionUtil {
    static getKey(key) {
        const encryptionKey = key || process.env.ENCRYPTION_KEY;
        if (!encryptionKey) {
            throw new Error('ENCRYPTION_KEY environment variable is not set');
        }
        // If key is hex string (64 chars = 32 bytes), convert directly
        if (encryptionKey.length === KEY_LENGTH * 2 && /^[0-9a-fA-F]+$/.test(encryptionKey)) {
            return Buffer.from(encryptionKey, 'hex');
        }
        // Otherwise, derive a 32-byte key using SHA-256
        return crypto_1.default.createHash('sha256').update(encryptionKey).digest();
    }
    /**
     * Encrypt a plaintext string using AES-256-GCM.
     * Returns: iv:authTag:ciphertext (hex encoded)
     */
    static encrypt(value, key) {
        if (!value)
            return value;
        const keyBuffer = this.getKey(key);
        const iv = crypto_1.default.randomBytes(IV_LENGTH);
        const cipher = crypto_1.default.createCipheriv(ALGORITHM, keyBuffer, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        });
        let encrypted = cipher.update(value, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');
        return [iv.toString('hex'), authTag, encrypted].join(SEPARATOR);
    }
    /**
     * Decrypt a value encrypted with encrypt().
     * Expects format: iv:authTag:ciphertext (hex encoded)
     */
    static decrypt(encryptedValue, key) {
        if (!encryptedValue)
            return encryptedValue;
        const parts = encryptedValue.split(SEPARATOR);
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted value format. Expected iv:authTag:ciphertext');
        }
        const [ivHex, authTagHex, ciphertext] = parts;
        const keyBuffer = this.getKey(key);
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto_1.default.createDecipheriv(ALGORITHM, keyBuffer, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        });
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
    /**
     * Check if a value is already encrypted (matches iv:authTag:ciphertext format).
     */
    static isEncrypted(value) {
        if (!value || typeof value !== 'string')
            return false;
        const parts = value.split(SEPARATOR);
        if (parts.length !== 3)
            return false;
        const [ivHex, authTagHex, ciphertext] = parts;
        // IV = 16 bytes = 32 hex chars
        if (ivHex.length !== IV_LENGTH * 2)
            return false;
        // AuthTag = 16 bytes = 32 hex chars
        if (authTagHex.length !== AUTH_TAG_LENGTH * 2)
            return false;
        // Ciphertext must be non-empty hex
        if (!ciphertext || ciphertext.length === 0)
            return false;
        // All parts must be valid hex
        return /^[0-9a-fA-F]+$/.test(ivHex + authTagHex + ciphertext);
    }
    /**
     * One-way SHA-256 hash for PII search support.
     * Returns hex-encoded hash. Used for creating searchable hash fields
     * (e.g., emailHash, phoneHash) without exposing the original value.
     */
    static hashPII(value, salt) {
        if (!value)
            return value;
        const piiSalt = salt || process.env.PII_HASH_SALT;
        if (!piiSalt) {
            throw new Error('PII_HASH_SALT environment variable is not set');
        }
        return crypto_1.default
            .createHash('sha256')
            .update(piiSalt + value.toLowerCase().trim())
            .digest('hex');
    }
    /**
     * Encrypt specific fields of an object. Returns a new object with encrypted fields.
     */
    static encryptFields(obj, fieldsToEncrypt, key) {
        const result = Object.assign({}, obj);
        for (const field of fieldsToEncrypt) {
            const value = result[field];
            if (typeof value === 'string' && value && !this.isEncrypted(value)) {
                result[field] = this.encrypt(value, key);
            }
        }
        return result;
    }
    /**
     * Decrypt specific fields of an object. Returns a new object with decrypted fields.
     */
    static decryptFields(obj, fieldsToDecrypt, key) {
        const result = Object.assign({}, obj);
        for (const field of fieldsToDecrypt) {
            const value = result[field];
            if (typeof value === 'string' && value && this.isEncrypted(value)) {
                result[field] = this.decrypt(value, key);
            }
        }
        return result;
    }
    /**
     * Generate a random encryption key (32 bytes = 256 bits) as hex string.
     * Useful for initial ENCRYPTION_KEY generation.
     */
    static generateKey() {
        return crypto_1.default.randomBytes(KEY_LENGTH).toString('hex');
    }
}
exports.EncryptionUtil = EncryptionUtil;
//# sourceMappingURL=encryption.util.js.map