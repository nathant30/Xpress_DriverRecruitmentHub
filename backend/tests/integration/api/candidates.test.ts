import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TestApiClient } from '../../utils/api-client.js';
import { TestHelpers, FuzzGenerators } from '../../utils/test-helpers.js';

describe('Candidates API Integration Tests', () => {
  let client: TestApiClient;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    client = await new TestApiClient().setup();
    
    const { token } = await TestHelpers.createTestUser({ role: 'RECRUITER' });
    authToken = token;
    
    const { token: adminTok } = await TestHelpers.createTestUser({ 
      role: 'ADMIN',
      email: 'admin_test@example.com'
    });
    adminToken = adminTok;
  });

  afterAll(async () => {
    await client.teardown();
    await TestHelpers.cleanupTestData();
  });

  describe('GET /api/candidates', () => {
    beforeEach(() => client.setAuthToken(authToken));

    it('should list candidates with pagination', async () => {
      // Create test candidates
      for (let i = 0; i < 5; i++) {
        await TestHelpers.createTestCandidate();
      }

      const response = await client.get('/api/candidates?page=1&limit=10');
      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
    });

    it('should filter by stage', async () => {
      await TestHelpers.createTestCandidate({ currentStage: 'APPLICATION' });
      await TestHelpers.createTestCandidate({ currentStage: 'ONBOARDED' });

      const response = await client.get('/api/candidates?stage=APPLICATION');
      const body = JSON.parse(response.body);
      
      expect(body.data.every((c: any) => c.currentStage === 'APPLICATION')).toBe(true);
    });

    it('should handle large page sizes gracefully', async () => {
      const response = await client.get('/api/candidates?limit=10000');
      expect(response.statusCode).toBe(200);
    });

    it('should reject negative pagination', async () => {
      const response = await client.get('/api/candidates?page=-1&limit=-10');
      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/candidates', () => {
    beforeEach(() => client.setAuthToken(authToken));

    it('should create candidate with valid data', async () => {
      const response = await client.post('/api/candidates', {
        fullName: 'New Candidate',
        phonePrimary: TestHelpers.generateTestPhone(),
        email: TestHelpers.generateTestEmail(),
        sourceChannel: 'FO_REFERRAL',
        serviceType: 'MOTO',
        zoneId: 'zone_1',
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('id');
      expect(body.currentStage).toBe('APPLICATION');
    });

    it('should reject duplicate phone numbers', async () => {
      const phone = TestHelpers.generateTestPhone();
      
      await client.post('/api/candidates', {
        fullName: 'First Candidate',
        phonePrimary: phone,
        sourceChannel: 'FO_REFERRAL',
        serviceType: 'MOTO',
      });

      const response = await client.post('/api/candidates', {
        fullName: 'Second Candidate',
        phonePrimary: phone,
        sourceChannel: 'DRIVER_REFERRAL',
        serviceType: 'MOTO',
      });

      expect(response.statusCode).toBe(409);
    });

    it('should handle edge case: extremely long names', async () => {
      const response = await client.post('/api/candidates', {
        fullName: FuzzGenerators.strings.long(500),
        phonePrimary: TestHelpers.generateTestPhone(),
        sourceChannel: 'FO_REFERRAL',
        serviceType: 'MOTO',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle edge case: special characters in names', async () => {
      const response = await client.post('/api/candidates', {
        fullName: FuzzGenerators.strings.special(),
        phonePrimary: TestHelpers.generateTestPhone(),
        sourceChannel: 'FO_REFERRAL',
        serviceType: 'MOTO',
      });

      // Should either accept with sanitization or reject
      expect([201, 400]).toContain(response.statusCode);
    });

    it('should require mandatory fields', async () => {
      const response = await client.post('/api/candidates', {
        fullName: '',
        phonePrimary: '',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate phone format', async () => {
      const response = await client.post('/api/candidates', {
        fullName: 'Test',
        phonePrimary: 'invalid-phone',
        sourceChannel: 'FO_REFERRAL',
        serviceType: 'MOTO',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate email format when provided', async () => {
      const response = await client.post('/api/candidates', {
        fullName: 'Test',
        phonePrimary: TestHelpers.generateTestPhone(),
        email: 'not-an-email',
        sourceChannel: 'FO_REFERRAL',
        serviceType: 'MOTO',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/candidates/:id/stage', () => {
    let candidateId: string;

    beforeEach(async () => {
      client.setAuthToken(authToken);
      const candidate = await TestHelpers.createTestCandidate();
      candidateId = candidate.id;
    });

    it('should update stage with valid transition', async () => {
      const response = await client.patch(`/api/candidates/${candidateId}/stage`, {
        stage: 'SCREENING',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.currentStage).toBe('SCREENING');
    });

    it('should reject invalid stage transitions', async () => {
      // Try to skip ahead
      const response = await client.patch(`/api/candidates/${candidateId}/stage`, {
        stage: 'ONBOARDED',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject stage update for non-existent candidate', async () => {
      const response = await client.patch('/api/candidates/nonexistent/stage', {
        stage: 'SCREENING',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/candidates/:id/transfer-to-opstower', () => {
    let candidateId: string;

    beforeEach(async () => {
      client.setAuthToken(authToken);
      const candidate = await TestHelpers.createTestCandidate({
        currentStage: 'CONTRACT_SIGNING',
      });
      candidateId = candidate.id;
      
      // Add approved documents
      await TestHelpers.createTestDocument(candidateId, { status: 'APPROVED' });
    });

    it('should reject transfer if documents not approved', async () => {
      const candidate = await TestHelpers.createTestCandidate({
        currentStage: 'CONTRACT_SIGNING',
      });
      
      const response = await client.post(`/api/candidates/${candidate.id}/transfer-to-opstower`);
      expect(response.statusCode).toBe(400);
    });

    it('should reject transfer from incorrect stage', async () => {
      const candidate = await TestHelpers.createTestCandidate({
        currentStage: 'APPLICATION',
      });

      const response = await client.post(`/api/candidates/${candidate.id}/transfer-to-opstower`);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Authorization', () => {
    it('should allow admin to view all candidates', async () => {
      client.setAuthToken(adminToken);
      const response = await client.get('/api/candidates');
      expect(response.statusCode).toBe(200);
    });

    it('should prevent recruiter from deleting candidates', async () => {
      client.setAuthToken(authToken);
      const candidate = await TestHelpers.createTestCandidate();
      
      const response = await client.delete(`/api/candidates/${candidate.id}`);
      expect(response.statusCode).toBe(403);
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => client.setAuthToken(authToken));

    it('should handle concurrent updates gracefully', async () => {
      const candidate = await TestHelpers.createTestCandidate();
      
      // Simulate concurrent updates
      const updates = await Promise.all([
        client.patch(`/api/candidates/${candidate.id}/stage`, { stage: 'SCREENING' }),
        client.patch(`/api/candidates/${candidate.id}/stage`, { stage: 'SCREENING' }),
        client.patch(`/api/candidates/${candidate.id}/stage`, { stage: 'SCREENING' }),
      ]);

      // All should succeed or at least not crash
      expect(updates.every(r => r.statusCode === 200 || r.statusCode === 409)).toBe(true);
    });

    it('should handle SQL injection in search', async () => {
      const response = await client.get(`/api/candidates?search=${encodeURIComponent(FuzzGenerators.strings.sqlInjection())}`);
      expect(response.statusCode).toBe(200);
    });

    it('should handle unicode in names', async () => {
      const response = await client.post('/api/candidates', {
        fullName: FuzzGenerators.strings.unicode(),
        phonePrimary: TestHelpers.generateTestPhone(),
        sourceChannel: 'FO_REFERRAL',
        serviceType: 'MOTO',
      });

      expect([201, 400]).toContain(response.statusCode);
    });
  });
});
