# CyberSentinel Backend

Node.js/Express REST API for the CyberSentinel SIEM platform.

## Tech Stack

- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL 16 with Prisma ORM
- **Authentication**: JWT in HTTP-only Secure Cookies
- **Validation**: Zod schemas
- **Logging**: Pino
- **Testing**: Vitest + Supertest

## Project Structure

```
backend/
├── src/
│   ├── config/          # Environment configuration
│   ├── middleware/      # Express middleware (auth, errors, rate limiting)
│   ├── modules/         # Feature modules (auth, events, alerts, etc.)
│   ├── services/        # Business logic (detection engine, risk scoring)
│   ├── utils/           # Shared utilities (logger, prisma, jwt)
│   ├── app.ts           # Express app setup
│   └── server.ts        # HTTP server bootstrap
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── seed.ts          # Development seed data
├── tests/               # Integration/unit tests
└── package.json
```

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/login` | Public | User login |
| POST | `/api/v1/auth/logout` | User | User logout |
| GET | `/api/v1/auth/me` | User | Current user info |
| POST | `/api/v1/auth/refresh` | Public | Refresh access token |

### Events (Ingestion)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/events` | API Key | Ingest single/batch events |

### Events (Query)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/events` | User | List events with filters |
| GET | `/api/v1/events/:id` | User | Get event details |

### Alerts
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/alerts` | User | List alerts with filters |
| GET | `/api/v1/alerts/:id` | User | Get alert details |
| PATCH | `/api/v1/alerts/:id/status` | User | Update alert status |

### Incidents
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/incidents` | User | List incidents |
| POST | `/api/v1/incidents` | User | Create incident |
| GET | `/api/v1/incidents/:id` | User | Get incident details |
| PATCH | `/api/v1/incidents/:id` | User | Update incident |
| POST | `/api/v1/incidents/:id/notes` | User | Add incident note |

### Analytics
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/analytics/dashboard` | User | Dashboard statistics |
| GET | `/api/v1/analytics/timeseries` | User | Time series data |

### IOCs
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/iocs` | User | List IOCs |
| POST | `/api/v1/iocs` | Admin | Create IOC |
| DELETE | `/api/v1/iocs/:id` | Admin | Delete IOC |

### AI Investigation
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/ai/investigate` | User | AI-assisted investigation |

### System
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | Public | Health check |
| GET | `/ready` | Public | Readiness check |
| GET | `/api/v1/audit-logs` | Admin | Audit logs |

## Environment Variables

See `.env.example` for all variables. Key variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Access token signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | Refresh token signing secret (min 32 chars) |
| `FRONTEND_URL` | Yes | Frontend origin for CORS |
| `INGESTION_API_KEY` | Yes | API key for event ingestion |
| `ML_SERVICE_URL` | No | ML service endpoint |
| `AI_PROVIDER` | No | AI provider (none, openai, local) |

## Development

```bash
# Install dependencies
cd backend
npm install

# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Start development server
npm run dev

# Run tests
npm run test

# Lint
npm run lint

# Build for production
npm run build
```

## Database Schema

Key models:
- **User** - System users with RBAC (ADMIN, ANALYST, VIEWER)
- **EventSource** - Registered data collectors with API keys
- **Event** - Security events with JSONB metadata
- **DetectionRule** - Configurable detection logic
- **Alert** - Triggered alerts with risk scores
- **Incident** - Grouped alerts for investigation
- **IOC** - Indicators of compromise
- **MLPrediction** - ML anomaly scores
- **AuditLog** - Immutable audit trail

Indexes optimized for:
- Time-series queries (BRIN on timestamp)
- IP lookups (BTree on source/dest IP)
- Deduplication (Unique on dedupHash)
- Metadata search (GIN on JSONB)

## Authentication Flow

1. User submits credentials to `/auth/login`
2. Server validates and sets HTTP-only Secure cookies:
   - `access_token` (15 min expiry)
   - `refresh_token` (7 day expiry)
3. Subsequent requests include cookies automatically
4. Access token validated on each request via middleware
5. Refresh token used to obtain new access token
6. Logout clears cookies

## Event Ingestion

Events accepted via `POST /api/v1/events` with `X-API-Key` header:

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "eventType": "ssh_failed_login",
  "severity": "HIGH",
  "sourceIp": "192.168.1.100",
  "destIp": "10.0.0.10",
  "username": "root",
  "metadata": { "attempts": 5, "port": 22 }
}
```

Deduplication via `dedupHash` (SHA256 of normalized event).

## Detection Engine

Rule-based detection with configurable logic:

```json
{
  "condition": "AND",
  "rules": [
    { "field": "eventType", "operator": "equals", "value": "ssh_failed_login" },
    { "field": "count", "operator": "gte", "value": 5, "window": "5m", "groupBy": "sourceIp" }
  ]
}
```

Supported operators: `equals`, `not_equals`, `contains`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`
Window functions: `count`, `uniqueCount`, `sum`, `avg` with time windows

## Risk Scoring

Alert risk score = base_severity_weight × rule_confidence × context_factors

Factors:
- Source reputation (IOC matches)
- Asset criticality
- Time of day
- User behavior baseline
- ML anomaly score

## Testing

```bash
# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test -- --coverage
```

## Docker

```bash
# Development
docker-compose up backend

# Production build
docker build -t cybersentinel-backend -f backend/Dockerfile backend --target production
```