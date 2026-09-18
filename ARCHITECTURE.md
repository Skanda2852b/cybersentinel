# CyberSentinel Architecture Document

## System Overview

CyberSentinel is a modular SIEM platform with three core services:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CYBERSENTINEL ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────────┐     ┌────────────────────────┐  │
│  │   FRONTEND   │────▶│     BACKEND      │────▶│       DATABASE         │  │
│  │   (React)    │     │   (Node.js)      │     │      (PostgreSQL)      │  │
│  │  Port: 80    │     │    Port: 3000    │     │       Port: 5432       │  │
│  └──────────────┘     └────────┬─────────┘     └────────────────────────┘  │
│                                │                                           │
│                    ┌───────────┼───────────┐                              │
│                    ▼           ▼           ▼                              │
│              ┌──────────┐ ┌──────────┐ ┌──────────┐                      │
│              │ ML SVC   │ │ DETECTION│ │   AI     │                      │
│              │ (Python) │ │ ENGINE   │ │ SERVICE  │                      │
│              │ Port 8000│ │          │ │          │                      │
│              └──────────┘ └──────────┘ └──────────┘                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | React + TypeScript | 18.2 | SPA Dashboard |
| | Vite | 5.1 | Build Tool |
| | TanStack Query | 5.x | Server State |
| | Tailwind CSS | 3.4 | Styling |
| | Recharts | 2.12 | Visualizations |
| **Backend** | Node.js | 20.x | Runtime |
| | Express | 4.18 | Web Framework |
| | Prisma ORM | 5.10 | Database Access |
| | JWT (jose) | 5.x | Authentication |
| | Zod | 3.22 | Validation |
| **ML Service** | Python | 3.11+ | Runtime |
| | FastAPI | 0.104 | API Framework |
| | scikit-learn | 1.3 | ML Models |
| | Pandas | 2.1 | Data Processing |
| **Database** | PostgreSQL | 16 | Primary Storage |
| **Cache/Queue** | Redis | 7.x | Caching (future) |
| **Observability** | Prometheus + Grafana | Latest | Metrics/Visualization |
| | Loki + Promtail | Latest | Log Aggregation |

## Service Details

### Frontend (React/Vite)
- **Location**: `/frontend`
- **Port**: 80 (nginx) / 5173 (dev)
- **Key Libraries**: React Router, TanStack Query, Zustand, Lucide React
- **Build**: Vite production bundle
- **Deployment**: nginx static serving

### Backend (Node.js/Express)
- **Location**: `/backend`
- **Port**: 3000
- **Architecture**: Modular monolith with feature modules
- **Modules**:
  - `auth` - Authentication & authorization
  - `events` - Event ingestion & querying
  - `alerts` - Alert management
  - `incidents` - Incident management
  - `iocs` - Threat intelligence
  - `analytics` - Dashboard metrics
  - `ai` - AI investigation
  - `system` - Audit logs, health
- **Middleware**: Auth, Rate Limiting, Request Logging, Error Handling
- **Auth**: JWT in HTTP-only Secure Cookies (users), API Keys (ingestion)

### ML Service (Python/FastAPI)
- **Location**: `/ml-service`
- **Port**: 8000
- **Model**: Isolation Forest (scikit-learn)
- **Features**: Time, categorical, IP, metadata extraction
- **Endpoints**:
  - `POST /api/v1/predict` - Anomaly detection
  - `GET /health` - Health check
  - `GET /api/v1/model/info` - Model metadata
  - `POST /api/v1/model/train` - Retrain model

### Database (PostgreSQL 16)
- **Schema**: 12 tables with proper indexing
- **Key Tables**:
  - `users` - System users (ADMIN/ANALYST/VIEWER)
  - `event_sources` - Registered ingestion sources
  - `events` - Raw security events (BRIN index on timestamp)
  - `detection_rules` - Configurable detection logic
  - `alerts` - Triggered alerts with risk scores
  - `incidents` - Grouped alerts for investigation
  - `iocs` - Threat intelligence indicators
  - `ml_predictions` - ML anomaly scores
  - `audit_logs` - Immutable audit trail
- **Indexes**: BRIN (time-series), GIN (JSONB), BTree (FKs)

## Data Flow

### Event Ingestion Pipeline
```
Event Source (Agent/Syslog/API)
        │
        ▼
┌───────────────────────┐
│  Backend /api/v1/events │
│  (Rate Limit + Auth)    │
└───────────┬─────────────┘
            │
            ▼
┌───────────────────────┐
│  Deduplication        │
│  (SHA256 hash)        │
└───────────┬─────────────┘
            │
            ▼
┌───────────────────────┐
│  Store Event          │
│  (PostgreSQL)         │
└───────────┬─────────────┘
            │
            ▼
┌───────────────────────┐
│  Detection Engine     │
│  (Rule Evaluation)    │
└───────────┬─────────────┘
            │
            ▼
┌───────────────────────┐
│  Create Alerts        │
│  (Risk Scoring)       │
└───────────┬─────────────┘
            │
            ▼
┌───────────────────────┐
│  IOC Matching         │
│  (Threat Intel)       │
└───────────┬─────────────┘
            │
            ▼
┌───────────────────────┐
│  ML Anomaly Detection │
│  (Async, Async)       │
└───────────────────────┘
```

