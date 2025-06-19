"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTracer = createTracer;
const jaeger_client_1 = require("jaeger-client");
function createTracer(config) {
    const { serviceName, collectorEndpoint = 'http://jaeger-srv:14268/api/traces', logSpans = true, samplingRate = 1 } = config;
    return (0, jaeger_client_1.initTracer)({
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
