"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Listener = void 0;
const encryption_util_1 = require("../../utils/encryption.util");
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
            // Message received
            const parsedData = this.parseMessage(msg);
            this.onMessage(parsedData, msg);
            // msg.ack();
        });
    }
    parseMessage(msg) {
        const data = msg.getData();
        const parsed = typeof data === 'string'
            ? JSON.parse(data)
            : JSON.parse(data.toString('utf8'));
        // Outbox payload encryption: şifreli payload'ı decrypt et
        if (parsed && parsed._encrypted && typeof parsed._encrypted === 'string' && process.env.ENCRYPTION_KEY) {
            try {
                const decrypted = encryption_util_1.EncryptionUtil.decrypt(parsed._encrypted);
                return JSON.parse(decrypted);
            }
            catch (_a) {
                // Decrypt başarısız olursa orijinal parsed veriyi dön (backward compat)
                return parsed;
            }
        }
        return parsed;
    }
}
exports.Listener = Listener;
