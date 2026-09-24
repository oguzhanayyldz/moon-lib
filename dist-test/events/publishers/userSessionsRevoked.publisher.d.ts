import { Publisher, Subjects, UserSessionsRevokedEvent } from '../../common';
/**
 * Hesap duzeyinde oturum iptali publisher'i (TASK-MUFJ7F2IFKC77)
 * NotificationCreatedPublisher ile ayni retry davranisi.
 */
export declare class UserSessionsRevokedPublisher extends Publisher<UserSessionsRevokedEvent> {
    subject: Subjects.UserSessionsRevoked;
    publish(data: UserSessionsRevokedEvent['data']): Promise<void>;
}
//# sourceMappingURL=userSessionsRevoked.publisher.d.ts.map