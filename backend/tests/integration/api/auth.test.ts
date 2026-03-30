import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { TestApiClient } from '../../utils/api-client.js';
import { TestHelpers, FuzzGenerators } from '../../utils/test-helpers.js';

describe('Auth API Integration Tests', () => {
  let client: TestApiClient;

  beforeAll(async () => {
    client = await new TestApiClient().setup();
  });

  afterAll(async () => {
    await client.teardown();
    await TestHelpers.cleanupTestData();
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate with valid credentials', async () => {
      const { user } = await TestHelpers.createTestUser({
        email: 'auth_test@example.com',
        password: await (await import('bcryptjs')).hash('ValidPass123!', 10),
      });

      const response = await client.post('/api/auth/login', {
        email: 'auth_test@example.com',
        password: 'ValidPass123!',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('token');
      expect(body).toHaveProperty('user');
    });

    it('should reject invalid credentials', async () => {
      const response = await client.post('/api/auth/login', {
        email: 'nonexistent@example.com',
        password: 'WrongPassword123!',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should handle SQL injection attempts', async () => {
      const response = await client.post('/api/auth/login', {
        email: FuzzGenerators.strings.sqlInjection(),
        password: FuzzGenerators.strings.sqlInjection(),
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle XSS attempts', async () => {
      const response = await client.post('/api/auth/login', {
        email: FuzzGenerators.strings.xss(),
        password: 'SomePassword123!',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should rate limit after multiple failed attempts', async () => {
      const email = 'ratelimit_test@example.com';
      
      // Make multiple failed login attempts
      const responses = await client.floodRequests(
        '/api/auth/login',
        10,
        'POST',
        { email, password: 'wrong' }
      );

      // Should start rate limiting after several attempts
      const tooManyRequests = responses.filter(r => r.statusCode === 429);
      expect(tooManyRequests.length).toBeGreaterThan(0);
    });

    it('should reject empty credentials', async () => {
      const response = await client.post('/api/auth/login', {
        email: '',
        password: '',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should reject overly long inputs', async () => {
      const response = await client.post('/api/auth/login', {
        email: FuzzGenerators.strings.long(1000),
        password: FuzzGenerators.strings.long(1000),
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register new user with valid data', async () => {
      const response = await client.post('/api/auth/register', {
        email: TestHelpers.generateTestEmail(),
        password: 'SecurePass123!',
        fullName: 'Test User',
        role: 'RECRUITER',
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('id');
    });

    it('should reject duplicate email', async () => {
      const email = TestHelpers.generateTestEmail();
      
      // First registration
      await client.post('/api/auth/register', {
        email,
        password: 'SecurePass123!',
        fullName: 'Test User',
        role: 'RECRUITER',
      });

      // Duplicate registration
      const response = await client.post('/api/auth/register', {
        email,
        password: 'SecurePass123!',
        fullName: 'Another User',
        role: 'RECRUITER',
      });

      expect(response.statusCode).toBe(409);
    });

    it('should reject weak passwords', async () => {
      const response = await client.post('/api/auth/register', {
        email: TestHelpers.generateTestEmail(),
        password: '123',
        fullName: 'Test User',
        role: 'RECRUITER',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should sanitize input', async () => {
      const response = await client.post('/api/auth/register', {
        email: TestHelpers.generateTestEmail(),
        password: 'SecurePass123!',
        fullName: '<script>alert("xss")</script>',
        role: 'RECRUITER',
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.fullName).not.toContain('<script>');
    });
  });

  describe('Token Validation', () => {
    it('should reject requests without token', async () => {
      const response = await client.get('/api/candidates');
      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid tokens', async () => {
      client.setAuthToken('invalid.token.here');
      const response = await client.get('/api/candidates');
      expect(response.statusCode).toBe(401);
    });

    it('should reject expired tokens', async () => {
      const jwt = await import('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 'test', email: 'test@example.com', role: 'RECRUITER' },
        'test-secret',
        { expiresIn: '-1h' } // Already expired
      );

      client.setAuthToken(expiredToken);
      const response = await client.get('/api/candidates');
      expect(response.statusCode).toBe(401);
    });
  });
});
