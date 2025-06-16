import { Publisher, Subjects, PackageProductLinkUpdatedEvent } from '../../common';
export declare class PackageProductLinkUpdatedPublisher extends Publisher<PackageProductLinkUpdatedEvent> {
    subject: Subjects.PackageProductLinkUpdated;
    publish(data: PackageProductLinkUpdatedEvent['data']): Promise<void>;
}
