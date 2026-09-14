import { logger } from '../services/logger.service';

/**
 * Result of replaying one dead-letter record:
 * - processed: the event was processed (the record is completed)
 * - failed: processing threw (one attempt of the budget is used)
 * - busy: processing could not start, e.g. the event lock is held (no attempt is used)
 */
export type DeadLetterReplayResult = 'processed' | 'failed' | 'busy';

/** A started listener that can replay its own dead-letter records inside this process. */
export interface DeadLetterReplayTarget {
    readonly subject: string;
    readonly queueGroupName: string;
    /** Processes the record data once. Never publishes to NATS, never acks a message, never writes a dead-letter record. */
    replayDeadLetter(data: unknown): Promise<DeadLetterReplayResult>;
    /** Delay in milliseconds before the next replay of an event that has failed `retryCount` attempts in total. */
    getDeadLetterReplayDelay(retryCount: number): number;
}

/** Identifies the listener that wrote a dead-letter record: one queue group of one subject. */
export function buildListenerKey(subject: string, queueGroupName: string): string {
    return `${subject}|${queueGroupName}`;
}

interface Registration {
    target: DeadLetterReplayTarget;
    replayEnabled: boolean;
}

/**
 * Listeners started in this process, by listener key (issue #648 DLQ-H).
 *
 * DeadLetterProcessorJob claims only the records of listeners registered here with replay enabled and hands each
 * record to its listener instead of publishing it to NATS, so a replay reaches only the queue group that failed.
 * The registry is a separate module so that RetryableListener and DeadLetterProcessorJob do not import each other.
 */
export class DeadLetterReplayRegistry {
    private readonly registrations = new Map<string, Registration>();

    /**
     * Registers a started listener. When a listener with the same key is already registered, the first
     * registration is kept and a warning is logged. Returns whether the listener was registered.
     */
    register(target: DeadLetterReplayTarget, replayEnabled: boolean): boolean {
        const listenerKey = buildListenerKey(target.subject, target.queueGroupName);
        if (this.registrations.has(listenerKey)) {
            logger.warn(`Dead letter replay target already registered, keeping the first listener: ${listenerKey}`);
            return false;
        }
        this.registrations.set(listenerKey, { target, replayEnabled });
        return true;
    }

    /** The listener that replays the records of `listenerKey`, when it is registered with replay enabled. */
    get(listenerKey: string): DeadLetterReplayTarget | undefined {
        const registration = this.registrations.get(listenerKey);
        return registration?.replayEnabled ? registration.target : undefined;
    }

    /** Keys whose records this process may replay. */
    replayableKeys(): string[] {
        return [...this.registrations.entries()]
            .filter(([, registration]) => registration.replayEnabled)
            .map(([listenerKey]) => listenerKey);
    }

    /** Keys of every listener started in this process, including the listeners with replay disabled. */
    registeredKeys(): string[] {
        return [...this.registrations.keys()];
    }

    /** Removes every registration. Intended for tests. */
    clear(): void {
        this.registrations.clear();
    }
}

export const deadLetterReplayRegistry = new DeadLetterReplayRegistry();
