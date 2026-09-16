"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deadLetterReplayRegistry = exports.DeadLetterReplayRegistry = void 0;
exports.buildListenerKey = buildListenerKey;
const logger_service_1 = require("../services/logger.service");
/** Identifies the listener that wrote a dead-letter record: one queue group of one subject. */
function buildListenerKey(subject, queueGroupName) {
    return `${subject}|${queueGroupName}`;
}
/**
 * Listeners started in this process, by listener key (issue #648 DLQ-H).
 *
 * DeadLetterProcessorJob claims only the records of listeners registered here with replay enabled and hands each
 * record to its listener instead of publishing it to NATS, so a replay reaches only the queue group that failed.
 * The registry is a separate module so that RetryableListener and DeadLetterProcessorJob do not import each other.
 */
class DeadLetterReplayRegistry {
    constructor() {
        this.registrations = new Map();
    }
    /**
     * Registers a started listener. When a listener with the same key is already registered, the first
     * registration is kept and a warning is logged. Returns whether the listener was registered.
     */
    register(target, replayEnabled) {
        const listenerKey = buildListenerKey(target.subject, target.queueGroupName);
        if (this.registrations.has(listenerKey)) {
            logger_service_1.logger.warn(`Dead letter replay target already registered, keeping the first listener: ${listenerKey}`);
            return false;
        }
        this.registrations.set(listenerKey, { target, replayEnabled });
        return true;
    }
    /** The listener that replays the records of `listenerKey`, when it is registered with replay enabled. */
    get(listenerKey) {
        const registration = this.registrations.get(listenerKey);
        return (registration === null || registration === void 0 ? void 0 : registration.replayEnabled) ? registration.target : undefined;
    }
    /** Keys whose records this process may replay. */
    replayableKeys() {
        return [...this.registrations.entries()]
            .filter(([, registration]) => registration.replayEnabled)
            .map(([listenerKey]) => listenerKey);
    }
    /** Keys of every listener started in this process, including the listeners with replay disabled. */
    registeredKeys() {
        return [...this.registrations.keys()];
    }
    /** Removes every registration. Intended for tests. */
    clear() {
        this.registrations.clear();
    }
}
exports.DeadLetterReplayRegistry = DeadLetterReplayRegistry;
exports.deadLetterReplayRegistry = new DeadLetterReplayRegistry();
