import {
    getPerformerId,
    getDataOwnerId,
    isSubUserMode,
    getParentUserId
} from '../utils/userContext.util';
import { UserPayload } from '../common/middlewares/current-user';

describe('UserContext Utility Functions', () => {
    // Test için kullanılacak ID'ler
    const parentUserId = '507f1f77bcf86cd799439011';
    const subUserId = '507f1f77bcf86cd799439022';

    describe('getPerformerId', () => {
        it('should return subUserId when in SubUser mode', () => {
            const user = {
                id: parentUserId,
                email: 'parent@test.com',
                isSubUserMode: true,
                subUserId: subUserId
            } as UserPayload;

            const result = getPerformerId(user);

            expect(result).toBe(subUserId);
        });

        it('should return user.id when not in SubUser mode', () => {
            const user = {
                id: parentUserId,
                email: 'user@test.com',
                isSubUserMode: false
            } as UserPayload;

            const result = getPerformerId(user);

            expect(result).toBe(parentUserId);
        });

        it('should return user.id when isSubUserMode is true but subUserId is missing', () => {
            const user = {
                id: parentUserId,
                email: 'user@test.com',
                isSubUserMode: true,
                subUserId: undefined
            } as UserPayload;

            const result = getPerformerId(user);

            expect(result).toBe(parentUserId);
        });

        it('should return user.id when isSubUserMode is undefined', () => {
            const user = {
                id: parentUserId,
                email: 'user@test.com'
            } as UserPayload;

            const result = getPerformerId(user);

            expect(result).toBe(parentUserId);
        });

        it('should return user.id when isSubUserMode is false even with subUserId present', () => {
            const user = {
                id: parentUserId,
                email: 'user@test.com',
                isSubUserMode: false,
                subUserId: subUserId
            } as UserPayload;

            const result = getPerformerId(user);

            expect(result).toBe(parentUserId);
        });
    });

    describe('getDataOwnerId', () => {
        it('should always return user.id regardless of SubUser mode', () => {
            const subUserPayload = {
                id: parentUserId,
                email: 'parent@test.com',
                isSubUserMode: true,
                subUserId: subUserId
            } as UserPayload;

            const result = getDataOwnerId(subUserPayload);

            expect(result).toBe(parentUserId);
        });

        it('should return user.id for normal user', () => {
            const normalUser = {
                id: parentUserId,
                email: 'user@test.com',
                isSubUserMode: false
            } as UserPayload;

            const result = getDataOwnerId(normalUser);

            expect(result).toBe(parentUserId);
        });

        it('should never return subUserId even when present', () => {
            const user = {
                id: parentUserId,
                email: 'parent@test.com',
                isSubUserMode: true,
                subUserId: subUserId
            } as UserPayload;

            const result = getDataOwnerId(user);

            expect(result).not.toBe(subUserId);
            expect(result).toBe(parentUserId);
        });
    });

    describe('isSubUserMode', () => {
        it('should return true when isSubUserMode is true AND subUserId exists', () => {
            const user = {
                id: parentUserId,
                email: 'parent@test.com',
                isSubUserMode: true,
                subUserId: subUserId
            } as UserPayload;

            const result = isSubUserMode(user);

            expect(result).toBe(true);
        });

        it('should return false when isSubUserMode is false', () => {
            const user = {
                id: parentUserId,
                email: 'user@test.com',
                isSubUserMode: false
            } as UserPayload;

            const result = isSubUserMode(user);

            expect(result).toBe(false);
        });

        it('should return false when subUserId is missing', () => {
            const user = {
                id: parentUserId,
                email: 'user@test.com',
                isSubUserMode: true
            } as UserPayload;

            const result = isSubUserMode(user);

            expect(result).toBe(false);
        });

        it('should return false when isSubUserMode is undefined', () => {
            const user = {
                id: parentUserId,
                email: 'user@test.com'
            } as UserPayload;

            const result = isSubUserMode(user);

            expect(result).toBe(false);
        });

        it('should return false when subUserId is empty string', () => {
            const user = {
                id: parentUserId,
                email: 'user@test.com',
                isSubUserMode: true,
                subUserId: ''
            } as UserPayload;

            const result = isSubUserMode(user);

            expect(result).toBe(false);
        });

        it('should return false when isSubUserMode is false but subUserId exists', () => {
            const user = {
                id: parentUserId,
                email: 'user@test.com',
                isSubUserMode: false,
                subUserId: subUserId
            } as UserPayload;

            const result = isSubUserMode(user);

            expect(result).toBe(false);
        });
    });

    describe('getParentUserId', () => {
        it('should return user.id for SubUser mode', () => {
            const user = {
                id: parentUserId,
                email: 'parent@test.com',
                isSubUserMode: true,
                subUserId: subUserId
            } as UserPayload;

            const result = getParentUserId(user);

            expect(result).toBe(parentUserId);
        });

        it('should return user.id for normal user', () => {
            const user = {
                id: parentUserId,
                email: 'user@test.com',
                isSubUserMode: false
            } as UserPayload;

            const result = getParentUserId(user);

            expect(result).toBe(parentUserId);
        });

        it('should never return subUserId', () => {
            const user = {
                id: parentUserId,
                email: 'parent@test.com',
                isSubUserMode: true,
                subUserId: subUserId
            } as UserPayload;

            const result = getParentUserId(user);

            expect(result).not.toBe(subUserId);
        });
    });

    describe('Integration Scenarios', () => {
        it('should correctly identify performerId and dataOwnerId for SubUser', () => {
            const user = {
                id: parentUserId,
                email: 'parent@test.com',
                isSubUserMode: true,
                subUserId: subUserId
            } as UserPayload;

            // SubUser modunda:
            // - performerId = subUserId (loglama)
            // - dataOwnerId = parentUserId (veri erişimi)
            expect(getPerformerId(user)).toBe(subUserId);
            expect(getDataOwnerId(user)).toBe(parentUserId);
            expect(isSubUserMode(user)).toBe(true);
            expect(getParentUserId(user)).toBe(parentUserId);
        });

        it('should correctly identify performerId and dataOwnerId for normal user', () => {
            const user = {
                id: parentUserId,
                email: 'user@test.com',
                isSubUserMode: false
            } as UserPayload;

            // Normal modda:
            // - performerId = user.id
            // - dataOwnerId = user.id
            expect(getPerformerId(user)).toBe(parentUserId);
            expect(getDataOwnerId(user)).toBe(parentUserId);
            expect(isSubUserMode(user)).toBe(false);
            expect(getParentUserId(user)).toBe(parentUserId);
        });

        it('should handle edge case: isSubUserMode=true but no subUserId', () => {
            const user = {
                id: parentUserId,
                email: 'user@test.com',
                isSubUserMode: true
            } as UserPayload;

            // subUserId olmadan SubUser mode geçerli değil
            expect(getPerformerId(user)).toBe(parentUserId);
            expect(getDataOwnerId(user)).toBe(parentUserId);
            expect(isSubUserMode(user)).toBe(false);
            expect(getParentUserId(user)).toBe(parentUserId);
        });
    });

    describe('Usage Patterns - StockHistory', () => {
        it('should use getPerformerId for StockHistory.user field', () => {
            // StockHistory.user = işlemi yapan kullanıcı
            const subUser = {
                id: parentUserId,
                email: 'parent@test.com',
                isSubUserMode: true,
                subUserId: subUserId
            } as UserPayload;

            // StockHistory oluştururken:
            // user: getPerformerId(req.currentUser) -> subUserId olmalı
            const stockHistoryUser = getPerformerId(subUser);
            expect(stockHistoryUser).toBe(subUserId);
        });
    });

    describe('Usage Patterns - PriceHistory', () => {
        it('should use getPerformerId for PriceHistory.user field', () => {
            // PriceHistory.user = işlemi yapan kullanıcı
            const subUser = {
                id: parentUserId,
                email: 'parent@test.com',
                isSubUserMode: true,
                subUserId: subUserId
            } as UserPayload;

            // PriceHistory oluştururken:
            // user: getPerformerId(req.currentUser) -> subUserId olmalı
            const priceHistoryUser = getPerformerId(subUser);
            expect(priceHistoryUser).toBe(subUserId);
        });
    });

    describe('Usage Patterns - Data Querying', () => {
        it('should use getDataOwnerId for data filtering', () => {
            // Veri sorgulaması yaparken user filtresi
            const subUser = {
                id: parentUserId,
                email: 'parent@test.com',
                isSubUserMode: true,
                subUserId: subUserId
            } as UserPayload;

            // Sorgu oluştururken:
            // { user: getDataOwnerId(req.currentUser) } -> parentUserId olmalı
            const queryUserId = getDataOwnerId(subUser);
            expect(queryUserId).toBe(parentUserId);
        });
    });
});
