"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNatsWrapper = exports.NatsWrapper = void 0;
const node_nats_streaming_1 = __importDefault(require("node-nats-streaming"));
const uuid_1 = require("uuid");
const logger_service_1 = require("./logger.service");
const logSafety_util_1 = require("../utils/logSafety.util");
class NatsWrapper {
    constructor() {
        this._isConnected = false;
        this._closing = false;
        this._connectionLostCallbacks = [];
    }
    get client() {
        if (!this._client) {
            throw new Error("Cannot access NATS client before connecting");
        }
        return this._client;
    }
    get isConnected() {
        return this._isConnected;
    }
    /**
     * Kalıcı bağlantı kaybında (kapanış dışındaki Stan 'close') bir kez çağrılır.
     * Kısa kopmaları nats.js AYNI istemciyle kendisi toparlar ('disconnect' → 'reconnect').
     * Stan 'close' ise istemcinin kalıcı öldüğü anlamına gelir: dinleyiciler, EventPublisherJob ve istemciyi
     * değer olarak tutan her şey ölüdür. Servis bu durumda süreci kapatmalı, k8s yeniden başlatır.
     */
    onConnectionLost(callback) {
        this._connectionLostCallbacks.push(callback);
    }
    /**
     * Kapanışta istemciyi kapatır; bu yoldan gelen 'close' onConnectionLost'u tetiklemez.
     */
    close() {
        var _a;
        this._closing = true;
        (_a = this._client) === null || _a === void 0 ? void 0 : _a.close();
    }
    connect(clusterId, clientId, url) {
        return __awaiter(this, void 0, void 0, function* () {
            let client;
            try {
                client = node_nats_streaming_1.default.connect(clusterId, clientId, { url });
            }
            catch (error) {
                // An invalid URL error (ERR_INVALID_URL) carries the address in `input`; never log the raw error.
                const safeError = (0, logSafety_util_1.sanitizeConnectionError)(error);
                logger_service_1.logger.error('Failed to connect to NATS:', safeError);
                throw (0, logSafety_util_1.toSafeError)(safeError);
            }
            this._client = client;
            this._closing = false;
            let connectedOnce = false;
            let connectionLostNotified = false;
            client.on('disconnect', () => {
                // nats.js reconnects this same client by itself (stan maxReconnectAttempts=-1); never open a second client here.
                logger_service_1.logger.info('Disconnected from NATS');
                this._isConnected = false;
            });
            client.on('reconnect', () => {
                logger_service_1.logger.info('Reconnected to NATS (same client)');
                this._isConnected = true;
            });
            client.on('close', () => {
                this._isConnected = false;
                // Stan can emit 'close' twice (closeWithError and the underlying nats close); notify once.
                if (!connectedOnce || this._closing || connectionLostNotified) {
                    return;
                }
                connectionLostNotified = true;
                logger_service_1.logger.error('NATS connection lost permanently (client closed)');
                this._connectionLostCallbacks.forEach((callback) => callback());
            });
            return new Promise((resolve, reject) => {
                client.on('connect', () => {
                    logger_service_1.logger.info('Connected to NATS');
                    connectedOnce = true;
                    this._isConnected = true;
                    resolve();
                });
                client.on('error', (err) => {
                    // The raw error carries the address (ERR_INVALID_URL etc.); never reject with or log it directly.
                    const safeError = (0, logSafety_util_1.sanitizeConnectionError)(err);
                    if (connectedOnce) {
                        logger_service_1.logger.error('NATS client error:', safeError);
                        return;
                    }
                    reject((0, logSafety_util_1.toSafeError)(safeError));
                });
            });
        });
    }
    /**
     * Request-Reply pattern implementasyonu
     * Stan üzerinde doğrudan request metodu olmadığı için manuel olarak implemente ediyoruz
     */
    request(subject_1, data_1) {
        return __awaiter(this, arguments, void 0, function* (subject, data, options = {}) {
            return new Promise((resolve, reject) => {
                const replyTo = `${subject}.reply.${(0, uuid_1.v4)()}`;
                const timeout = options.timeout || 10000;
                // NATS streaming için subscription
                let subscription;
                // Basit subscribe ile çalış, manuel olarak unsubscribe yap
                subscription = this.client.subscribe(replyTo);
                // Timeout işlemi
                const timeoutId = setTimeout(() => {
                    subscription.unsubscribe();
                    reject(new Error(`Request timeout after ${timeout}ms for ${subject}`));
                }, timeout);
                // Mesaj alındığında
                subscription.on('message', (msg) => {
                    clearTimeout(timeoutId);
                    // Beklenilen cevap geldiğinde manuel unsubscribe
                    subscription.unsubscribe();
                    try {
                        const response = JSON.parse(msg.getData().toString());
                        resolve(response);
                    }
                    catch (err) {
                        reject(err);
                    }
                });
                // İsteği yayınla
                this.client.publish(subject, JSON.stringify(Object.assign(Object.assign({}, data), { replyTo })));
            });
        });
    }
}
exports.NatsWrapper = NatsWrapper;
const createNatsWrapper = () => new NatsWrapper();
exports.createNatsWrapper = createNatsWrapper;
