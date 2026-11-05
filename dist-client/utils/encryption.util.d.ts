/**
 * AES-256-GCM encryption/decryption utility for at-rest data protection.
 * Used for credential encryption and PII protection (Amazon SP-API DPP compliance).
 *
 * Encrypted format: iv:authTag:ciphertext (hex encoded)
 */
export declare class EncryptionUtil {
    private static getKey;
    /**
     * Encrypt a plaintext string using AES-256-GCM.
     * Returns: iv:authTag:ciphertext (hex encoded)
     */
    static encrypt(value: string, key?: string): string;
    /**
     * Decrypt a value encrypted with encrypt().
     * Expects format: iv:authTag:ciphertext (hex encoded)
     */
    static decrypt(encryptedValue: string, key?: string): string;
    /**
     * Check if a value is already encrypted (matches iv:authTag:ciphertext format).
     */
    static isEncrypted(value: string): boolean;
    /**
     * One-way SHA-256 hash for PII search support.
     * Returns hex-encoded hash. Used for creating searchable hash fields
     * (e.g., emailHash, phoneHash) without exposing the original value.
     */
    static hashPII(value: string, salt?: string): string;
    /**
     * Encrypt specific fields of an object. Returns a new object with encrypted fields.
     */
    static encryptFields<T extends Record<string, unknown>>(obj: T, fieldsToEncrypt: string[], key?: string): T;
    /**
     * Decrypt specific fields of an object. Returns a new object with decrypted fields.
     */
    static decryptFields<T extends Record<string, unknown>>(obj: T, fieldsToDecrypt: string[], key?: string): T;
    /**
     * Generate a random encryption key (32 bytes = 256 bits) as hex string.
     * Useful for initial ENCRYPTION_KEY generation.
     */
    static generateKey(): string;
}
