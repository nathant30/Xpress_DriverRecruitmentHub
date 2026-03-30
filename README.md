# Xpress Driver Recruitment Hub

End-to-end driver recruitment platform — from lead capture to OpsTower onboarding — across all service types, zones, and acquisition channels.

## Overview

The Driver Recruitment Hub is the system of record for all driver recruitment activity at Xpress. Every candidate enters and progresses through the system here, with a handoff to OpsTower V3 when a candidate reaches the Onboarded stage.

## Architecture

### Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS |
| Backend | Fastify + TypeScript + Prisma + PostgreSQL + Redis |
| Auth | JWT (shared with Marketing Hub & OpsTower) |
| File Storage | AWS S3 |
| OCR | Google ML Kit API / AWS Textract |
| Notifications | Email (Resend) + SMS (Twilio) + WhatsApp |

### Project Structure

```
driver-recruitment-hub/
├── backend/                 # Fastify API
│   ├── src/
│   │   ├── api/            # REST routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, validation
│   │   ├── config/         # App config
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Utilities
│   ├── prisma/
│   │   └── schema.prisma   # Database schema
│   └── package.json
├── src/                     # React Frontend
│   ├── app/                # App setup, router, layouts
│   ├── features/           # Domain features
│   ├── shared/             # Shared components, hooks, utils
│   └── package.json
└── package.json            # Root workspace config
```

## Features

### Core Modules

1. **Candidate Management**
   - Lead capture from multiple channels
   - Pipeline tracking (Kanban & List views)
   - Document checklist & verification
   - Interaction log

2. **Application Flow Builder**
   - Visual drag-and-drop flow designer
   - 11 configurable step types
   - Conditional logic engine
   - Multi-channel support (Driver App, Kiosk, Web)

3. **Analytics & Reporting**
   - Pipeline funnel metrics
   - Headcount targets & gaps
   - Recruiter performance
   - Campaign attribution

4. **Integrations**
   - OpsTower V3 (driver onboarding)
   - Marketing Hub (campaigns, referrals)
   - Driver App (existing driver applications)
   - Field Operator App (lead capture)

### User Roles

- **ADMIN** - Full system access
- **RECRUITMENT_MANAGER** - All candidates, assignments
- **RECRUITER** - Assigned candidates
- **HIRING_MANAGER** - Zone-based read + approvals
- **MARKETING_VIEWER** - Campaign analytics only
- **FIELD_OPERATOR_RECRUITER** - Lead creation only
- **AGENCY** - Own candidates only
- **CANDIDATE** - Portal access only

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# Run database migrations
cd backend && npx prisma migrate dev

# Seed database (optional)
npx prisma db seed

# Start development servers
npm run dev        # Starts both frontend and backend
```

## API Documentation

See `backend/docs/API_REFERENCE.md` for complete endpoint documentation.

## License

MIT - Xpress Technology Services Inc.
