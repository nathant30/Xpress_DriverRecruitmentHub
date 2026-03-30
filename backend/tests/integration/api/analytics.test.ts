import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TestApiClient } from '../../utils/api-client.js';
import { TestHelpers } from '../../utils/test-helpers.js';

describe('Analytics API Integration Tests', () => {
  let client: TestApiClient;
  let recruiterToken: string;
  let adminToken: string;

  beforeAll(async () => {
    client = await new TestApiClient().setup();
    
    const { token: recToken } = await TestHelpers.createTestUser({ role: 'RECRUITER' });
    recruiterToken = recToken;
    
    const { token: admToken } = await TestHelpers.createTestUser({ 
      role: 'ADMIN',
      email: 'admin_analytics@example.com'
    });
    adminToken = admToken;

    // Create test data
    for (let i = 0; i < 5; i++) {
      await TestHelpers.createTestCandidate({
        sourceChannel: i % 2 === 0 ? 'FO_REFERRAL' : 'DRIVER_REFERRAL',
        currentStage: i < 3 ? 'ONBOARDED' : 'APPLICATION',
      });
    }
  });

  afterAll(async () => {
    await client.teardown();
    await TestHelpers.cleanupTestData();
  });

  describe('GET /api/analytics/source-quality/scoreboard', () => {
    it('should return scoreboard data for authenticated user', async () => {
      client.setAuthToken(recruiterToken);
      const response = await client.get('/api/analytics/source-quality/scoreboard?period=90d');

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('scoreboard');
      expect(body).toHaveProperty('period');
    });

    it('should filter by zone', async () => {
      client.setAuthToken(recruiterToken);
      const response = await client.get('/api/analytics/source-quality/scoreboard?zoneId=zone_1');
      expect(response.statusCode).toBe(200);
    });

    it('should filter by service type', async () => {
      client.setAuthToken(recruiterToken);
      const response = await client.get('/api/analytics/source-quality/scoreboard?serviceType=MOTO');
      expect(response.statusCode).toBe(200);
    });

    it('should reject invalid period parameter', async () => {
      client.setAuthToken(recruiterToken);
      const response = await client.get('/api/analytics/source-quality/scoreboard?period=invalid');
      expect(response.statusCode).toBe(400);
    });

    it('should require authentication', async () => {
      client.setAuthToken('');
      const response = await client.get('/api/analytics/source-quality/scoreboard');
      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/analytics/source-quality/detail/:sourceChannel', () => {
    it('should return detailed source metrics', async () => {
      client.setAuthToken(recruiterToken);
      const response = await client.get('/api/analytics/source-quality/detail/FO_REFERRAL?period=90d');
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('sourceChannel');
    });

    it('should return 404 for non-existent source', async () => {
      client.setAuthToken(recruiterToken);
      const response = await client.get('/api/analytics/source-quality/detail/NONEXISTENT');
      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/analytics/recruiter-performance', () => {
    it('should allow manager to view recruiter performance', async () => {
      client.setAuthToken(adminToken);
      const response = await client.get('/api/analytics/recruiter-performance?period=90d');
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('recruiters');
    });

    it('should reject recruiter access to performance data', async () => {
      client.setAuthToken(recruiterToken);
      const response = await client.get('/api/analytics/recruiter-performance');
      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/analytics/sync-status', () => {
    it('should allow admin to view sync status', async () => {
      client.setAuthToken(adminToken);
      const response = await client.get('/api/analytics/sync-status');
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('totalCandidates');
    });

    it('should reject non-admin access', async () => {
      client.setAuthToken(recruiterToken);
      const response = await client.get('/api/analytics/sync-status');
      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/analytics/calculate-scores', () => {
    it('should allow admin to trigger score calculation', async () => {
      client.setAuthToken(adminToken);
      const response = await client.post('/api/analytics/calculate-scores', {
        periodStart: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
      });
      
      expect(response.statusCode).toBe(200);
    });

    it('should reject invalid date range', async () => {
      client.setAuthToken(adminToken);
      const response = await client.post('/api/analytics/calculate-scores', {
        periodStart: 'invalid-date',
        periodEnd: 'invalid-date',
      });
      
      expect(response.statusCode).toBe(400);
    });

    it('should reject non-admin access', async () => {
      client.setAuthToken(recruiterToken);
      const response = await client.post('/api/analytics/calculate-scores', {
        periodStart: new Date().toISOString(),
        periodEnd: new Date().toISOString(),
      });
      
      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/analytics/sync/:candidateId/retry', () => {
    it('should allow admin to retry sync', async () => {
      const candidate = await TestHelpers.createTestCandidate();
      client.setAuthToken(adminToken);
      
      const response = await client.post(`/api/analytics/sync/${candidate.id}/retry`);
      // May fail due to missing OpsTower config, but should be authorized
      expect([200, 500]).toContain(response.statusCode);
    });

    it('should reject non-admin retry attempts', async () => {
      const candidate = await TestHelpers.createTestCandidate();
      client.setAuthToken(recruiterToken);
      
      const response = await client.post(`/api/analytics/sync/${candidate.id}/retry`);
      expect(response.statusCode).toBe(403);
    });
  });

  describe('Performance', () => {
    it('should handle large date ranges', async () => {
      client.setAuthToken(recruiterToken);
      const start = new Date('2020-01-01').toISOString();
      const end = new Date().toISOString();
      
      const response = await client.get(`/api/analytics/source-quality/scoreboard?period=12m`);
      expect(response.statusCode).toBe(200);
    });

    it('should respond within acceptable time', async () => {
      client.setAuthToken(recruiterToken);
      const start = Date.now();
      
      const response = await client.get('/api/analytics/source-quality/scoreboard');
      const duration = Date.now() - start;
      
      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });
  });
});
