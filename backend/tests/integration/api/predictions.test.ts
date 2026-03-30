import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TestApiClient } from '../../utils/api-client.js';
import { TestHelpers } from '../../utils/test-helpers.js';

describe('Predictions API Integration Tests', () => {
  let client: TestApiClient;
  let authToken: string;
  let testCandidateId: string;

  beforeAll(async () => {
    client = await new TestApiClient().setup();
    
    const { token } = await TestHelpers.createTestUser({ role: 'RECRUITER' });
    authToken = token;

    const candidate = await TestHelpers.createTestCandidate();
    testCandidateId = candidate.id;
  });

  afterAll(async () => {
    await client.teardown();
    await TestHelpers.cleanupTestData();
  });

  beforeEach(() => client.setAuthToken(authToken));

  describe('GET /api/predictions/candidates/:candidateId', () => {
    it('should return all predictions for candidate', async () => {
      const response = await client.get(`/api/predictions/candidates/${testCandidateId}`);

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('predictions');
      expect(body).toHaveProperty('candidateId');
      expect(body).toHaveProperty('generatedAt');
      expect(Array.isArray(body.predictions)).toBe(true);
    });

    it('should return 404 for non-existent candidate', async () => {
      const response = await client.get('/api/predictions/candidates/nonexistent');
      expect(response.statusCode).toBe(404);
    });

    it('should generate predictions with correct structure', async () => {
      const response = await client.get(`/api/predictions/candidates/${testCandidateId}`);
      const body = JSON.parse(response.body);

      body.predictions.forEach((pred: any) => {
        expect(pred).toHaveProperty('type');
        expect(pred).toHaveProperty('value');
        expect(pred).toHaveProperty('confidence');
        expect(pred).toHaveProperty('explanation');
        expect(pred).toHaveProperty('factors');
        expect(pred).toHaveProperty('recommendation');
        expect(pred.confidence).toBeGreaterThan(0);
        expect(pred.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Individual Prediction Endpoints', () => {
    it('should get pre-hire quality prediction', async () => {
      const response = await client.get(`/api/predictions/candidates/${testCandidateId}/pre-hire-quality`);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.type).toBe('PRE_HIRE_QUALITY');
      expect(typeof body.value).toBe('number');
    });

    it('should get drop-off risk prediction', async () => {
      const response = await client.get(`/api/predictions/candidates/${testCandidateId}/drop-off-risk`);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.type).toBe('DROP_OFF_RISK');
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(body.value);
    });

    it('should get time to onboard prediction', async () => {
      const response = await client.get(`/api/predictions/candidates/${testCandidateId}/time-to-onboard`);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.type).toBe('TIME_TO_ONBOARD');
      expect(typeof body.value).toBe('number');
    });

    it('should get optimal contact time prediction', async () => {
      const response = await client.get(`/api/predictions/candidates/${testCandidateId}/optimal-contact-time`);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.type).toBe('OPTIMAL_CONTACT_TIME');
      expect(typeof body.value).toBe('string');
    });

    it('should get zone-role fit prediction', async () => {
      const response = await client.get(`/api/predictions/candidates/${testCandidateId}/zone-role-fit`);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.type).toBe('ZONE_ROLE_FIT');
    });
  });

  describe('Churn Risk Prediction', () => {
    it('should return churn risk for onboarded drivers', async () => {
      const onboardedCandidate = await TestHelpers.createTestCandidate({
        currentStage: 'ONBOARDED',
      });

      const response = await client.get(`/api/predictions/candidates/${onboardedCandidate.id}/churn-risk`);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.type).toBe('CHURN_RISK');
    });

    it('should reject churn prediction for non-onboarded candidates', async () => {
      const response = await client.get(`/api/predictions/candidates/${testCandidateId}/churn-risk`);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Document Risk Analysis', () => {
    it('should analyze document risk', async () => {
      const document = await TestHelpers.createTestDocument(testCandidateId);
      
      const response = await client.get(`/api/predictions/documents/${document.id}/risk`);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('risk');
      expect(body).toHaveProperty('confidence');
    });

    it('should return 404 for non-existent document', async () => {
      const response = await client.get('/api/predictions/documents/nonexistent/risk');
      expect(response.statusCode).toBe(404);
    });
  });

  describe('Prediction History', () => {
    it('should return prediction history', async () => {
      const response = await client.get(`/api/predictions/candidates/${testCandidateId}/history?limit=10`);
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('predictions');
    });

    it('should filter by prediction type', async () => {
      const response = await client.get(`/api/predictions/candidates/${testCandidateId}/history?type=PRE_HIRE_QUALITY`);
      
      expect(response.statusCode).toBe(200);
    });
  });

  describe('POST /api/predictions/:predictionId/feedback', () => {
    it('should accept feedback on predictions', async () => {
      // First get a prediction
      const predResponse = await client.get(`/api/predictions/candidates/${testCandidateId}/pre-hire-quality`);
      const prediction = JSON.parse(predResponse.body);

      const response = await client.post(`/api/predictions/${prediction.id || 'test'}/feedback`, {
        feedback: 'ACCURATE',
        notes: 'Prediction was correct',
      });

      // May be 200 or 404 depending on if prediction was saved
      expect([200, 404]).toContain(response.statusCode);
    });

    it('should validate feedback type', async () => {
      const response = await client.post('/api/predictions/test/feedback', {
        feedback: 'INVALID_TYPE',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/predictions/batch/drop-off-risk', () => {
    it('should return high risk candidates for recruiter', async () => {
      const response = await client.get('/api/predictions/batch/drop-off-risk');
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('highRiskCandidates');
      expect(body).toHaveProperty('totalCandidates');
    });
  });

  describe('GET /api/predictions/insights', () => {
    it('should return role-based insights', async () => {
      const response = await client.get('/api/predictions/insights');
      
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('role');
      expect(body).toHaveProperty('insights');
    });
  });

  describe('Model Configuration (Admin Only)', () => {
    it('should reject non-admin access to model config', async () => {
      const response = await client.get('/api/predictions/model-config');
      expect(response.statusCode).toBe(403);
    });

    it('should reject non-admin config updates', async () => {
      const response = await client.patch('/api/predictions/model-config/PRE_HIRE_QUALITY', {
        isActive: false,
      });
      expect(response.statusCode).toBe(403);
    });
  });

  describe('Performance', () => {
    it('should generate predictions within timeout', async () => {
      const start = Date.now();
      const response = await client.get(`/api/predictions/candidates/${testCandidateId}`);
      const duration = Date.now() - start;

      expect(response.statusCode).toBe(200);
      expect(duration).toBeLessThan(3000); // 3 seconds max
    });

    it('should handle rapid successive requests', async () => {
      const requests = Array(5).fill(null).map(() =>
        client.get(`/api/predictions/candidates/${testCandidateId}/pre-hire-quality`)
      );

      const responses = await Promise.all(requests);
      expect(responses.every(r => r.statusCode === 200)).toBe(true);
    });
  });
});
