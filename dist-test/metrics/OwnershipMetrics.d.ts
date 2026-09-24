import { Counter, Registry } from 'prom-client';
/**
 * Sahiplik reddi metrikleri (GUV-WP-OWN-M)
 *
 * Kimlikle erişilen kaynakta başka hesaba (tenant) ait kayıt istendiğinde verilen tek tip 404'ün
 * sayacı. Yalnız `service` ve `resource` etiketi taşır; kullanıcı/kiracı kimliği ve kaynak
 * kimliği ETİKET OLMAZ (kardinalite + sızıntı).
 *
 * @example
 * ```typescript
 * OwnershipMetrics.ownershipDeniedTotal.inc({ service: 'inventory', resource: 'workPackage' });
 * ```
 */
export declare class OwnershipMetrics {
    private static registry;
    /**
     * Sahiplik reddi sayacı (Counter). Labels: service, resource
     */
    static readonly ownershipDeniedTotal: Counter<"service" | "resource">;
    static getRegistry(): Registry;
    /** Test amaçlı; üretim kodunda kullanılmaz. */
    static reset(): void;
}
//# sourceMappingURL=OwnershipMetrics.d.ts.map