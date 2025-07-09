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
export declare const PERMISSION_ACTIONS: {
    readonly READ: "read";
    readonly CREATE: "create";
    readonly UPDATE: "update";
    readonly DELETE: "delete";
    readonly ALL: "*";
};
export declare const PERMISSION_RESOURCES: {
    readonly PRODUCTS: "products";
    readonly ORDERS: "orders";
    readonly INVENTORY: "inventory";
    readonly PRICING: "pricing";
    readonly INTEGRATIONS: "integrations";
    readonly CATALOGS: "catalogs";
    readonly ALL: "*";
};
export type PermissionAction = typeof PERMISSION_ACTIONS[keyof typeof PERMISSION_ACTIONS];
export type PermissionResource = typeof PERMISSION_RESOURCES[keyof typeof PERMISSION_RESOURCES];
