import { Subjects } from "./subjects";
/**
 * Bulten maili gonderim talebi (issue #611)
 *
 * Yayinlayan: auth (broadcast route, abone basina 1 Outbox kaydi)
 * Dinleyen:   notification (mail gonderimi)
 *
 * NEDEN AYRI EVENT (NotificationCreated yeniden kullanilmadi):
 * NotificationCreated.data.userId zorunlu ve notification listener'i bunu dedupe
 * key'i (`email:sent:${userId}:...`), log satiri ve socket hedefi olarak kullaniyor.
 * Bulten abonesi bir User DEGILDIR; oraya sahte bir id koymak dedupe alanini gercek
 * kullanici id'leriyle karistirir ve "su kullaniciya mail gitti" logunu yalanci yapar.
 *
 * GUVENLIK: unsubscribeUrl'i auth HAZIR uretir; ham unsubscribe token'i servisler
 * arasinda dolasmaz (forgotPassword.ts'in resetUrl yaklasiminin aynisi).
 */
export interface NewsletterEmailRequestedEvent {
    subject: Subjects.NewsletterEmailRequested;
    data: {
        /** NewsletterSubscriber dokuman id'si — dedupe ve log icin */
        subscriberId: string;
        email: string;
        subject: string;
        /** Admin panelinden gelen govde; sablon bunu sabit layout icine yerlestirir */
        bodyHtml: string;
        bodyText: string;
        /** ZORUNLU — sablon bunsuz mail uretemez (bkz. buildNewsletterEmail) */
        unsubscribeUrl: string;
        /** Ayni gonderimin tekrar islenmesini engellemek icin */
        broadcastId: string;
        locale: 'tr' | 'en';
    };
}
//# sourceMappingURL=newsletter-email-requested-event.d.ts.map