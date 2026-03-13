import { EncryptionUtil } from '../utils/encryption.util';

const TEST_KEY = 'a'.repeat(64); // 32 bytes hex key

describe('EncryptionUtil', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
        process.env.ENCRYPTION_KEY = TEST_KEY;
        process.env.PII_HASH_SALT = 'test-salt';
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('encrypt / decrypt', () => {
        it('should encrypt and decrypt a string correctly', () => {
            const plaintext = 'my-secret-value';
            const encrypted = EncryptionUtil.encrypt(plaintext);
            expect(encrypted).not.toBe(plaintext);

            const decrypted = EncryptionUtil.decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
        });

        it('should produce different ciphertexts for same plaintext (random IV)', () => {
            const plaintext = 'same-value';
            const encrypted1 = EncryptionUtil.encrypt(plaintext);
            const encrypted2 = EncryptionUtil.encrypt(plaintext);
            expect(encrypted1).not.toBe(encrypted2);

            // Both should decrypt to same value
            expect(EncryptionUtil.decrypt(encrypted1)).toBe(plaintext);
            expect(EncryptionUtil.decrypt(encrypted2)).toBe(plaintext);
        });

        it('should handle empty string', () => {
            expect(EncryptionUtil.encrypt('')).toBe('');
            expect(EncryptionUtil.decrypt('')).toBe('');
        });

        it('should handle unicode characters', () => {
            const plaintext = 'Türkçe karakter: ğüşıöç 日本語';
            const encrypted = EncryptionUtil.encrypt(plaintext);
            const decrypted = EncryptionUtil.decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
        });

        it('should handle long strings', () => {
            const plaintext = 'x'.repeat(10000);
            const encrypted = EncryptionUtil.encrypt(plaintext);
            const decrypted = EncryptionUtil.decrypt(encrypted);
            expect(decrypted).toBe(plaintext);
        });

        it('should work with explicit key parameter', () => {
            const customKey = 'b'.repeat(64);
            const plaintext = 'custom-key-test';
            const encrypted = EncryptionUtil.encrypt(plaintext, customKey);
            const decrypted = EncryptionUtil.decrypt(encrypted, customKey);
            expect(decrypted).toBe(plaintext);
        });

        it('should fail to decrypt with wrong key', () => {
            const plaintext = 'test-value';
            const encrypted = EncryptionUtil.encrypt(plaintext, 'a'.repeat(64));
            expect(() => {
                EncryptionUtil.decrypt(encrypted, 'b'.repeat(64));
            }).toThrow();
        });

        it('should throw if ENCRYPTION_KEY is not set', () => {
            delete process.env.ENCRYPTION_KEY;
            expect(() => {
                EncryptionUtil.encrypt('test');
            }).toThrow('ENCRYPTION_KEY environment variable is not set');
        });

        it('should throw on invalid encrypted format', () => {
            expect(() => {
                EncryptionUtil.decrypt('invalid-format');
            }).toThrow('Invalid encrypted value format');
        });

        it('should throw on tampered ciphertext', () => {
            const encrypted = EncryptionUtil.encrypt('test');
            const parts = encrypted.split(':');
            parts[2] = 'ff' + parts[2].substring(2); // tamper ciphertext
            expect(() => {
                EncryptionUtil.decrypt(parts.join(':'));
            }).toThrow();
        });

        it('should derive key from non-hex string using SHA-256', () => {
            const shortKey = 'my-simple-password';
            const plaintext = 'derived-key-test';
            const encrypted = EncryptionUtil.encrypt(plaintext, shortKey);
            const decrypted = EncryptionUtil.decrypt(encrypted, shortKey);
            expect(decrypted).toBe(plaintext);
        });
    });

    describe('isEncrypted', () => {
        it('should return true for encrypted values', () => {
            const encrypted = EncryptionUtil.encrypt('test');
            expect(EncryptionUtil.isEncrypted(encrypted)).toBe(true);
        });

        it('should return false for plaintext values', () => {
            expect(EncryptionUtil.isEncrypted('plaintext')).toBe(false);
            expect(EncryptionUtil.isEncrypted('')).toBe(false);
            expect(EncryptionUtil.isEncrypted('abc:def')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(EncryptionUtil.isEncrypted(null as unknown as string)).toBe(false);
            expect(EncryptionUtil.isEncrypted(undefined as unknown as string)).toBe(false);
        });
    });

    describe('hashPII', () => {
        it('should produce consistent hash for same input', () => {
            const hash1 = EncryptionUtil.hashPII('test@example.com');
            const hash2 = EncryptionUtil.hashPII('test@example.com');
            expect(hash1).toBe(hash2);
        });

        it('should be case-insensitive', () => {
            const hash1 = EncryptionUtil.hashPII('Test@Example.COM');
            const hash2 = EncryptionUtil.hashPII('test@example.com');
            expect(hash1).toBe(hash2);
        });

        it('should trim whitespace', () => {
            const hash1 = EncryptionUtil.hashPII('  test@example.com  ');
            const hash2 = EncryptionUtil.hashPII('test@example.com');
            expect(hash1).toBe(hash2);
        });

        it('should produce different hashes for different inputs', () => {
            const hash1 = EncryptionUtil.hashPII('user1@example.com');
            const hash2 = EncryptionUtil.hashPII('user2@example.com');
            expect(hash1).not.toBe(hash2);
        });

        it('should produce different hashes with different salts', () => {
            const hash1 = EncryptionUtil.hashPII('test', 'salt1');
            const hash2 = EncryptionUtil.hashPII('test', 'salt2');
            expect(hash1).not.toBe(hash2);
        });

        it('should handle empty string', () => {
            expect(EncryptionUtil.hashPII('')).toBe('');
        });

        it('should throw if PII_HASH_SALT is not set', () => {
            delete process.env.PII_HASH_SALT;
            expect(() => {
                EncryptionUtil.hashPII('test@example.com');
            }).toThrow('PII_HASH_SALT environment variable is not set');
        });

        it('should return hex string of 64 chars (SHA-256)', () => {
            const hash = EncryptionUtil.hashPII('test@example.com');
            expect(hash).toMatch(/^[0-9a-f]{64}$/);
        });
    });

    describe('encryptFields / decryptFields', () => {
        it('should encrypt and decrypt specified fields', () => {
            const obj = {
                clientId: 'public-id',
                clientSecret: 'super-secret',
                refreshToken: 'refresh-token-value',
                sellerId: 'seller-123',
            };

            const encrypted = EncryptionUtil.encryptFields(obj, ['clientSecret', 'refreshToken']);
            expect(encrypted.clientId).toBe('public-id');
            expect(encrypted.sellerId).toBe('seller-123');
            expect(encrypted.clientSecret).not.toBe('super-secret');
            expect(encrypted.refreshToken).not.toBe('refresh-token-value');
            expect(EncryptionUtil.isEncrypted(encrypted.clientSecret)).toBe(true);

            const decrypted = EncryptionUtil.decryptFields(encrypted, ['clientSecret', 'refreshToken']);
            expect(decrypted.clientSecret).toBe('super-secret');
            expect(decrypted.refreshToken).toBe('refresh-token-value');
        });

        it('should not double-encrypt already encrypted fields', () => {
            const obj = { secret: 'value' };
            const encrypted = EncryptionUtil.encryptFields(obj, ['secret']);
            const doubleEncrypted = EncryptionUtil.encryptFields(encrypted, ['secret']);

            // Should still decrypt correctly (not double-encrypted)
            const decrypted = EncryptionUtil.decryptFields(doubleEncrypted, ['secret']);
            expect(decrypted.secret).toBe('value');
        });

        it('should skip non-string fields', () => {
            const obj = { count: 42, active: true, name: 'test' } as Record<string, unknown>;
            const encrypted = EncryptionUtil.encryptFields(obj, ['count', 'active', 'name']);
            expect(encrypted.count).toBe(42);
            expect(encrypted.active).toBe(true);
            expect(encrypted.name).not.toBe('test');
        });

        it('should skip missing fields', () => {
            const obj = { existing: 'value' };
            const encrypted = EncryptionUtil.encryptFields(obj, ['existing', 'nonexistent']);
            expect(EncryptionUtil.isEncrypted(encrypted.existing)).toBe(true);
        });
    });

    describe('generateKey', () => {
        it('should generate a 64-char hex string (32 bytes)', () => {
            const key = EncryptionUtil.generateKey();
            expect(key).toMatch(/^[0-9a-f]{64}$/);
        });

        it('should generate unique keys', () => {
            const key1 = EncryptionUtil.generateKey();
            const key2 = EncryptionUtil.generateKey();
            expect(key1).not.toBe(key2);
        });
    });
});
