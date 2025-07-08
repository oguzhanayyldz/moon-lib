"use strict";
// Client-safe exports - Node.js modülleri olmadan
// Bu dosya Next.js'te kullanılabilir
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
// Client-safe common klasörü kısımları
__exportStar(require("./common/errors"), exports);
__exportStar(require("./common/events"), exports);
__exportStar(require("./common/interfaces"), exports);
__exportStar(require("./common/middlewares"), exports);
__exportStar(require("./common/types"), exports);
__exportStar(require("./common/methods"), exports);
__exportStar(require("./common/core"), exports);
// export * from './common/strategies'; // Node.js bağımlılıkları var
// Utility functions - browser-safe
__exportStar(require("./utils/typeGuards.util"), exports);
