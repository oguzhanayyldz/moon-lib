import { NewsletterEmailRequestedEvent, Publisher, Subjects } from '../../common';
/**
 * Bulten maili gonderim talebi publisher'i (issue #611)
 * NotificationCreatedPublisher ile ayni retry davranisi.
 */
export declare class NewsletterEmailRequestedPublisher extends Publisher<NewsletterEmailRequestedEvent> {
    subject: Subjects.NewsletterEmailRequested;
    publish(data: NewsletterEmailRequestedEvent['data']): Promise<void>;
}
