# CyberSentinel

A production-grade Security Information and Event Management (SIEM) platform with integrated ML-based anomaly detection and AI-assisted investigation.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│  Backend    │────▶│  Database   │
│  (React)    │     │  (Node/TS)  │     │ (PostgreSQL)│
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ ML Service  │
                    │ (Python)    │
                    └─────────────┘
```

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)
- Python 3.11+ (for ML service development)

### Development

```bash
# Clone and enter
cd cybersentinel

# Start all services
npm run dev

# Or start individually
npm run dev:backend    # Backend on http://localhost:3000
npm run dev:frontend   # Frontend on http://localhost:5173
npm run dev:ml         # ML Service on http://localhost:8000
```

### Services
| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React Dashboard |
| Backend API | http://localhost:3000/api/v1 | REST API |
| ML Service | http://localhost:8000 | Anomaly Detection API |
| Database | localhost:5432 | PostgreSQL |

### API Documentation
- Backend: http://localhost:3000/api-docs (when implemented)
- ML Service: http://localhost:8000/docs (FastAPI auto-docs)

## Project Structure

```
cybersentinel/
├── backend/           # Node.js/Express API
├── frontend/          # React/Vite SPA
├── ml-service/        # Python/FastAPI ML Service
├── simulator/         # Attack simulation generator
├── docker-compose.yml
└── README.md
```

## Development Commands

```bash
# Database
npm run db:generate    # Generate Prisma Client
npm run db:migrate     # Run migrations
npm run db:seed        # Seed development data
npm run db:studio      # Open Prisma Studio

# Testing
npm run test           # Run all tests
npm run lint           # Lint all workspaces

# Building
npm run build          # Build all workspaces
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (min 32 chars)
- `JWT_REFRESH_SECRET` - Refresh token secret (min 32 chars)
- `ML_SERVICE_URL` - ML service endpoint
- `INGESTION_API_KEY` - API key for event ingestion

## Security Notes

- JWT tokens stored in HTTP-only, Secure, SameSite cookies
- API key authentication for event ingestion
- Rate limiting on all public endpoints
- Helmet.js for security headers
- Input validation with Zod schemas
- Parameterized queries via Prisma (SQL injection prevention)

## License

MIT