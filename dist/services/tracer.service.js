"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTracer = createTracer;
const jaeger_client_1 = require("jaeger-client");
function createTracer(config) {
    const { serviceName, collectorEndpoint = 'http://jaeger-srv:14268/api/traces', logSpans = false, samplingRate = process.env.NODE_ENV === 'development' ? 0 : 1, agentHost = 'jaeger-srv', agentPort = 6832, useUdp = process.env.NODE_ENV === 'development' } = config;
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
        return (0, jaeger_client_1.initTracer)({
            serviceName,
            sampler: {
                type: 'const',
                param: samplingRate,
            },
            reporter: reporterConfig,
        }, {
            logger: {
                info: () => { },
                error: (msg) => {
                    if (process.env.NODE_ENV !== 'development') {
                        console.error(`Jaeger error: ${msg}`);
                    }
                }
            }
        });
    }
    catch (error) {
        console.warn(`Jaeger tracer initialization failed: ${error}. Continuing without tracing.`);
        return (0, jaeger_client_1.initTracer)({
            serviceName,
            disable: true
        }, {});
    }
}
