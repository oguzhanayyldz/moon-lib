/**
 * Brand verisinin content hash'ini hesaplar.
 * Delta sync için kullanılır - hash değişmemişse veri değişmemiştir.
 */
export declare function calculateBrandContentHash(data: {
    name: string;
    code?: string;
    metadata?: Record<string, any>;
}): string;
/**
 * Category verisinin content hash'ini hesaplar.
 * Delta sync için kullanılır - hash değişmemişse veri değişmemiştir.
 */
export declare function calculateCategoryContentHash(data: {
    name: string;
    parentId?: string;
    level?: number;
    isLeaf?: boolean;
    metadata?: Record<string, any>;
}): string;
//# sourceMappingURL=contentHash.d.ts.map