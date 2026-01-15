import { Subjects } from '../common';
import { getEventPriority, extractUserIdFromPayload } from '../models/outbox.schema';

/**
 * Event Priority System Tests
 * 
 * Bu testler EventPublisherJob'daki öncelik sistemini doğrular:
 * 1. Event tipine göre doğru priority atanıyor mu?
 * 2. Payload'dan userId doğru çıkarılıyor mu?
 * 3. Sequential priority işleme mantığı doğru mu?
 */
describe('Event Priority System', () => {
    
    describe('getEventPriority', () => {
        
        describe('Priority 1 - Core (User) + Delete', () => {
            it('should return priority 1 for UserCreated', () => {
                expect(getEventPriority(Subjects.UserCreated)).toBe(1);
            });
            
            it('should return priority 1 for UserUpdated', () => {
                expect(getEventPriority(Subjects.UserUpdated)).toBe(1);
            });
            
            it('should return priority 1 for EntityDeleted (delete before create)', () => {
                expect(getEventPriority(Subjects.EntityDeleted)).toBe(1);
            });
        });
        
        describe('Priority 2 - Primary Entity', () => {
            it('should return priority 2 for ProductCreated', () => {
                expect(getEventPriority(Subjects.ProductCreated)).toBe(2);
            });
            
            it('should return priority 2 for ProductUpdated', () => {
                expect(getEventPriority(Subjects.ProductUpdated)).toBe(2);
            });
            
            it('should return priority 2 for OrderCreated', () => {
                expect(getEventPriority(Subjects.OrderCreated)).toBe(2);
            });
            
            it('should return priority 2 for OrderUpdated', () => {
                expect(getEventPriority(Subjects.OrderUpdated)).toBe(2);
            });
            
            it('should return priority 2 for IntegrationCreated', () => {
                expect(getEventPriority(Subjects.IntegrationCreated)).toBe(2);
            });
        });
        
        describe('Priority 3 - Secondary Entity', () => {
            it('should return priority 3 for CombinationCreated', () => {
                expect(getEventPriority(Subjects.CombinationCreated)).toBe(3);
            });
            
            it('should return priority 3 for StockCreated', () => {
                expect(getEventPriority(Subjects.StockCreated)).toBe(3);
            });
            
            it('should return priority 3 for CategoryCreated', () => {
                expect(getEventPriority(Subjects.CategoryCreated)).toBe(3);
            });
            
            it('should return priority 3 for BrandCreated', () => {
                expect(getEventPriority(Subjects.BrandCreated)).toBe(3);
            });
        });
        
        describe('Priority 4 - Integration Data', () => {
            it('should return priority 4 for ProductPriceIntegrationUpdated', () => {
                expect(getEventPriority(Subjects.ProductPriceIntegrationUpdated)).toBe(4);
            });
            
            it('should return priority 4 for ProductStockIntegrationUpdated', () => {
                expect(getEventPriority(Subjects.ProductStockIntegrationUpdated)).toBe(4);
            });
            
            it('should return priority 4 for ProductImageIntegrationUpdated', () => {
                expect(getEventPriority(Subjects.ProductImageIntegrationUpdated)).toBe(4);
            });
            
            it('should return priority 4 for ProductPriceUpdated', () => {
                expect(getEventPriority(Subjects.ProductPriceUpdated)).toBe(4);
            });
        });
        
        describe('Priority 5 - Sync/Notification', () => {
            it('should return priority 5 for EntityVersionUpdated', () => {
                expect(getEventPriority(Subjects.EntityVersionUpdated)).toBe(5);
            });
            
            it('should return priority 5 for NotificationCreated', () => {
                expect(getEventPriority(Subjects.NotificationCreated)).toBe(5);
            });
            
            it('should return priority 5 for SyncRequested', () => {
                expect(getEventPriority(Subjects.SyncRequested)).toBe(5);
            });
        });
        
        describe('Default Priority', () => {
            it('should return priority 3 for unknown event types', () => {
                expect(getEventPriority('unknown:event:type')).toBe(3);
            });
            
            it('should return priority 3 for empty string', () => {
                expect(getEventPriority('')).toBe(3);
            });
        });
    });
    
    describe('extractUserIdFromPayload', () => {
        
        describe('Direct userId field', () => {
            it('should extract userId from payload.userId', () => {
                const payload = { userId: 'user123' };
                expect(extractUserIdFromPayload(payload)).toBe('user123');
            });
            
            it('should extract userId from ProductPriceIntegrationUpdated payload', () => {
                const payload = {
                    requestId: 'req-123',
                    userId: 'user456',
                    data: []
                };
                expect(extractUserIdFromPayload(payload)).toBe('user456');
            });
        });
        
        describe('Direct user field', () => {
            it('should extract user from payload.user', () => {
                const payload = { user: 'user789' };
                expect(extractUserIdFromPayload(payload)).toBe('user789');
            });
            
            it('should extract user from OrderCreated payload', () => {
                const payload = {
                    user: 'order-user-123',
                    orderId: 'order-456'
                };
                expect(extractUserIdFromPayload(payload)).toBe('order-user-123');
            });
        });
        
        describe('Nested list[0].user field', () => {
            it('should extract user from payload.list[0].user (ProductCreated)', () => {
                const payload = {
                    list: [
                        { user: 'list-user-123', id: 'prod-1' },
                        { user: 'list-user-456', id: 'prod-2' }
                    ]
                };
                expect(extractUserIdFromPayload(payload)).toBe('list-user-123');
            });
            
            it('should handle empty list', () => {
                const payload = { list: [] };
                expect(extractUserIdFromPayload(payload)).toBe('_system_');
            });
        });
        
        describe('Nested data field', () => {
            it('should extract userId from payload.data.userId', () => {
                const payload = {
                    data: { userId: 'nested-user-123' }
                };
                expect(extractUserIdFromPayload(payload)).toBe('nested-user-123');
            });
            
            it('should extract user from payload.data.user', () => {
                const payload = {
                    data: { user: 'nested-user-456' }
                };
                expect(extractUserIdFromPayload(payload)).toBe('nested-user-456');
            });
        });
        
        describe('Fallback to _system_', () => {
            it('should return _system_ for empty payload', () => {
                expect(extractUserIdFromPayload({})).toBe('_system_');
            });
            
            it('should return _system_ for null values', () => {
                const payload = { userId: null, user: null };
                expect(extractUserIdFromPayload(payload)).toBe('_system_');
            });
            
            it('should return _system_ for payload without user info', () => {
                const payload = {
                    eventType: 'some:event',
                    data: { someField: 'value' }
                };
                expect(extractUserIdFromPayload(payload)).toBe('_system_');
            });
        });
        
        describe('Priority of extraction', () => {
            it('should prefer userId over user', () => {
                const payload = {
                    userId: 'preferred-user',
                    user: 'fallback-user'
                };
                expect(extractUserIdFromPayload(payload)).toBe('preferred-user');
            });
            
            it('should prefer direct fields over nested', () => {
                const payload = {
                    userId: 'direct-user',
                    list: [{ user: 'nested-user' }]
                };
                expect(extractUserIdFromPayload(payload)).toBe('direct-user');
            });
        });
    });
    
    describe('Sequential Priority Processing Logic', () => {
        
        describe('Priority ordering', () => {
            it('should ensure priority 1 < priority 2 < priority 3 < priority 4 < priority 5', () => {
                const priority1 = getEventPriority(Subjects.UserCreated);
                const priority2 = getEventPriority(Subjects.ProductCreated);
                const priority3 = getEventPriority(Subjects.CombinationCreated);
                const priority4 = getEventPriority(Subjects.ProductPriceIntegrationUpdated);
                const priority5 = getEventPriority(Subjects.EntityVersionUpdated);
                
                expect(priority1).toBeLessThan(priority2);
                expect(priority2).toBeLessThan(priority3);
                expect(priority3).toBeLessThan(priority4);
                expect(priority4).toBeLessThan(priority5);
            });
        });
        
        describe('Race condition prevention', () => {
            it('ProductCreated should have higher priority than ProductPriceIntegrationUpdated', () => {
                const productCreatedPriority = getEventPriority(Subjects.ProductCreated);
                const priceIntegrationPriority = getEventPriority(Subjects.ProductPriceIntegrationUpdated);
                
                expect(productCreatedPriority).toBeLessThan(priceIntegrationPriority);
                // Lower number = higher priority
            });
            
            it('CombinationCreated should have higher priority than ProductPriceIntegrationUpdated', () => {
                const combinationPriority = getEventPriority(Subjects.CombinationCreated);
                const priceIntegrationPriority = getEventPriority(Subjects.ProductPriceIntegrationUpdated);
                
                expect(combinationPriority).toBeLessThan(priceIntegrationPriority);
            });
            
            it('OrderCreated should have higher priority than OrderIntegrationCreated', () => {
                const orderPriority = getEventPriority(Subjects.OrderCreated);
                const orderIntegrationPriority = getEventPriority(Subjects.OrderIntegrationCreated);
                
                expect(orderPriority).toBeLessThan(orderIntegrationPriority);
            });
            
            it('EntityDeleted should have higher priority than ProductCreated (delete before recreate)', () => {
                const deletePriority = getEventPriority(Subjects.EntityDeleted);
                const productCreatedPriority = getEventPriority(Subjects.ProductCreated);
                
                expect(deletePriority).toBeLessThan(productCreatedPriority);
            });
            
            it('EntityDeleted should have higher priority than ProductPriceIntegrationUpdated', () => {
                const deletePriority = getEventPriority(Subjects.EntityDeleted);
                const priceIntegrationPriority = getEventPriority(Subjects.ProductPriceIntegrationUpdated);
                
                expect(deletePriority).toBeLessThan(priceIntegrationPriority);
            });
        });
        
        describe('_system_ user handling', () => {
            it('should return _system_ for UserCreated (no user exists yet)', () => {
                const payload = {
                    id: 'new-user-id',
                    email: 'test@example.com'
                    // No userId or user field
                };
                expect(extractUserIdFromPayload(payload)).toBe('_system_');
            });
        });
    });
    
    describe('Real-world Scenarios', () => {
        
        describe('Shopify Product Sync Scenario', () => {
            it('should correctly prioritize events in order', () => {
                // Shopify'dan ürün çekildiğinde oluşan event'ler
                const events = [
                    { type: Subjects.ProductCreated, priority: getEventPriority(Subjects.ProductCreated) },
                    { type: Subjects.CombinationCreated, priority: getEventPriority(Subjects.CombinationCreated) },
                    { type: Subjects.ProductPriceIntegrationUpdated, priority: getEventPriority(Subjects.ProductPriceIntegrationUpdated) },
                    { type: Subjects.ProductStockIntegrationUpdated, priority: getEventPriority(Subjects.ProductStockIntegrationUpdated) },
                ];
                
                // Priority'ye göre sırala
                const sorted = events.sort((a, b) => a.priority - b.priority);
                
                // ProductCreated ilk olmalı
                expect(sorted[0].type).toBe(Subjects.ProductCreated);
                // CombinationCreated ikinci olmalı
                expect(sorted[1].type).toBe(Subjects.CombinationCreated);
                // Integration events sonra gelmeli
                expect(sorted[2].priority).toBe(4);
                expect(sorted[3].priority).toBe(4);
            });
        });
        
        describe('Multi-user concurrent processing', () => {
            it('should extract different userIds for different users', () => {
                const userAPayload = { userId: 'user-a-123' };
                const userBPayload = { list: [{ user: 'user-b-456' }] };
                
                expect(extractUserIdFromPayload(userAPayload)).toBe('user-a-123');
                expect(extractUserIdFromPayload(userBPayload)).toBe('user-b-456');
                expect(extractUserIdFromPayload(userAPayload)).not.toBe(extractUserIdFromPayload(userBPayload));
            });
        });
    });
});
