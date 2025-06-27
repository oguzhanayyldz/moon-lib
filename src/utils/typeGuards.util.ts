import { logger } from '../services/logger.service';

/**
 * Type guard utilities for enhanced type safety
 * Provides runtime type checking and safe access patterns
 */
export class TypeGuards {
    
    /**
     * Checks if a value is an array
     * @param value - Value to check
     * @returns Type predicate indicating if value is an array
     */
    static isArray<T>(value: unknown): value is T[] {
        return Array.isArray(value);
    }

    /**
     * Checks if a value is defined (not null or undefined)
     * @param value - Value to check
     * @returns Type predicate indicating if value is defined
     */
    static isDefined<T>(value: T | undefined | null): value is T {
        return value !== undefined && value !== null;
    }

    /**
     * Checks if an object has a specific property
     * @param obj - Object to check
     * @param prop - Property name to check for
     * @returns Type predicate indicating if object has the property
     */
    static hasProperty<T, K extends string>(
        obj: T,
        prop: K
    ): obj is T & Record<K, unknown> {
        return typeof obj === 'object' && obj !== null && prop in obj;
    }

    /**
     * Checks if a value is a non-empty string
     * @param value - Value to check
     * @returns Type predicate indicating if value is a non-empty string
     */
    static isNonEmptyString(value: unknown): value is string {
        return typeof value === 'string' && value.trim().length > 0;
    }

    /**
     * Checks if a value is a valid number (not NaN)
     * @param value - Value to check
     * @returns Type predicate indicating if value is a valid number
     */
    static isValidNumber(value: unknown): value is number {
        return typeof value === 'number' && !isNaN(value) && isFinite(value);
    }

    /**
     * Safely accesses an array element at a specific index
     * @param array - Array to access
     * @param index - Index to access
     * @returns Element at index or null if not accessible
     */
    static safeArrayAccess<T>(
        array: T[] | undefined | null,
        index: number
    ): T | null {
        if (!this.isArray(array) || index < 0 || index >= array.length) {
            return null;
        }
        return array[index];
    }

    /**
     * Safely accesses a nested property with dot notation
     * @param obj - Object to access
     * @param path - Dot-separated path (e.g., 'user.profile.name')
     * @returns Property value or null if not accessible
     */
    static safePropertyAccess<T = unknown>(
        obj: unknown,
        path: string
    ): T | null {
        if (!obj || typeof obj !== 'object') {
            return null;
        }

        const keys = path.split('.');
        let current: any = obj;

        for (const key of keys) {
            if (!this.hasProperty(current, key)) {
                return null;
            }
            current = current[key];
        }

        return current as T;
    }

    /**
     * Validates and returns a safe string value
     * @param value - Value to validate
     * @param fallback - Fallback value if validation fails
     * @returns Safe string value
     */
    static safeString(value: unknown, fallback: string = ''): string {
        if (this.isNonEmptyString(value)) {
            return value;
        }
        return fallback;
    }

    /**
     * Validates and returns a safe number value
     * @param value - Value to validate
     * @param fallback - Fallback value if validation fails
     * @returns Safe number value
     */
    static safeNumber(value: unknown, fallback: number = 0): number {
        if (this.isValidNumber(value)) {
            return value;
        }
        return fallback;
    }

    /**
     * Validates tracking info structure for Shopify integration
     * @param trackingInfo - Tracking info to validate
     * @returns Validated tracking info or null
     */
    static validateTrackingInfo(trackingInfo: unknown): {
        number?: string;
        url?: string;
        company?: string;
    } | null {
        if (!trackingInfo || typeof trackingInfo !== 'object') {
            logger.warn('Invalid trackingInfo: not an object', { trackingInfo });
            return null;
        }

        const info = trackingInfo as any;
        const result: { number?: string; url?: string; company?: string } = {};

        if (this.isNonEmptyString(info.number)) {
            result.number = info.number;
        }

        if (this.isNonEmptyString(info.url)) {
            result.url = info.url;
        }

        if (this.isNonEmptyString(info.company)) {
            result.company = info.company;
        }

        return Object.keys(result).length > 0 ? result : null;
    }

    /**
     * Safely extracts tracking info from fulfillments array
     * @param fulfillments - Fulfillments array
     * @param index - Index to access (default: 0)
     * @returns Validated tracking info or null
     */
    static safeTrackingInfoAccess(
        fulfillments: unknown,
        index: number = 0
    ): {
        number?: string;
        url?: string;
        company?: string;
    } | null {
        if (!this.isArray(fulfillments) || fulfillments.length === 0) {
            return null;
        }

        const fulfillment = this.safeArrayAccess(fulfillments, index);
        if (!fulfillment || typeof fulfillment !== 'object') {
            return null;
        }

        const trackingInfoArray = this.safePropertyAccess(fulfillment, 'trackingInfo');
        if (!this.isArray(trackingInfoArray) || trackingInfoArray.length === 0) {
            return null;
        }

        const trackingInfo = this.safeArrayAccess(trackingInfoArray, 0);
        return this.validateTrackingInfo(trackingInfo);
    }
}

// Export individual functions for convenience
export const {
    isArray,
    isDefined,
    hasProperty,
    isNonEmptyString,
    isValidNumber,
    safeArrayAccess,
    safePropertyAccess,
    safeString,
    safeNumber,
    validateTrackingInfo,
    safeTrackingInfoAccess
} = TypeGuards;