export interface ValidatorFuncParams {
    isOptional?: boolean;
    notEmptyClose?: boolean;
    minLength?: number;
    maxLength?: number;
    in?: string;
    matches?: boolean;
    isValidObject?: boolean;
    customArrayObjectControl?: boolean;
    notCustom?: boolean;
    toBoolean?: boolean;
}