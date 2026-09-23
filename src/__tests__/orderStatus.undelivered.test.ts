import {
    OrderStatus,
    ORDER_STATUS_PRIORITY,
    isValidStatusTransition,
    isForwardCargoTransition,
    getSkippedStatuses,
    isActiveOrderStatus,
    getNextPossibleStatuses
} from '../common/events/types/order-status';

/**
 * `Undelivered` (teslim edilemedi) statüsü testleri (TASK-MUEI25Y8MJ7EH PR-2)
 *
 * Bugüne kadar platformların "teslim edilemedi" statüsü `Failed`'a eşleniyordu; `Failed` ödeme/oluşturma
 * hatasını da taşıdığı için tüketiciler iki olayı ayıramıyordu. Bu testler yeni değerin geçiş kurallarını
 * sabitler ve `Failed`'ın eski davranışının DEĞİŞMEDİĞİNİ doğrular.
 */
describe('OrderStatus.Undelivered', () => {
    it('kalıcı değer "undelivered" (DB ve olay sözleşmesi bu dizgeyi taşır)', () => {
        expect(OrderStatus.Undelivered).toBe('undelivered');
        expect(Object.values(OrderStatus)).toContain('undelivered');
    });

    it('her enum değerinin önceliği var (eksik değer kargo geçişini sessizce 0 sayar)', () => {
        for (const status of Object.values(OrderStatus)) {
            expect(typeof ORDER_STATUS_PRIORITY[status]).toBe('number');
        }
    });

    it('teslim edilemedi, bitmiş statü sayılmaz: iade/yeniden teslim beklenir', () => {
        expect(isActiveOrderStatus(OrderStatus.Undelivered)).toBe(true);
    });

    describe('katı geçiş haritası (isValidStatusTransition)', () => {
        it.each([
            OrderStatus.Shipped,
            OrderStatus.InTransit,
            OrderStatus.OutForDelivery
        ])('%s → undelivered geçerli', from => {
            expect(isValidStatusTransition(from, OrderStatus.Undelivered)).toBe(true);
        });

        it('undelivered → yalnız delivered / returned / cancelled', () => {
            expect(getNextPossibleStatuses(OrderStatus.Undelivered)).toEqual([
                OrderStatus.Delivered,
                OrderStatus.Returned,
                OrderStatus.Cancelled
            ]);
            expect(isValidStatusTransition(OrderStatus.Undelivered, OrderStatus.Processing)).toBe(false);
            expect(isValidStatusTransition(OrderStatus.Undelivered, OrderStatus.InTransit)).toBe(false);
        });

        it('teslim edilmiş sipariş teslim edilemedi olamaz', () => {
            expect(isValidStatusTransition(OrderStatus.Delivered, OrderStatus.Undelivered)).toBe(false);
        });
    });

    describe('kargo geçişi (isForwardCargoTransition)', () => {
        it.each([
            OrderStatus.Processing,
            OrderStatus.Prepared,
            OrderStatus.Shipped,
            OrderStatus.InTransit,
            OrderStatus.OutForDelivery
        ])('%s → undelivered ileri sayılır', from => {
            expect(isForwardCargoTransition(from, OrderStatus.Undelivered)).toBe(true);
        });

        it.each([
            OrderStatus.Delivered,
            OrderStatus.Returned,
            OrderStatus.OnHold,
            OrderStatus.Cancelled,
            OrderStatus.Completed
        ])('%s → undelivered engellenir', from => {
            expect(isForwardCargoTransition(from, OrderStatus.Undelivered)).toBe(false);
        });

        it.each([
            OrderStatus.Delivered,
            OrderStatus.Returned,
            OrderStatus.Cancelled
        ])('undelivered → %s ilerler', to => {
            expect(isForwardCargoTransition(OrderStatus.Undelivered, to)).toBe(true);
        });

        it('undelivered → kargo ara statülerine geri dönülmez', () => {
            expect(isForwardCargoTransition(OrderStatus.Undelivered, OrderStatus.OutForDelivery)).toBe(false);
            expect(isForwardCargoTransition(OrderStatus.Undelivered, OrderStatus.InTransit)).toBe(false);
        });
    });

    describe('atlanan statüler (getSkippedStatuses)', () => {
        it('mutlu yol atlamasında undelivered listelenmez', () => {
            expect(getSkippedStatuses(OrderStatus.Prepared, OrderStatus.Delivered)).toEqual([
                OrderStatus.Packing,
                OrderStatus.Packaged,
                OrderStatus.ReadyToShip,
                OrderStatus.Shipped,
                OrderStatus.InTransit,
                OrderStatus.OutForDelivery
            ]);
            expect(getSkippedStatuses(OrderStatus.OutForDelivery, OrderStatus.Delivered)).toEqual([]);
        });

        it('undelivered hedefe atlamada ara kargo statüleri listelenir', () => {
            expect(getSkippedStatuses(OrderStatus.Shipped, OrderStatus.Undelivered)).toEqual([
                OrderStatus.InTransit,
                OrderStatus.OutForDelivery
            ]);
        });
    });

    describe('Failed davranışı değişmedi', () => {
        it('katı harita: kargo statülerinden failed, failed → processing/cancelled', () => {
            expect(isValidStatusTransition(OrderStatus.InTransit, OrderStatus.Failed)).toBe(true);
            expect(isValidStatusTransition(OrderStatus.OutForDelivery, OrderStatus.Failed)).toBe(true);
            expect(getNextPossibleStatuses(OrderStatus.Failed)).toEqual([
                OrderStatus.Processing,
                OrderStatus.Cancelled
            ]);
        });

        it('kargo yolu: her aktif statüden failed, failed bitmiş statüdür', () => {
            expect(isForwardCargoTransition(OrderStatus.Delivered, OrderStatus.Failed)).toBe(true);
            expect(isForwardCargoTransition(OrderStatus.Failed, OrderStatus.Delivered)).toBe(false);
            expect(isActiveOrderStatus(OrderStatus.Failed)).toBe(false);
        });
    });
});
