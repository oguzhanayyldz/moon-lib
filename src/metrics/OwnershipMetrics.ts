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
export class OwnershipMetrics {
  private static registry: Registry = new Registry();

  /**
   * Sahiplik reddi sayacı (Counter). Labels: service, resource
   */
  static readonly ownershipDeniedTotal = new Counter({
    name: 'ownership_denied_total',
    help: 'Total number of requests denied because the resource belongs to another tenant (returned as uniform 404)',
    labelNames: ['service', 'resource'],
    registers: [OwnershipMetrics.registry]
  });

  static getRegistry(): Registry {
    return OwnershipMetrics.registry;
  }

  /** Test amaçlı; üretim kodunda kullanılmaz. */
  static reset(): void {
    OwnershipMetrics.ownershipDeniedTotal.reset();
  }
}
