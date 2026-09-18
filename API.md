# CyberSentinel API Reference

**Base URL**: `https://your-domain.com/api/v1`  
**Authentication**: JWT in HTTP-only Secure Cookies (Users), API Key Header (Ingestion)  
**Content-Type**: `application/json`  
**Rate Limits**: 100 req/min (authenticated), 1000 req/min (ingestion)

---

## Authentication

### User Authentication (JWT Cookies)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | User login, sets HTTP-only cookies |
| `/auth/logout` | POST | User logout, clears cookies |
| `/auth/me` | GET | Get current user info |
| `/auth/refresh` | POST | Refresh access token |

#### Login Request
```json
POST /api/v1/auth/login
{
  "email": "analyst@company.com",
  "password": "secure-password",
  "remember": false
}
```

#### Login Response (200)
```json
{
  "user": {
    "id": "uuid",
    "email": "analyst@company.com",
    "role": "ANALYST",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```
*Sets cookies: `access_token` (15min), `refresh_token` (7 days)*

#### Error Response (401)
```json
{
  "error": "AUTHENTICATION_ERROR",
  "message": "Invalid credentials"
}
```

### Ingestion Authentication (API Key)

```bash
curl -X POST https://api.cybersentinel.com/api/v1/events \
  -H "X-API-Key: cs_abcdef123456..." \
  -H "Content-Type: application/json" \
  -d '{"eventType": "ssh_failed_login", ...}'
```

---

## Events (Ingestion)

### Ingest Single Event

```http
POST /api/v1/events
Headers:
  X-API-Key: cs_xxxxxxxxxxxx
Content-Type: application/json

{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "eventType": "ssh_failed_login",
  "severity": "HIGH",
  "sourceIp": "192.168.1.100",
  "destIp": "10.0.0.10",
  "username": "root",
  "metadata": {
    "attempts": 5,
    "port": 22
  }
}
```

### Ingest Batch Events

```http
POST /api/v1/events
Headers:
  X-API-Key: cs_xxxxxxxxxxxx
Content-Type: application/json

[
  {"timestamp": "...", "eventType": "...", ...},
  {"timestamp": "...", "eventType": "...", ...}
]
```

### Response (201)
```json
{
  "ingested": 100,
  "duplicates": 2,
  "events": [
    {"id": "uuid", "timestamp": "2024-01-15T10:30:45.123Z"},
    ...
  ]
}
```

### Query Events

```http
GET /api/v1/events?page=1&limit=50&startTime=2024-01-15T00:00:00Z&endTime=2024-01-15T23:59:59Z&eventType=ssh_failed_login&severity=HIGH&sourceIp=192.168.1.100
```

#### Response (200)
```json
{
  "data": [...],
  "meta": {
    "total": 1234,
    "page": 1,
    "limit": 50,
    "totalPages": 25
  }
}
```

### Get Event Details

```http
GET /api/v1/events/{eventId}
```

---

## Event Sources

### List Sources
```http
GET /api/v1/event-sources
```

### Create Source
```http
POST /api/v1/event-sources
{
  "name": "Web Server DMZ",
  "type": "NETWORK",
  "description": "DMZ web server syslog"
}
```

#### Response (201)
```json
{
  "id": "uuid",
  "name": "Web Server DMZ",
  "type": "NETWORK",
  "apiKey": "cs_abcdef123456...",
  "apiKeyHash": "sha256...",
  "description": "DMZ web server syslog",
  "isActive": true,
  "createdAt": "2024-01-15T10:30:45.123Z"
}
```

> **Save the `apiKey` immediately - it cannot be retrieved again!**

### Get Source
```http
GET /api/v1/event-sources/{sourceId}
```

### Delete Source
```http
DELETE /api/v1/event-sources/{sourceId}
```

---

## Alerts

### List Alerts
```http
GET /api/v1/alerts?page=1&limit=50&status=OPEN&severity=CRITICAL
```

### Get Alert
```http
GET /api/v1/alerts/{alertId}
```

### Update Alert Status
```http
PATCH /api/v1/alerts/{alertId}/status
{
  "status": "ACKNOWLEDGED"
}
```

Valid statuses: `OPEN`, `ACKNOWLEDGED`, `INVESTIGATING`, `RESOLVED`, `FALSE_POSITIVE`

---

## Incidents

### List Incidents
```http
GET /api/v1/incidents?page=1&limit=20&status=OPEN&severity=HIGH
```

### Create Incident
```http
POST /api/v1/incidents
{
  "title": "SSH Brute Force Campaign",
  "description": "Multiple brute force attacks from same IP range",
  "severity": "HIGH",
  "alertIds": ["uuid1", "uuid2", "uuid3"],
  "assignedUserId": "uuid"
}
```

### Get Incident
```http
GET /api/v1/incidents/{incidentId}
```

