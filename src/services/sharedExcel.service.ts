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
export const getUserStoragePath = (serviceName: string, userId: string): string => {
  return `${userId}/excel/${serviceName}`;
};

/**
 * Get filename for excel file
 *
 * @param serviceName - Service name
 * @param type - Export or import
 * @param userId - User ID
 * @returns Filename
 */
export const getExcelFilename = (serviceName: string, type: 'export' | 'import', userId: string): string => {
  const timestamp = Date.now();
  return `${serviceName}-${type}-${userId}-${timestamp}.xlsx`;
};

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
export const canAccessExcelJob = (currentUserId: string, job: any): boolean => {
  // Own job
  if (job.user.toString() === currentUserId) {
    return true;
  }

  // Parent user can access subUser's job
  if (job.parentUser && job.parentUser.toString() === currentUserId) {
    return true;
  }

  return false;
};

/**
 * Calculate expiration date (30 days from now)
 *
 * @returns Expiration date
 */
export const getExcelExpirationDate = (): Date => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date;
};
