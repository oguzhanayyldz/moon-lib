/**
 * Tek alan icin onceki/simdiki deger ciftini tutan diff kaydi.
 * ProductHistory ve CatalogMappingHistory gibi audit log entity'lerinde kullanilir.
 */
export interface FieldDiff {
    previous: unknown;
    current: unknown;
}
/**
 * Primitive ve array alanlar icin derin esitlik kontrolu.
 * ObjectId/Date instance'lari string'e cevrilerek karsilastirilir.
 */
export declare function deepEqualPlain(a: unknown, b: unknown): boolean;
/**
 * Mongoose doc / ObjectId / Date / Map iceren value'yu plain JSON'a cevirir.
 * Audit log diff hesaplamasinda karsilastirma oncesi kullanilir.
 */
export declare function toPlainValue(value: unknown): unknown;
/**
 * Iki obje arasinda alan bazli diff hesaplar.
 * - EXCLUDED_FIELDS icindeki alanlar sonuca dahil edilmez
 * - nestedDiffFields (orn. "integrationData") icindeki objelerin nested key'leri
 *   flat olarak "parent.key" seklinde diff'e girer
 *
 * @param previous Update oncesi snapshot
 * @param current  Update sonrasi snapshot
 * @param options  Haric tutulacak alanlar + nested diff yapilacak alanlar
 */
export interface ComputeEntityDiffOptions {
    excludedFields: Set<string>;
    nestedDiffFields?: Array<{
        parent: string;
        excluded?: Set<string>;
    }>;
}
export declare function computeEntityDiff(previous: Record<string, unknown>, current: Record<string, unknown>, options: ComputeEntityDiffOptions): Record<string, FieldDiff>;
