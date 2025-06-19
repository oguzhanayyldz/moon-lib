import { Publisher, Subjects, PackageProductLinkCreatedEvent } from '../../common';
export declare class PackageProductLinkCreatedPublisher extends Publisher<PackageProductLinkCreatedEvent> {
    subject: Subjects.PackageProductLinkCreated;
    publish(data: PackageProductLinkCreatedEvent['data']): Promise<void>;
}
//# sourceMappingURL=packageProductLinkCreated.publisher.d.ts.map