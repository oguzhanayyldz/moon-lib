import { ResourceName } from '../../common';
import { BaseResponseInterpreter } from './base.interpreter';
/**
 * Response Interpreter Factory
 * Platform'a göre uygun interpreter instance'ını döndürür
 */
export declare class ResponseInterpreterFactory {
    private static interpreters;
    /**
     * Platform'a göre interpreter döndür
     */
    static getInterpreter(integrationName: ResourceName): BaseResponseInterpreter | null;
    /**
     * Cache'i temizle (test için kullanılabilir)
     */
    static clearCache(): void;
}
