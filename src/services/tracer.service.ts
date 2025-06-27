import { initTracer, JaegerTracer } from 'jaeger-client';

export interface TracerConfig {
    serviceName: string;
    collectorEndpoint?: string;
    logSpans?: boolean;
    samplingRate?: number;
}

export function createTracer(config: TracerConfig): JaegerTracer {
    const {
        serviceName,
        collectorEndpoint = 'http://jaeger-srv:14268/api/traces',
        logSpans = true,
        samplingRate = 1
    } = config;

    return initTracer({
        serviceName,
        sampler: {
            type: 'const',
            param: samplingRate,
        },
        reporter: {
            logSpans,
            collectorEndpoint,
        },
    }, {});
}