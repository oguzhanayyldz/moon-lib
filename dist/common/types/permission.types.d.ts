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
        [key: string]: any;
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
    readonly CATALOGS: "catalogs";
    readonly INTEGRATIONS: "integrations";
    readonly STOCK: "stock";
    readonly PRICING: "pricing";
    readonly SUBUSERS: "subusers";
    readonly ALL: "*";
};
export type PermissionAction = typeof PERMISSION_ACTIONS[keyof typeof PERMISSION_ACTIONS];
export type PermissionResource = typeof PERMISSION_RESOURCES[keyof typeof PERMISSION_RESOURCES];
export interface PermissionCheck {
    resource: PermissionResource;
    action: PermissionAction;
    constraints?: Permission['constraints'];
}
export interface UserPayloadWithPermissions {
    id: string;
    email: string;
    role: number;
    name?: string;
    surname?: string;
    parentUser?: string | null;
    effectiveUserId?: string;
    actualUserId?: string;
    isSubUser?: boolean;
    permissions?: Permission[];
}
