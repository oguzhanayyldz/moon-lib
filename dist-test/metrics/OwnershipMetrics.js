"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OwnershipMetrics = void 0;
const prom_client_1 = require("prom-client");
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
class OwnershipMetrics {
    static getRegistry() {
        return OwnershipMetrics.registry;
    }
    /** Test amaçlı; üretim kodunda kullanılmaz. */
    static reset() {
        OwnershipMetrics.ownershipDeniedTotal.reset();
    }
}
exports.OwnershipMetrics = OwnershipMetrics;
OwnershipMetrics.registry = new prom_client_1.Registry();
/**
 * Sahiplik reddi sayacı (Counter). Labels: service, resource
 */
OwnershipMetrics.ownershipDeniedTotal = new prom_client_1.Counter({
    name: 'ownership_denied_total',
    help: 'Total number of requests denied because the resource belongs to another tenant (returned as uniform 404)',
    labelNames: ['service', 'resource'],
    registers: [OwnershipMetrics.registry]
});
//# sourceMappingURL=OwnershipMetrics.js.map