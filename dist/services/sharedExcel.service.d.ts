/**
 * Shared Excel Service Utilities
 *
 * Ortak excel işlemleri için kullanılır.
 * Tüm microservisler tarafından kullanılabilir.
 */
/**
 * Get user's storage path for excel files
 *
 * @param serviceName - Service name (products, orders, inventory, etc.)
 * @param userId - User ID
 * @returns Storage path
 */
export declare const getUserStoragePath: (serviceName: string, userId: string) => string;
/**
 * Get filename for excel file
 *
 * @param serviceName - Service name
 * @param type - Export or import
 * @param userId - User ID
 * @returns Filename
 */
export declare const getExcelFilename: (serviceName: string, type: "export" | "import", userId: string) => string;
/**
 * Check if current user can access excel job
 *
 * Parent user can access all subUser jobs
 * SubUser can only access their own jobs
 *
 * @param currentUserId - Current user ID
 * @param job - Excel job document
 * @returns True if user can access
 */
export declare const canAccessExcelJob: (currentUserId: string, job: any) => boolean;
/**
 * Calculate expiration date (30 days from now)
 *
 * @returns Expiration date
 */
export declare const getExcelExpirationDate: () => Date;
