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
class NatsWrapper {
    constructor() {
        this._isConnected = false;
        this._reconnectInterval = 5000;
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
    connect(clusterId, clientId, url) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this._client = node_nats_streaming_1.default.connect(clusterId, clientId, { url });
                this._client.on('connect', () => {
                    logger_service_1.logger.info('Connected to NATS');
                    this._isConnected = true;
                });
                this._client.on('disconnect', () => {
                    logger_service_1.logger.info('Disconnected from NATS');
                    this._isConnected = false;
                    this.attemptReconnect(clusterId, clientId, url);
                });
                return new Promise((resolve, reject) => {
                    this.client.on('connect', () => resolve());
                    this.client.on('error', (err) => reject(err));
                });
            }
            catch (error) {
                logger_service_1.logger.error('Failed to connect to NATS:', error);
                this.attemptReconnect(clusterId, clientId, url);
            }
        });
    }
    attemptReconnect(clusterId, clientId, url) {
        setTimeout(() => {
            logger_service_1.logger.info('Attempting to reconnect to NATS...');
            this.connect(clusterId, clientId, url);
        }, this._reconnectInterval);
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
