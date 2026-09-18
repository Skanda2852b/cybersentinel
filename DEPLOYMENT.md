# CyberSentinel Production Deployment Guide

## Overview

This guide covers deploying CyberSentinel in a production environment using Docker Compose with full observability stack.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Load Balancer (nginx)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌─────────┐          ┌──────────┐          ┌──────────┐
   │ Frontend│          │ Backend  │          │ ML Svc   │
   │ (nginx) │          │ (Node.js)│          │ (Python) │
   └────┬────┘          └────┬─────┘          └────┬─────┘
        │                    │                     │
        ▼                    ▼                     ▼
   ┌─────────────────────────────────────────────────────────┐
   │                   PostgreSQL 16                         │
   └─────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌──────────┐         ┌──────────┐         ┌──────────┐
   │Prometheus│         │  Loki    │         │ Grafana  │
   └──────────┘         └──────────┘         └──────────┘
```

## Prerequisites

- Docker 24+ and Docker Compose 2.20+
- 8GB+ RAM, 4+ CPU cores
- 50GB+ disk space
- Domain name with SSL certificates (for production)

## Quick Start

```bash
# 1. Clone and configure
git clone <repo>
cd cybersentinel

# 2. Configure environment
cp .env.example .env
# Edit .env with production values

# 3. Deploy
docker compose -f docker-compose.prod.yml up -d

# 4. Verify
docker compose -f docker-compose.prod.yml ps
curl http://localhost/health
```

## Environment Variables

Create `.env` from `.env.example`:

```bash
# Database
POSTGRES_USER=cybersentinel
POSTGRES_PASSWORD=secure-random-password
POSTGRES_DB=cybersentinel

# Backend
JWT_SECRET=64-char-random-string
JWT_REFRESH_SECRET=64-char-random-string
INGESTION_API_KEY=secure-ingestion-key
FRONTEND_URL=https://your-domain.com
VITE_API_URL=https://your-domain.com/api/v1

# ML Service
ML_SERVICE_URL=http://ml-service:8000

# AI (Optional)
AI_PROVIDER=openai
AI_API_KEY=sk-...
AI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4o-mini

# Monitoring
GRAFANA_PASSWORD=secure-admin-password
```

## Service Endpoints

| Service | Internal | External | Health Check |
|---------|----------|----------|--------------|
| Frontend | 80 | 80/443 | /health |
| Backend API | 3000 | /api/v1 | /health, /ready |
| ML Service | 8000 | - | /health, /ready |
| PostgreSQL | 5432 | - | pg_isready |
| Prometheus | 9090 | - | /-/healthy |
| Grafana | 3000 | 3001 | /api/health |
| Loki | 3100 | - | /ready |

## Database Setup

The database is automatically initialized on first run. For manual setup:

```bash
# Run migrations
docker compose -f docker-compose.prod.yml exec backend npm run db:migrate:deploy

# Seed initial data
docker compose -f docker-compose.prod.yml exec backend npm run db:seed
```

Default users created:
- `admin@cybersentinel.local` / `admin123` (ADMIN)
- `analyst@cybersentinel.local` / `analyst123` (ANALYST)

**Change default passwords immediately!**

## SSL/TLS Configuration

For production, terminate SSL at the load balancer (nginx/Traefik/Cloudflare):

```nginx
# nginx.conf example
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/keys/your-domain.key;

    location / {
        proxy_pass http://frontend:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://backend:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring & Alerting

### Prometheus Metrics

Key metrics exposed:

| Metric | Description |
|--------|-------------|
| `cybersentinel_events_total` | Total events ingested |
| `cybersentinel_alerts_total` | Total alerts created |
| `cybersentinel_alerts_by_severity` | Alerts by severity |
| `cybersentinel_incidents_total` | Total incidents |
| `cybersentinel_detection_latency_seconds` | Detection engine latency |
| `cybersentinel_ml_anomaly_rate` | ML anomaly detection rate |
| `cybersentinel_detection_engine_evaluations_total` | Rule evaluations |

### Grafana Dashboards

Pre-built dashboard: **CyberSentinel Overview** (UID: `cybersentinel-overview`)

Access at: `http://grafana:3000` (admin / $GRAFANA_PASSWORD)

### Log Aggregation

Loki + Promtail collect logs from all services. Query in Grafana:

```
{job="cybersentinel-backend"} | json | level="ERROR"
```

### Alerting Rules

Example alert rules in `monitoring/prometheus/rules/`:

```yaml
groups:
  - name: cybersentinel
    rules:
      - alert: HighErrorRate
        expr: rate(cybersentinel_backend_errors_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on backend"

      - alert: HighAlertVolume
        expr: rate(cybersentinel_alerts_created_total[5m]) > 100
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Unusually high alert volume"
```

## Backup & Recovery

### Database Backup

```bash
# Daily backup
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U cybersentinel cybersentinel | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20240115.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U cybersentinel cybersentinel
```

### ML Model Backup

```bash
# Backup models
docker cp cybersentinel-ml-service:/app/models ./ml_models_backup

# Restore
docker cp ./ml_models_backup cybersentinel-ml-service:/app/models
```

## Scaling

### Horizontal Scaling

```yaml
# docker-compose.override.yml
services:
  backend:
    deploy:
      replicas: 3
  ml-service:
    deploy:
      replicas: 2
```

Use with Docker Swarm or Kubernetes for production scaling.

### Database Connection Pooling

Use PgBouncer for connection pooling:

```yaml
pgbouncer:
  image: edoburu/pgbouncer:1.18
  environment:
    DATABASE_URL: postgresql://cybersentinel:password@postgres:5432/cybersentinel
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 100
    DEFAULT_POOL_SIZE: 25
```

## Security Hardening

### Network Policies

```yaml
# Kubernetes NetworkPolicy example
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 3000
```

### Secrets Management

Use Docker secrets or external secret store (Vault, AWS Secrets Manager):

```yaml
secrets:
  jwt_secret:
    external: true
  jwt_refresh_secret:
    external: true
  db_password:
    external: true
```

## Maintenance

### Updates

```bash
# Pull latest images
docker compose -f docker-compose.prod.yml pull

# Rolling update
docker compose -f docker-compose.prod.yml up -d --no-deps backend
```

### Log Rotation

Configured via Loki retention (30 days default). Adjust in `loki-config.yaml`:

```yaml
limits_config:
  retention_period: 30d
```

### Database Maintenance

```bash
# Vacuum analyze (run weekly)
docker compose exec postgres psql -U cybersentinel -c "VACUUM ANALYZE;"

# Reindex (run monthly)
docker compose exec postgres psql -U cybersentinel -c "REINDEX DATABASE cybersentinel;"
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Backend won't start | Check DB connection, JWT secrets, port 3000 |
| ML service unhealthy | Check model file exists, check logs |
| High memory usage | Reduce batch sizes, increase limits |
| Slow queries | Run ANALYZE, check indexes |

### Debug Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f backend

# Access DB
docker compose exec postgres psql -U cybersentinel

# Check ML model
docker exec cybersentinel-ml-service ls -la /app/models/

# Test API
curl -H "X-API-Key: $INGESTION_API_KEY" http://localhost:3000/api/v1/health
```

## Support

- Documentation: `/docs`
- Issues: GitHub Issues
- Security: security@cybersentinel.local