### Update Incident
```http
PATCH /api/v1/incidents/{incidentId}
{
  "status": "INVESTIGATING",
  "assignedUserId": "uuid",
  "riskScore": 85
}
```

Valid statuses: `OPEN`, `INVESTIGATING`, `CONTAINED`, `ERADICATED`, `RECOVERED`, `CLOSED`

### Add Incident Note
```http
POST /api/v1/incidents/{incidentId}/notes
{
  "content": "Identified attacker IP range 192.168.1.0/24"
}
```

---

## IOCs (Threat Intelligence)

### List IOCs
```http
GET /api/v1/iocs?page=1&limit=50&type=IP&isActive=true&search=192.168
```

### Create IOC
```http
POST /api/v1/iocs
{
  "type": "IP",
  "value": "192.168.100.50",
  "confidence": 0.95,
  "source": "Threat Feed Alpha",
  "tags": ["malware", "c2", "apt29"],
  "description": "Known APT29 C2 server",
  "isActive": true
}
```

### Get IOC
```http
GET /api/v1/iocs/{iocId}
```

### Delete IOC
```http
DELETE /api/v1/iocs/{iocId}
```

### IOC Types
- `IP` - IPv4/IPv6 address
- `DOMAIN` - Domain name
- `URL` - Full URL
- `HASH_MD5` / `HASH_SHA1` / `HASH_SHA256` - File hashes
- `EMAIL` - Email address
- `CIDR` - IP range
- `REGISTRY_KEY` - Windows registry key
- `MUTEX` - Mutex name

---

## Analytics

### Dashboard Statistics
```http
GET /api/v1/analytics/dashboard
```

#### Response
```json
{
  "totalEvents": 1250000,
  "totalAlerts": 12450,
  "openAlerts": 342,
  "totalIncidents": 89,
  "openIncidents": 12,
  "criticalAlerts": 23,
  "eventsLast24h": 45000,
  "alertsLast24h": 156,
  "topSourceIps": [
    {"ip": "192.168.1.100", "count": 5000},
    {"ip": "203.0.113.50", "count": 3200}
  ],
  "topEventTypes": [
    {"type": "ssh_failed_login", "count": 15000},
    {"type": "connection_attempt", "count": 12000}
  ],
  "severityDistribution": [
    {"severity": "CRITICAL", "count": 45},
    {"severity": "HIGH", "count": 234},
    {"severity": "MEDIUM", "count": 1200},
    {"severity": "LOW", "count": 5600},
    {"severity": "INFO", "count": 25000}
  ],
  "eventsTimeSeries": [...],
  "alertsTimeSeries": [...]
}
```

### Time Series Data
```http
GET /api/v1/analytics/timeseries?metric=events&interval=1h&startTime=2024-01-14T00:00:00Z&endTime=2024-01-15T23:59:59Z
```

---

## AI Investigation

### Investigate Incident
```http
POST /api/v1/ai/investigate
{
  "incidentId": "uuid",
  "context": "Focus on lateral movement patterns"
}
```

#### Response
```json
{
  "incidentId": "uuid",
  "summary": "Incident involves 12 alerts (3 critical, 5 high)...",
  "timeline": [
    {"time": "2024-01-15T10:30:00Z", "event": "SSH Brute Force", "severity": "HIGH", "sourceIp": "192.168.1.100"}
  ],
  "mitreTechniques": [
    {"id": "T1110", "name": "Brute Force", "tactic": "Credential Access", "confidence": 0.9}
  ],
  "recommendations": [
    "Block source IPs at perimeter firewall",
    "Reset compromised credentials"
  ],
  "riskAssessment": {
    "overall": 85,
    "likelihood": 90,
    "impact": 75,
    "confidence": 0.85
  }
}
```

---

## System

### Health Check
```http
GET /health
```
```json
{"status": "ok", "timestamp": "2024-01-15T10:30:45.123Z", "service": "cybersentinel-backend"}
```

### Readiness Check
```http
GET /ready
```
```json
{"status": "ready", "database": "connected"}
```

### Audit Logs
```http
GET /api/v1/audit-logs?page=1&limit=50&userId=uuid&action=ALERT_STATUS_CHANGE
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTHENTICATION_ERROR` | 401 | Invalid/expired credentials |
| `AUTHORIZATION_ERROR` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Pagination

All list endpoints support:
- `page` (default: 1)
- `limit` (default: 50, max: 100)

Response includes:
```json
{
  "meta": {
    "total": 1234,
    "page": 1,
    "limit": 50,
    "totalPages": 25
  }
}
```

---

## Webhooks (Future)

```http
POST /api/v1/webhooks
{
  "url": "https://your-system.com/webhook",
  "events": ["alert.created", "incident.created", "ioc.matched"],
  "secret": "webhook-secret"
}
```