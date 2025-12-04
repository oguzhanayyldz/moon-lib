"use strict";
/**
 * Shared Excel Service Utilities
 *
 * Ortak excel işlemleri için kullanılır.
 * Tüm microservisler tarafından kullanılabilir.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExcelExpirationDate = exports.canAccessExcelJob = exports.getExcelFilename = exports.getUserStoragePath = void 0;
/**
 * Get user's storage path for excel files
 *
 * @param serviceName - Service name (products, orders, inventory, etc.)
 * @param userId - User ID
 * @returns Storage path
 */
const getUserStoragePath = (serviceName, userId) => {
    return `${userId}/excel/${serviceName}`;
};
exports.getUserStoragePath = getUserStoragePath;
/**
 * Get filename for excel file
 *
 * @param serviceName - Service name
 * @param type - Export or import
 * @param userId - User ID
 * @returns Filename
 */
const getExcelFilename = (serviceName, type, userId) => {
    const timestamp = Date.now();
    return `${serviceName}-${type}-${userId}-${timestamp}.xlsx`;
};
exports.getExcelFilename = getExcelFilename;
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
const canAccessExcelJob = (currentUserId, job) => {
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
exports.canAccessExcelJob = canAccessExcelJob;
/**
 * Calculate expiration date (30 days from now)
 *
 * @returns Expiration date
 */
const getExcelExpirationDate = () => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
};
exports.getExcelExpirationDate = getExcelExpirationDate;
