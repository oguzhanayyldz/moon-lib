"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseResponseInterpreter = void 0;
const logger_service_1 = require("../logger.service");
/**
 * Abstract base class for response interpreters
 * Platform-specific interpreter'lar bu class'ı extend eder
 */
class BaseResponseInterpreter {
    /**
     * Varsayılan hata yorumlama
     */
    interpretError(error, operationType) {
        var _a;
        const errorMessage = (error === null || error === void 0 ? void 0 : error.message) || ((_a = error === null || error === void 0 ? void 0 : error.data) === null || _a === void 0 ? void 0 : _a.message) || 'Bilinmeyen hata';
        logger_service_1.logger.debug('Interpreting error response', {
            operationType,
            error: errorMessage
        });
        return {
            summary: `İşlem başarısız: ${errorMessage}`,
            success: false,
            successCount: 0,
            failureCount: 1,
            details: {
                error: errorMessage,
                errorCode: (error === null || error === void 0 ? void 0 : error.code) || (error === null || error === void 0 ? void 0 : error.status),
                errorData: error === null || error === void 0 ? void 0 : error.data
            },
            parsedAt: new Date()
        };
    }
    /**
     * Null/empty response kontrolü
     */
    isEmptyResponse(response) {
        return !response ||
            response === null ||
            response === undefined ||
            (typeof response === 'object' && Object.keys(response).length === 0);
    }
    /**
     * Genel başarı durumu kontrolü
     */
    isSuccessResponse(responseStatus) {
        if (!responseStatus)
            return false;
        return responseStatus >= 200 && responseStatus < 300;
    }
}
exports.BaseResponseInterpreter = BaseResponseInterpreter;
