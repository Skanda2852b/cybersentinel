# CyberSentinel Frontend

React/Vite SPA for the CyberSentinel SIEM platform.

## Tech Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (server state) + Zustand (UI state)
- **Forms**: React Hook Form + Zod validation
- **Charts**: Recharts
- **Icons**: Lucide React
- **Routing**: React Router v6

## Project Structure

```
frontend/
├── src/
│   ├── api/              # Axios client, API hooks
│   ├── components/       # Reusable UI components
│   │   └── ui/          # Base UI components (Button, Input, Modal, etc.)
│   ├── layouts/         # Page layouts (Dashboard, Auth)
│   ├── pages/           # Route views
│   │   ├── auth/        # Login, register pages
│   │   ├── dashboard/   # Main dashboard
│   │   ├── alerts/      # Alerts list/detail
│   │   ├── incidents/   # Incidents list/detail
│   │   ├── events/      # Events browser
│   │   ├── analytics/   # Analytics charts
│   │   ├── iocs/        # Threat intelligence
│   │   └── settings/    # User/system settings
│   ├── store/           # Zustand stores (UI, Auth)
│   ├── types/           # TypeScript types
│   └── utils/           # Helpers, formatters
├── public/              # Static assets
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## Key Features

- **Dashboard**: Real-time stats, charts, recent alerts
- **Alerts Management**: Filter, search, investigate, bulk actions
- **Incident Tracking**: Create, assign, timeline, notes
- **Event Browser**: Search raw events with advanced filters
- **Analytics**: Time series, severity distribution, MITRE ATT&CK coverage
- **Threat Intel**: IOC management with tags and confidence
- **Settings**: Profile, security (2FA, API keys), notifications, integrations

## Development

```bash
# Install dependencies
cd frontend
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Lint
npm run lint
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | /api/v1 | Backend API base URL |

## State Management

### TanStack Query (Server State)
- Automatic caching and background refetching
- Optimistic updates for mutations
- Pagination and infinite query support

### Zustand (UI State)
- Sidebar open/close
- Theme preference (light/dark/system)
- Modal states

## Component Library

Base components in `src/components/ui/`:
- `Button` - Primary, secondary, danger, ghost variants
- `Input` - Form input with label, error, helper text
- `Badge` - Status/severity indicators
- `Card` - Content containers with header
- `Modal` - Accessible dialogs
- `Toast` - Notifications (success, error, warning, info)
- `Table` - Sortable, paginated data tables

## API Integration

```typescript
// api/client.ts - Axios instance with interceptors
import { api } from '@/api/client';

// Automatic auth handling, request IDs, error normalization
const response = await api.get('/alerts');
```

## Routing

Protected routes require authentication:
- `/dashboard` - Main dashboard
- `/alerts` - Alerts list
- `/incidents` - Incidents list
- `/events` - Events browser
- `/analytics` - Analytics
- `/iocs` - Threat intelligence
- `/settings` - Settings

Public routes:
- `/login` - Authentication

## Theming

Tailwind CSS with CSS variables for light/dark mode:
- Primary color: Blue (#0ea5e9)
- Semantic colors: Critical, High, Medium, Low, Info
- Dark mode via `dark:` variant and `class` strategy

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
docker-compose up frontend

# Production build
docker build -t cybersentinel-frontend -f frontend/Dockerfile frontend --target production
```