import { JaegerTracer } from 'jaeger-client';
export interface TracerConfig {
    serviceName: string;
    collectorEndpoint?: string;
    logSpans?: boolean;
    samplingRate?: number;
}
export declare function createTracer(config: TracerConfig): JaegerTracer;
