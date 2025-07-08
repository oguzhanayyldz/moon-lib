// Permission interface and constants for SubUser role management

export interface Permission {
    resource: string;
    actions: string[];
    constraints?: {
        warehouses?: string[];
        categories?: string[];
        priceRange?: {
            min: number;
            max: number;
        };
    };
}

export const PERMISSION_ACTIONS = {
    READ: 'read',
    CREATE: 'create',
    UPDATE: 'update', 
    DELETE: 'delete',
    ALL: '*'
} as const;

export const PERMISSION_RESOURCES = {
    PRODUCTS: 'products',
    ORDERS: 'orders',
    INVENTORY: 'inventory',
    PRICING: 'pricing',
    INTEGRATIONS: 'integrations',
    CATALOGS: 'catalogs',
    ALL: '*'
} as const;

export type PermissionAction = typeof PERMISSION_ACTIONS[keyof typeof PERMISSION_ACTIONS];
export type PermissionResource = typeof PERMISSION_RESOURCES[keyof typeof PERMISSION_RESOURCES];