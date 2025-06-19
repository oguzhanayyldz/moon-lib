/**
 * Type guard utilities for enhanced type safety
 * Provides runtime type checking and safe access patterns
 */
export declare class TypeGuards {
    /**
     * Checks if a value is an array
     * @param value - Value to check
     * @returns Type predicate indicating if value is an array
     */
    static isArray<T>(value: unknown): value is T[];
    /**
     * Checks if a value is defined (not null or undefined)
     * @param value - Value to check
     * @returns Type predicate indicating if value is defined
     */
    static isDefined<T>(value: T | undefined | null): value is T;
    /**
     * Checks if an object has a specific property
     * @param obj - Object to check
     * @param prop - Property name to check for
     * @returns Type predicate indicating if object has the property
     */
    static hasProperty<T, K extends string>(obj: T, prop: K): obj is T & Record<K, unknown>;
    /**
     * Checks if a value is a non-empty string
     * @param value - Value to check
     * @returns Type predicate indicating if value is a non-empty string
     */
    static isNonEmptyString(value: unknown): value is string;
    /**
     * Checks if a value is a valid number (not NaN)
     * @param value - Value to check
     * @returns Type predicate indicating if value is a valid number
     */
    static isValidNumber(value: unknown): value is number;
    /**
     * Safely accesses an array element at a specific index
     * @param array - Array to access
     * @param index - Index to access
     * @returns Element at index or null if not accessible
     */
    static safeArrayAccess<T>(array: T[] | undefined | null, index: number): T | null;
    /**
     * Safely accesses a nested property with dot notation
     * @param obj - Object to access
     * @param path - Dot-separated path (e.g., 'user.profile.name')
     * @returns Property value or null if not accessible
     */
    static safePropertyAccess<T = unknown>(obj: unknown, path: string): T | null;
    /**
     * Validates and returns a safe string value
     * @param value - Value to validate
     * @param fallback - Fallback value if validation fails
     * @returns Safe string value
     */
    static safeString(value: unknown, fallback?: string): string;
    /**
     * Validates and returns a safe number value
     * @param value - Value to validate
     * @param fallback - Fallback value if validation fails
     * @returns Safe number value
     */
    static safeNumber(value: unknown, fallback?: number): number;
    /**
     * Validates tracking info structure for Shopify integration
     * @param trackingInfo - Tracking info to validate
     * @returns Validated tracking info or null
     */
    static validateTrackingInfo(trackingInfo: unknown): {
        number?: string;
        url?: string;
        company?: string;
    } | null;
    /**
     * Safely extracts tracking info from fulfillments array
     * @param fulfillments - Fulfillments array
     * @param index - Index to access (default: 0)
     * @returns Validated tracking info or null
     */
    static safeTrackingInfoAccess(fulfillments: unknown, index?: number): {
        number?: string;
        url?: string;
        company?: string;
    } | null;
}
export declare const isArray: typeof TypeGuards.isArray, isDefined: typeof TypeGuards.isDefined, hasProperty: typeof TypeGuards.hasProperty, isNonEmptyString: typeof TypeGuards.isNonEmptyString, isValidNumber: typeof TypeGuards.isValidNumber, safeArrayAccess: typeof TypeGuards.safeArrayAccess, safePropertyAccess: typeof TypeGuards.safePropertyAccess, safeString: typeof TypeGuards.safeString, safeNumber: typeof TypeGuards.safeNumber, validateTrackingInfo: typeof TypeGuards.validateTrackingInfo, safeTrackingInfoAccess: typeof TypeGuards.safeTrackingInfoAccess;