### Detection Engine
- **Rule Format**: JSON logic with conditions (AND/OR)
- **Operators**: equals, not_equals, contains, gt, gte, lt, lte, in, not_in
- **Aggregations**: count, uniqueCount over time windows
- **Grouping**: By sourceIp, destIp, username, eventType
- **Output**: Triggered rules → Alert creation with risk scoring

### Risk Scoring
```
Risk Score = BaseSeverityWeight × RuleConfidence × ContextFactors

BaseSeverityWeight:
  CRITICAL: 100, HIGH: 75, MEDIUM: 50, LOW: 25, INFO: 10

ContextFactors:
  - Source Reputation (IOC matches)
  - Asset Criticality
  - Time of Day (off-hours = higher)
  - User Behavior Baseline
  - ML Anomaly Score (0-1)
```

### ML Anomaly Detection
- **Algorithm**: Isolation Forest (unsupervised)
- **Training**: Synthetic + historical data
- **Features**: Time, event type, severity, IPs, metadata
- **Output**: Anomaly score (0-1), is_anomaly boolean
- **Integration**: Async, updates alert risk scores

## Security Architecture

### Authentication
| Method | Audience | Mechanism |
|--------|----------|-----------|
| JWT Cookies | Dashboard Users | HTTP-only, Secure, SameSite=Strict |
| API Keys | Event Ingestion | X-API-Key header, SHA256 hashed |
| Refresh Tokens | Session Management | Rotated on use, 7-day expiry |

### Authorization (RBAC)
| Role | Permissions |
|------|-------------|
| ADMIN | Full access, user management, system config |
| ANALYST | Read/write alerts/incidents, create IOCs |
| VIEWER | Read-only access |

### Data Protection
- **At Rest**: PostgreSQL encryption (TDE), encrypted ML models
- **In Transit**: TLS 1.3 for all service communication
- **Secrets**: Environment variables, Docker secrets, Vault-ready
- **PII**: Minimal collection, hashed API keys, no plaintext passwords

## Observability

### Metrics (Prometheus)
| Metric | Type | Description |
|--------|------|-------------|
| `cybersentinel_events_total` | Counter | Total events ingested |
| `cybersentinel_alerts_total` | Counter | Total alerts created |
| `cybersentinel_alerts_by_severity` | Gauge | Alerts by severity |
| `cybersentinel_incidents_total` | Counter | Total incidents |
| `cybersentinel_detection_latency_seconds` | Histogram | Detection latency |
| `cybersentinel_ml_anomaly_rate` | Gauge | ML anomaly rate |
| `cybersentinel_detection_engine_evaluations_total` | Counter | Rule evaluations |

### Logging (Loki + Promtail)
- Structured JSON logging (Pino)
- Labels: service, level, trace_id
- Retention: 30 days
- Query: Grafana Explore / LogQL

### Distributed Tracing
- Request ID propagation (X-Request-ID header)
- OpenTelemetry ready (future)

### Health Checks
| Endpoint | Service | Checks |
|----------|---------|--------|
| `/health` | All | Basic liveness |
| `/ready` | Backend | DB connectivity |
| `/health` | ML Service | Model loaded |

## Deployment Architecture

### Docker Compose (Production)
```yaml
services:
  postgres:     # Primary database
  backend:      # Node.js API
  ml-service:   # Python ML API
  frontend:     # Nginx + React
  prometheus:   # Metrics
  grafana:      # Dashboards
  loki:         # Log aggregation
  promtail:     # Log collection
```

### Kubernetes (Future)
- Helm charts for each service
- HorizontalPodAutoscaler for backend/ml-service
- PostgreSQL Operator for DB
- Cert-manager for TLS
- External Secrets Operator

## Scalability Considerations

| Component | Scaling Strategy |
|-----------|------------------|
| Backend | Horizontal (stateless), Redis session cache |
| ML Service | Horizontal, model loaded per replica |
| Database | Read replicas, connection pooling (PgBouncer) |
| Frontend | CDN + nginx, static assets |
| Ingestion | Batch API, async processing |

## Performance Targets

| Metric | Target |
|--------|--------|
| Event Ingestion | 10,000 events/sec |
| Detection Latency | < 100ms (p95) |
| API Response (p95) | < 200ms |
| Dashboard Load | < 2s |
| ML Inference | < 50ms/event |

## Development Workflow

### Local Development
```bash
# Start all services
docker compose up -d

# Backend dev
cd backend && npm run dev

# Frontend dev
cd frontend && npm run dev

# ML service dev
cd ml-service && uvicorn app.main:app --reload
```

### Testing
```bash
# Backend
cd backend && npm run test

# Frontend
cd frontend && npm run test

# ML Service
cd ml-service && pytest

# Integration
docker compose -f docker-compose.ci.yml up --abort-on-container-exit
```

### CI/CD Pipeline (GitHub Actions)
1. Lint & TypeCheck (all services)
2. Unit Tests (parallel)
3. Build Docker Images
4. Integration Tests (docker-compose)
5. Security Scan (Trivy, Snyk)
5. Deploy to Staging
6. Manual Approval → Production

## Future Enhancements

| Area | Planned |
|------|---------|
| **Real-time** | WebSocket for live dashboard updates |
| **SOAR** | Automated response playbooks |
| **Threat Intel** | STIX/TAXII integration, MISP sync |
| **UEBA** | User behavior analytics |
| **Cloud** | AWS/GCP/Azure sensor integrations |
| **Compliance** | SOC2, ISO27001 reporting |
| **Multi-tenancy** | Organization isolation |

## References

- [MITRE ATT&CK Framework](https://attack.mitre.org/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)