/**
 * Result of replaying one dead-letter record:
 * - processed: the event was processed (the record is completed)
 * - failed: processing threw (one attempt of the budget is used)
 * - busy: no attempt is used. From replayDeadLetter: processing could not start, e.g. the event lock is held.
 *   DeadLetterProcessorJob also reports a replay that exceeds its time limit as busy, although processing started.
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
export declare function buildListenerKey(subject: string, queueGroupName: string): string;
/**
 * Listeners started in this process, by listener key (issue #648 DLQ-H).
 *
 * DeadLetterProcessorJob claims only the records of listeners registered here with replay enabled and hands each
 * record to its listener instead of publishing it to NATS, so a replay reaches only the queue group that failed.
 * The registry is a separate module so that RetryableListener and DeadLetterProcessorJob do not import each other.
 */
export declare class DeadLetterReplayRegistry {
    private readonly registrations;
    /**
     * Registers a started listener. When a listener with the same key is already registered, the first
     * registration is kept and a warning is logged. Returns whether the listener was registered.
     */
    register(target: DeadLetterReplayTarget, replayEnabled: boolean): boolean;
    /** The listener that replays the records of `listenerKey`, when it is registered with replay enabled. */
    get(listenerKey: string): DeadLetterReplayTarget | undefined;
    /** Keys whose records this process may replay. */
    replayableKeys(): string[];
    /** Keys of every listener started in this process, including the listeners with replay disabled. */
    registeredKeys(): string[];
    /** Removes every registration. Intended for tests. */
    clear(): void;
}
export declare const deadLetterReplayRegistry: DeadLetterReplayRegistry;
