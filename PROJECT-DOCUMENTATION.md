# Driver Recruitment Hub - Project Documentation

> **Repository:** https://github.com/nathant30/Xpress_DriverRecruitmentHub

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Backend Components](#backend-components)
- [Frontend Components](#frontend-components)
- [Testing Suite](#testing-suite)
- [Database Schema](#database-schema)
- [Getting Started](#getting-started)
- [Deployment](#deployment)

---

## Overview

The **Driver Recruitment Hub** is a comprehensive recruitment management system for Xpress that handles driver onboarding, tracks source quality, and provides ML-powered predictions to optimize recruitment efforts.

### Key Features

- **Candidate Pipeline Management** - 11-stage pipeline from application to onboarded
- **Source Quality Analytics** - Track and optimize recruitment sources based on post-hire performance
- **ML/AI Intelligence** - 15 ML features for predictions, risk assessment, and optimization
- **OpsTower Integration** - Bidirectional sync with OpsTower V3 for seamless driver transfers
- **Document Management** - Upload, verify, and track required documents
- **Role-Based Access** - Admin, Manager, Recruiter, and Read-Only roles

---

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS |
| **Backend** | Fastify, TypeScript, Prisma ORM |
| **Database** | PostgreSQL |
| **Testing** | Jest, Playwright, k6 |
| **CI/CD** | GitHub Actions |

### Project Structure

```
driver-recruitment-hub/
├── .github/workflows/       # CI/CD pipelines
├── backend/
│   ├── prisma/             # Database schema and migrations
│   ├── src/
│   │   ├── api/            # API route handlers
│   │   ├── middleware/     # Auth, error handling
│   │   ├── services/       # Business logic
│   │   └── config/         # App configuration
│   └── tests/              # Unit and integration tests
├── frontend/
│   └── src/
│       ├── features/       # Feature-based modules
│       ├── app/            # Layouts and routing
│       └── shared/         # Utilities, API client
├── tests/                  # E2E, security, performance tests
└── docs/                   # Documentation
```

---

## Backend Components

### Services

#### 1. Analytics Engine Service (`analytics-engine.service.ts`)

Computes source quality scores based on post-hire performance metrics.

**Key Methods:**
- `calculateSourceQualityScores()` - Calculates scores for all sources in a period
- `getSourceQualityScoreboard()` - Returns ranked list of sources
- `getSourceDetail()` - Detailed metrics for a specific source
- `getRecruiterPerformance()` - Individual recruiter metrics

**Quality Score Formula:**
- 90-Day Retention: 40%
- Completion Rate (30-day): 30%
- Tier Distribution (Bronze+): 30%

#### 2. ML Prediction Service (`ml-prediction.service.ts`)

Provides 15 ML-powered predictions across 4 categories.

**Prediction Categories:**

| Category | Features |
|----------|----------|
| **Prediction** | Pre-hire quality, Drop-off risk, Time-to-onboard, Zone-role fit |
| **Prevention** | Optimal contact time, Next best action, Candidate re-engagement |
| **Optimisation** | Source mix optimisation, Recruiter workload balance, Campaign attribution |
| **Fraud Detection** | Document fraud detection, Duplicate driver detection |

**Key Methods:**
- `predictPreHireQuality()` - Score 0-100 with explainability
- `predictDropOffRisk()` - HIGH/MEDIUM/LOW risk assessment
- `predictOptimalContactTime()` - Best time to reach candidate
- `analyzeDocumentRisk()` - OCR confidence and tampering detection
- `generateAllPredictions()` - Batch generate all predictions

#### 3. OpsTower Integration Service (`opstower-integration.service.ts`)

Handles bidirectional sync with OpsTower V3.

**Features:**
- Automatic driver record creation on onboarding
- Document sync to OpsTower
- Referral bonus trigger for Marketing Hub
- Receive performance snapshots (30/60/90-day)

### API Routes

#### Auth Routes (`/api/auth`)
```
POST /login          # Authenticate user
POST /register       # Create new user
POST /refresh        # Refresh access token
```

#### Candidates Routes (`/api/candidates`)
```
GET    /                    # List candidates
POST   /                    # Create candidate
GET    /:id                 # Get candidate details
PATCH  /:id/stage           # Update pipeline stage
POST   /:id/documents       # Upload document
POST   /:id/transfer-to-opstower  # Transfer to OpsTower
GET    /:id/ml-predictions  # Get ML predictions
```

#### Analytics Routes (`/api/analytics`)
```
GET  /source-quality/scoreboard          # Source quality rankings
GET  /source-quality/detail/:channel     # Source detail
GET  /recruiter-performance              # Recruiter metrics (manager+)
GET  /campaign-quality/:campaignId       # Campaign ROI report
GET  /sync-status                        # Sync health (admin)
POST /calculate-scores                   # Recalculate scores (admin)
```

#### Predictions Routes (`/api/predictions`)
```
GET  /candidates/:id                     # All predictions
GET  /candidates/:id/pre-hire-quality    # Quality prediction
GET  /candidates/:id/drop-off-risk       # Risk assessment
GET  /candidates/:id/time-to-onboard     # Time estimate
GET  /candidates/:id/optimal-contact-time # Best contact time
GET  /batch/drop-off-risk                # High-risk batch
GET  /insights                           # Dashboard insights
```

---

## Frontend Components

### Feature Modules

#### Analytics Dashboard

**Pages:**
- `AnalyticsDashboard.tsx` - Main analytics view

**Components:**
- `SourceQualityScoreboard.tsx` - Ranked source table with tiers
- `FilterBar.tsx` - Period, zone, service type filters
- `TrendChart.tsx` - Quality score trends over time
- `RecruiterPerformanceTable.tsx` - Individual recruiter stats
- `SyncStatusPanel.tsx` - OpsTower sync health

**Features:**
- Gold/Silver/Bronze tier badges
- Conversion rate progress bars
- 90-day retention tracking
- Export to CSV

#### ML Predictions Panel

**Components:**
- `PredictionsPanel.tsx` - Main predictions container
- `QualityScoreCard.tsx` - Pre-hire quality score (0-100)
- `DropOffRiskCard.tsx` - Risk level indicator
- `ChurnRiskCard.tsx` - Post-hire churn prediction
- `OptimalContactCard.tsx` - Best time to contact
- `PredictionExplanationModal.tsx` - Factor breakdown

**Features:**
- Color-coded risk indicators
- Confidence scores
- Explainable factors
- Human confirmation required

#### Candidate Management

**Pages:**
- `CandidatesPage.tsx` - List view with filters
- `CandidateDetailPage.tsx` - Full candidate profile
- `NewCandidatePage.tsx` - Create new candidate

**Components:**
- `TransferToOpsTowerButton.tsx` - One-click transfer
- `DocumentList.tsx` - Document status tracking
- `StageSelector.tsx` - Pipeline stage dropdown
- `ActivityLog.tsx` - Interaction history

### UI Components

- **Card System** - Consistent card styling with headers/bodies
- **Form Inputs** - Text, select, file upload with validation
- **Tables** - Sortable, paginated data tables
- **Modals** - Confirmation dialogs, detail views
- **Toast Notifications** - Success/error feedback

---

## Testing Suite

### Test Categories

#### 1. Unit Tests (Jest)

**Location:** `backend/tests/unit/`

```bash
npm run test:unit
```

**Coverage:**
- Analytics Engine calculations
- ML Prediction algorithms
- Utility functions

**Targets:**
- Statements: 70%
- Branches: 70%
- Functions: 70%
- Lines: 70%

#### 2. Integration Tests (Jest)

**Location:** `backend/tests/integration/`

```bash
npm run test:integration
```

**Coverage:**
- API endpoint contracts
- Database operations
- Authentication flows
- Authorization checks

#### 3. E2E Smoke Tests (Playwright)

**Location:** `frontend/tests/e2e/`

```bash
npm run test:e2e
```

**Scenarios:**
- Login/logout flows
- Candidate CRUD operations
- Analytics dashboard
- ML predictions display
- Cross-browser testing (Chrome, Firefox, Safari)

#### 4. Edge Case Tests (Playwright)

**Location:** `frontend/tests/e2e/edge-cases.spec.ts`

**Coverage:**
- XSS prevention
- SQL injection prevention
- Unicode/international text
- Network interruptions
- Session expiration
- Concurrent sessions

#### 5. Security Tests (k6)

**Location:** `tests/penetration/`

```bash
npm run test:security
```

**Tests:**
- SQL injection attempts
- XSS payload injection
- Authentication bypass
- Path traversal
- Rate limiting
- CSRF protection
- Dependency vulnerabilities (npm audit)

#### 6. Performance Tests (k6)

**Location:** `tests/stress/`

```bash
# Load Test - Ramp to 200 users
npm run test:perf:load

# Spike Test - Sudden 500 user surge
npm run test:perf:spike

# Stress Test - Sustained 500 users
npm run test:perf:stress
```

**Metrics:**
- P95 Response Time < 500ms
- Error Rate < 10%
- Database query time < 100ms

### Running All Tests

```bash
# Quick test suite (unit + integration + e2e)
npm test

# Full QA suite (includes security + performance)
npm run test:all

# CI mode
npm run test:ci
```

---

## Database Schema

### Core Tables

#### Candidate
- Personal info (name, phone, email)
- Pipeline stage tracking
- Source attribution
- Zone and service type assignments
- Bidirectional sync IDs

#### Document
- Document type (Gov ID, License, etc.)
- Status (PENDING, APPROVED, REJECTED)
- File URLs
- OCR confidence scores
- Tampering detection scores

#### InteractionLog
- Recruiter activities
- Stage transitions
- Call/SMS/Email records
- Notes and summaries

#### Analytics Tables
- `SourceQualityScore` - Computed quality metrics
- `DriverPerformanceSnapshot` - Post-hire data from OpsTower
- `MLPrediction` - Historical predictions with feedback

#### ML Tables
- `MLModelConfig` - Feature flags and thresholds
- `MLPrediction` - Prediction history

See `backend/prisma/schema.prisma` for full schema.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm 10+

### Installation

```bash
# Clone repository
git clone https://github.com/nathant30/Xpress_DriverRecruitmentHub.git
cd driver-recruitment-hub

# Install all dependencies
npm run install:all

# Setup database
cd backend
npx prisma migrate deploy
npx prisma db seed
```

### Environment Variables

Create `.env` files:

**Backend (`backend/.env`)**
```env
DATABASE_URL="postgresql://user:password@localhost:5432/driver_recruitment"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="24h"
OPSTOWER_API_URL="https://api.opstower.example.com"
OPSTOWER_API_KEY="your-api-key"
PORT=3001
```

**Frontend (`frontend/.env`)**
```env
VITE_API_URL="http://localhost:3001"
```

### Running Locally

```bash
# Start both frontend and backend
npm run dev

# Or separately:
cd backend && npm run dev    # Backend on :3001
cd frontend && npm run dev   # Frontend on :5173
```

### Test Users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@test.com | AdminPass123! |
| Manager | manager@test.com | ManagerPass123! |
| Recruiter | recruiter@test.com | RecruiterPass123! |

---

## Deployment

### Docker (Recommended)

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Run migrations
docker-compose exec backend npx prisma migrate deploy
```

### Manual Deployment

1. **Database**: Run migrations on production database
2. **Backend**: `npm run build && npm start`
3. **Frontend**: `npm run build` (outputs to `dist/`)
4. **Nginx**: Configure reverse proxy
5. **SSL**: Configure HTTPS certificates

### Environment-Specific Config

**Production:**
- Enable rate limiting
- Set secure cookie flags
- Configure CORS origins
- Enable request logging
- Setup monitoring (Sentry/DataDog)

---

## API Documentation

### Authentication

All protected endpoints require Bearer token:

```http
Authorization: Bearer <jwt-token>
```

### Response Format

**Success:**
```json
{
  "data": { ... },
  "message": "Success message"
}
```

**Error:**
```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Rate Limits

- Authentication: 5 requests/minute
- API general: 100 requests/minute
- File uploads: 10 requests/minute

---

## Monitoring & Observability

### Health Checks

- `GET /health` - Application health
- Database connection status
- External service connectivity

### Metrics

- Response times (P50, P95, P99)
- Error rates by endpoint
- Database query performance
- ML prediction latency

### Logging

- Request/response logging (Pino)
- Error tracking (Sentry)
- Audit logs for sensitive operations

---

## Contributing

### Code Style

- ESLint + Prettier configuration
- Conventional commit messages
- Feature branch workflow

### Pull Request Process

1. Create feature branch
2. Write/update tests
3. Ensure all tests pass
4. Update documentation
5. Submit PR with description

---

## Support

### Troubleshooting

**Database connection errors:**
```bash
# Check PostgreSQL is running
docker-compose ps

# Verify connection
psql $DATABASE_URL -c "SELECT 1"
```

**Test failures:**
```bash
# Clean test data
npm run test:cleanup

# Run specific test
npm run test:unit -- analytics-engine.test.ts
```

**Build errors:**
```bash
# Clean and rebuild
rm -rf node_modules dist
npm run install:all
npm run build
```

---

## License

Proprietary - Xpress Philippines

---

## Changelog

### v1.1.0 (2026-03-30)
- ✅ Analytics Dashboard with Source Quality Scoreboard
- ✅ ML/AI Predictions (15 features)
- ✅ OpsTower V3 Integration
- ✅ Comprehensive QA Test Suite

### v1.0.0 (Initial)
- ✅ Candidate Pipeline Management
- ✅ Document Management
- ✅ User Authentication & RBAC
- ✅ Basic Dashboard

---

**Last Updated:** 2026-03-30  
**Maintainer:** Nathan / Xpress Engineering Team
