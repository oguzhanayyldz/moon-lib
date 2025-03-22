import { Publisher, Subjects, PackageProductLinkUpdatedEvent } from '@xmoonx/common';
export declare class PackageProductLinkUpdatedPublisher extends Publisher<PackageProductLinkUpdatedEvent> {
    subject: Subjects.PackageProductLinkUpdated;
    publish(data: PackageProductLinkUpdatedEvent['data']): Promise<void>;
}
