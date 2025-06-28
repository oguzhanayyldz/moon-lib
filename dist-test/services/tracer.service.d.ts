import { JaegerTracer } from 'jaeger-client';
export interface TracerConfig {
    serviceName: string;
    collectorEndpoint?: string;
    logSpans?: boolean;
    samplingRate?: number;
    agentHost?: string;
    agentPort?: number;
    useUdp?: boolean;
}
export declare function createTracer(config: TracerConfig): JaegerTracer;
//# sourceMappingURL=tracer.service.d.ts.map