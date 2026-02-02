import { Publisher, Subjects, OrderWorkPackageInfoBulkUpdatedEvent } from '../../common';
export declare class OrderWorkPackageInfoBulkUpdatedPublisher extends Publisher<OrderWorkPackageInfoBulkUpdatedEvent> {
    subject: Subjects.OrderWorkPackageInfoBulkUpdated;
    publish(data: OrderWorkPackageInfoBulkUpdatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=orderWorkPackageInfoBulkUpdated.publisher.d.ts.map