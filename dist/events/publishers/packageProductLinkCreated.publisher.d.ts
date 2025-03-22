import { Publisher, Subjects, PackageProductLinkCreatedEvent } from '@xmoonx/common';
export declare class PackageProductLinkCreatedPublisher extends Publisher<PackageProductLinkCreatedEvent> {
    subject: Subjects.PackageProductLinkCreated;
    publish(data: PackageProductLinkCreatedEvent['data']): Promise<void>;
}
