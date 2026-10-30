"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Listener = void 0;
const logger_service_1 = require("../../services/logger.service");
class Listener {
    constructor(client) {
        this.ackWait = 5 * 1000;
        this.client = client;
    }
    subscriptionOptions() {
        return this.client
            .subscriptionOptions()
            .setStartWithLastReceived()
            .setManualAckMode(true)
            .setAckWait(this.ackWait)
            .setDurableName(this.queueGroupName);
    }
    listen() {
        const subscription = this.client.subscribe(this.subject, this.queueGroupName, this.subscriptionOptions());
        subscription.on('message', (msg) => {
            // Hata yakalanmazsa olay döngüsüne (ayrıştırma) ya da unhandledRejection'a (async onMessage) düşer:
            // servisler çöker ya da kapanır (UC-835). Mesaj ack'lenmez, NATS yeniden teslim eder.
            let result;
            try {
                const parsedData = this.parseMessage(msg);
                result = this.onMessage(parsedData, msg);
            }
            catch (error) {
                this.logUnhandledError(msg, error);
                return;
            }
            if (result instanceof Promise) {
                result.catch(error => this.logUnhandledError(msg, error));
            }
        });
    }
    logUnhandledError(msg, error) {
        var _a;
        logger_service_1.logger.error(`Unhandled error in ${this.constructor.name} for ${this.subject} (seq: ${(_a = msg.getSequence) === null || _a === void 0 ? void 0 : _a.call(msg)}), message not acked, NATS will redeliver:`, error);
    }
    parseMessage(msg) {
        const data = msg.getData();
        const parsed = typeof data === 'string'
            ? JSON.parse(data)
            : JSON.parse(data.toString('utf8'));
        return parsed;
    }
}
exports.Listener = Listener;
//# sourceMappingURL=base-listener.js.map