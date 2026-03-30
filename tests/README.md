# QA Test Suite Documentation

## Overview

This comprehensive QA test suite covers:
- **Unit Tests** - Service and utility testing
- **Integration Tests** - API endpoint testing
- **E2E Smoke Tests** - Critical user flow validation
- **Edge Case Tests** - Boundary and unusual scenario testing
- **Security Tests** - Penetration and vulnerability testing
- **Performance Tests** - Load, stress, and spike testing

## Test Structure

```
tests/
├── README.md                    # This file
├── penetration/                 # Security tests
│   ├── security.test.js        # k6 penetration tests
│   └── dependency-check.js     # NPM audit scanner
├── stress/                      # Performance tests
│   ├── api-load.test.js        # Load testing
│   ├── api-spike.test.js       # Spike testing
│   └── database-stress.test.js # Database stress testing
├── backend/                     # Backend tests
│   ├── unit/                   # Unit tests
│   ├── integration/            # API integration tests
│   └── utils/                  # Test utilities
└── frontend/                    # Frontend E2E tests
    └── e2e/
        ├── smoke.spec.ts       # Smoke tests
        └── edge-cases.spec.ts  # Edge case tests
```

## Running Tests Locally

### Prerequisites

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install

# Install k6 (macOS)
brew install k6

# Install k6 (Linux)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Unit Tests

```bash
cd backend
npm run test:unit

# With coverage
npm run test:unit -- --coverage
```

### Integration Tests

```bash
cd backend
npm run test:integration
```

### E2E Smoke Tests

```bash
cd frontend
npx playwright test tests/e2e/smoke.spec.ts

# With UI
npx playwright test tests/e2e/smoke.spec.ts --ui

# Specific browser
npx playwright test tests/e2e/smoke.spec.ts --project=chromium
```

### Edge Case Tests

```bash
cd frontend
npx playwright test tests/e2e/edge-cases.spec.ts
```

### Security Tests

```bash
# Start application first
npm start &

# Run penetration tests
k6 run tests/penetration/security.test.js

# Run dependency check
node tests/penetration/dependency-check.js
```

### Performance Tests

```bash
# Start application with production settings
NODE_ENV=production npm start &

# Run load test
k6 run tests/stress/api-load.test.js

# Run spike test
k6 run tests/stress/api-spike.test.js

# Run stress test
k6 run tests/stress/database-stress.test.js
```

## Test Categories

### 1. Smoke Tests
Critical path validation:
- Login/logout flows
- Navigation between pages
- Candidate creation
- Analytics dashboard loading
- ML predictions display

### 2. Edge Case Tests
Boundary and unusual scenarios:
- Empty states
- Long text inputs
- Special characters
- Unicode/international text
- XSS prevention
- SQL injection prevention
- Rapid user interactions
- Network interruptions

### 3. Security Tests
Vulnerability assessment:
- SQL injection attempts
- XSS payload injection
- Authentication bypass
- Authorization checks
- Rate limiting
- Information disclosure
- CSRF protection
- Input validation

### 4. Performance Tests
Load and stress testing:
- **Load Test**: Gradual ramp to 200 concurrent users
- **Spike Test**: Sudden surge to 500 users
- **Stress Test**: Sustained high load (500 users)
- **Database Stress**: Heavy write/query operations

## Test Data

### Test Users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@test.com | AdminPass123! |
| Recruiter | recruiter@test.com | RecruiterPass123! |
| Manager | manager@test.com | ManagerPass123! |

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# JWT
JWT_SECRET=your-secret-key

# OpsTower (mock for testing)
OPSTOWER_API_URL=http://localhost:3002
OPSTOWER_API_KEY=test-key
```

## CI/CD Integration

Tests run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Daily at 2 AM UTC (full suite)

### Pipeline Stages

1. **Unit Tests** - Fast feedback on code changes
2. **Integration Tests** - API contract validation
3. **Smoke Tests** - Critical path verification
4. **Security Tests** - Vulnerability scanning
5. **Edge Case Tests** - Boundary condition validation
6. **Performance Tests** - Scheduled daily or on-demand

## Test Metrics

### Coverage Thresholds

- Statements: 70%
- Branches: 70%
- Functions: 70%
- Lines: 70%

### Performance Thresholds

- P95 Response Time: < 500ms (normal), < 1000ms (spike)
- Error Rate: < 10% (normal), < 20% (spike)
- Database Query Time: < 100ms

## Debugging Tests

### Backend Tests

```bash
# Debug mode
npm run test:unit -- --verbose

# Single test file
npm run test:unit -- analytics-engine.test.ts

# With debugger
node --inspect-brk node_modules/.bin/jest analytics-engine.test.ts
```

### Frontend Tests

```bash
# Debug mode
npx playwright test --debug

# Trace viewer
npx playwright show-trace trace.zip

# Video replay
# Videos saved in test-results/
```

### Performance Tests

```bash
# With detailed output
k6 run --verbose tests/stress/api-load.test.js

# Export to various formats
k6 run --out json=results.json tests/stress/api-load.test.js
k6 run --out influxdb=http://localhost:8086/k6 tests/stress/api-load.test.js
```

## Adding New Tests

### Unit Test Example

```typescript
// backend/tests/unit/services/my-service.test.ts
import { describe, it, expect } from '@jest/globals';
import { MyService } from '../../../src/services/my-service';

describe('MyService', () => {
  it('should do something', async () => {
    const result = await MyService.doSomething();
    expect(result).toBeDefined();
  });
});
```

### E2E Test Example

```typescript
// frontend/tests/e2e/my-feature.spec.ts
import { test, expect } from '@playwright/test';

test('my feature', async ({ page }) => {
  await page.goto('/my-feature');
  await expect(page.locator('text=Expected')).toBeVisible();
});
```

### Security Test Example

```javascript
// tests/penetration/my-feature.test.js
import http from 'k6/http';
import { check } from 'k6';

export default function () {
  const res = http.get('http://localhost:3001/api/my-endpoint');
  check(res, {
    'status is 401': (r) => r.status === 401,
  });
}
```

## Troubleshooting

### Common Issues

**Database connection errors:**
```bash
# Ensure PostgreSQL is running
docker-compose up -d postgres

# Run migrations
npx prisma migrate deploy
```

**Port conflicts:**
```bash
# Check what's using port 3001
lsof -i :3001

# Kill process or change port
kill -9 <PID>
```

**Playwright browser issues:**
```bash
# Reinstall browsers
npx playwright install --with-deps
```

## Reporting

Test reports are generated in:
- **Unit Tests**: `backend/coverage/`
- **E2E Tests**: `frontend/playwright-report/`
- **Performance**: `load-test-results.json`
- **Security**: `security-test-results.json`

Upload to CI artifacts for review.

## Maintenance

- Update tests when adding new features
- Review and update thresholds quarterly
- Run full suite before major releases
- Keep test data current with schema changes
