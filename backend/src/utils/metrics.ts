import { register, Counter, Histogram, Gauge } from 'prom-client';

export const httpRequestsTotal = new Counter({
  name: 'cybersentinel_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDuration = new Histogram({
  name: 'cybersentinel_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

export const eventsIngestedTotal = new Counter({
  name: 'cybersentinel_events_ingested_total',
  help: 'Total number of events ingested',
  labelNames: ['source_type', 'severity'],
});

export const alertsCreatedTotal = new Counter({
  name: 'cybersentinel_alerts_created_total',
  help: 'Total number of alerts created',
  labelNames: ['severity', 'rule_id'],
});

export const alertsBySeverity = new Gauge({
  name: 'cybersentinel_alerts_by_severity',
  help: 'Current number of alerts by severity',
  labelNames: ['severity', 'status'],
});

export const incidentsTotal = new Gauge({
  name: 'cybersentinel_incidents_total',
  help: 'Current number of incidents',
  labelNames: ['status'],
});

export const mlAnomalyRate = new Gauge({
  name: 'cybersentinel_ml_anomaly_rate',
  help: 'Rate of ML-detected anomalies',
});

export const detectionLatency = new Histogram({
  name: 'cybersentinel_detection_latency_seconds',
  help: 'Detection engine latency in seconds',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

export function metricsMiddleware(req: any, res: any, next: any) {
  const end = httpRequestDuration.startTimer({ method: req.method, route: req.path });
  res.on('finish', () => {
    httpRequestsTotal.inc({
      method: req.method,
      route: req.path,
      status_code: res.statusCode,
    });
    end({ method: req.method, route: req.path });
  });
  next();
}

export async function metricsHandler(_req: any, res: any) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

export default { httpRequestsTotal, httpRequestDuration, eventsIngestedTotal, alertsCreatedTotal, alertsBySeverity, incidentsTotal, mlAnomalyRate, detectionLatency, metricsMiddleware, metricsHandler };
