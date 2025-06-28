import { initTracer, JaegerTracer } from 'jaeger-client';

export interface TracerConfig {
    serviceName: string;
    collectorEndpoint?: string;
    logSpans?: boolean;
    samplingRate?: number;
    agentHost?: string;
    agentPort?: number;
    useUdp?: boolean;
}

export function createTracer(config: TracerConfig): JaegerTracer {
    const {
        serviceName,
        collectorEndpoint = 'http://jaeger-srv:14268/api/traces',
        logSpans = false,
        samplingRate = process.env.NODE_ENV === 'development' ? 0 : 1,
        agentHost = 'jaeger-srv',
        agentPort = 6832,
        useUdp = process.env.NODE_ENV === 'development'
    } = config;

    const reporterConfig = useUdp ? {
        logSpans,
        agentHost,
        agentPort,
        flushIntervalMs: 1000,
    } : {
        logSpans,
        collectorEndpoint,
    };

    try {
        return initTracer({
            serviceName,
            sampler: {
                type: 'const',
                param: samplingRate,
            },
            reporter: reporterConfig,
        }, {
            logger: {
                info: () => {},
                error: (msg: string) => {
                    if (process.env.NODE_ENV !== 'development') {
                        console.error(`Jaeger error: ${msg}`);
                    }
                }
            }
        });
    } catch (error) {
        console.warn(`Jaeger tracer initialization failed: ${error}. Continuing without tracing.`);
        return initTracer({
            serviceName,
            disable: true
        }, {});
    }
}