import http from 'k6/http';
import { check, sleep, group } from 'k6';

// Security penetration tests
export const options = {
  vus: 1,
  iterations: 1,
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Attack payloads
const ATTACK_PAYLOADS = {
  sqlInjection: [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "' UNION SELECT * FROM users --",
    "1' OR '1'='1' /*",
    "1' AND 1=1 --",
    "'; DELETE FROM candidates WHERE '1'='1",
  ],
  xss: [
    '<script>alert("xss")</script>',
    '<img src=x onerror=alert("xss")>',
    'javascript:alert("xss")',
    '<svg onload=alert("xss")>',
    '"><script>alert(String.fromCharCode(88,83,83))</script>',
  ],
  pathTraversal: [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '....//....//....//etc/passwd',
  ],
  commandInjection: [
    '; cat /etc/passwd',
    '| whoami',
    '&& dir',
    '$(id)',
    '`ls -la`',
  ],
  nosqlInjection: [
    '{"$gt": ""}',
    '{"$ne": null}',
    '{"$regex": ".*"}',
    '{"$where": "this.password.length > 0"}',
  ],
};

export default function () {
  group('SQL Injection Tests', () => {
    const headers = { 'Content-Type': 'application/json' };

    ATTACK_PAYLOADS.sqlInjection.forEach((payload, idx) => {
      // Test login SQL injection
      const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        email: payload,
        password: payload,
      }), { headers });

      check(loginRes, {
        [`SQLi login ${idx}: not vulnerable`]: (r) => 
          r.status !== 200 || !r.body.includes('token'),
      });

      // Test search SQL injection
      const searchRes = http.get(`${BASE_URL}/api/candidates?search=${encodeURIComponent(payload)}`, {
        headers: { ...headers, 'Authorization': 'Bearer invalid' },
      });

      check(searchRes, {
        [`SQLi search ${idx}: not vulnerable`]: (r) => 
          r.status === 401 || r.status === 400,
      });

      sleep(0.1);
    });
  });

  group('XSS Prevention Tests', () => {
    const headers = { 'Content-Type': 'application/json' };

    ATTACK_PAYLOADS.xss.forEach((payload, idx) => {
      // Test candidate name XSS
      const createRes = http.post(`${BASE_URL}/api/candidates`, JSON.stringify({
        fullName: payload,
        phonePrimary: '+639123456789',
        sourceChannel: 'FO_REFERRAL',
        serviceType: 'MOTO',
      }), { headers });

      // Should reject or sanitize
      check(createRes, {
        [`XSS candidate ${idx}: sanitized or rejected`]: (r) => 
          r.status === 400 || r.status === 201,
      });

      if (createRes.status === 201) {
        // Verify response doesn't contain raw script
        check(createRes, {
          [`XSS response ${idx}: no raw script`]: (r) => 
            !r.body.includes('<script>') || r.body.includes('\\u003cscript\\u003e'),
        });
      }

      sleep(0.1);
    });
  });

  group('Authentication Bypass Tests', () => {
    // Test without token
    const noAuthRes = http.get(`${BASE_URL}/api/candidates`);
    check(noAuthRes, {
      'No token: rejected': (r) => r.status === 401,
    });

    // Test with malformed token
    const malformedRes = http.get(`${BASE_URL}/api/candidates`, {
      headers: { 'Authorization': 'Bearer invalid.token.here' },
    });
    check(malformedRes, {
      'Malformed token: rejected': (r) => r.status === 401,
    });

    // Test with empty token
    const emptyRes = http.get(`${BASE_URL}/api/candidates`, {
      headers: { 'Authorization': '' },
    });
    check(emptyRes, {
      'Empty token: rejected': (r) => r.status === 401,
    });

    // Test token in wrong format
    const wrongFormatRes = http.get(`${BASE_URL}/api/candidates`, {
      headers: { 'Authorization': 'Basic dGVzdDp0ZXN0' },
    });
    check(wrongFormatRes, {
      'Wrong auth type: rejected': (r) => r.status === 401,
    });
  });

  group('Authorization Tests', () => {
    // Try to access admin endpoints as recruiter
    const recruiterToken = 'fake_recruiter_token';
    
    const adminEndpoints = [
      '/api/analytics/sync-status',
      '/api/analytics/recruiter-performance',
      '/api/predictions/model-config',
    ];

    adminEndpoints.forEach(endpoint => {
      const res = http.get(`${BASE_URL}${endpoint}`, {
        headers: { 'Authorization': `Bearer ${recruiterToken}` },
      });

      check(res, {
        [`${endpoint}: forbidden for non-admin`]: (r) => 
          r.status === 401 || r.status === 403,
      });
    });
  });

  group('Rate Limiting Tests', () => {
    const requests = [];
    
    // Rapid fire requests
    for (let i = 0; i < 50; i++) {
      requests.push(
        http.get(`${BASE_URL}/api/candidates`, {
          headers: { 'Authorization': 'Bearer invalid' },
        })
      );
    }

    const rateLimitedCount = requests.filter(r => r.status === 429).length;
    
    check(null, {
      'Rate limiting active': () => rateLimitedCount > 0,
    });
  });

  group('Information Disclosure Tests', () => {
    // Check for sensitive headers
    const healthRes = http.get(`${BASE_URL}/health`);
    
    check(healthRes, {
      'No server version header': (r) => 
        !r.headers['X-Powered-By'] && !r.headers['Server'],
    });

    // Check error messages don't leak info
    const errorRes = http.get(`${BASE_URL}/api/candidates/nonexistent-id-12345`, {
      headers: { 'Authorization': 'Bearer invalid' },
    });

    check(errorRes, {
      'Error message generic': (r) => 
        !r.body.includes('SQL') && 
        !r.body.includes('database') &&
        !r.body.includes('prisma'),
    });
  });

  group('CSRF Protection Tests', () => {
    // Test state-changing operations without proper headers
    const headers = { 'Content-Type': 'application/json' };
    
    const res = http.post(`${BASE_URL}/api/candidates`, JSON.stringify({
      fullName: 'CSRF Test',
      phonePrimary: '+639123456789',
    }), { headers });

    check(res, {
      'CSRF: unauthenticated write rejected': (r) => r.status === 401,
    });
  });

  group('Input Validation Tests', () => {
    const headers = { 'Content-Type': 'application/json' };

    // Test oversized payloads
    const hugePayload = {
      fullName: 'A'.repeat(10000),
      phonePrimary: '+639123456789',
      email: 'test@example.com',
      sourceChannel: 'FO_REFERRAL',
      serviceType: 'MOTO',
    };

    const hugeRes = http.post(`${BASE_URL}/api/candidates`, JSON.stringify(hugePayload), { headers });
    check(hugeRes, {
      'Huge payload: rejected or handled': (r) => 
        r.status === 400 || r.status === 413 || r.status === 201,
    });

    // Test invalid data types
    const invalidTypes = {
      fullName: 12345,
      phonePrimary: true,
      email: {},
    };

    const typeRes = http.post(`${BASE_URL}/api/candidates`, JSON.stringify(invalidTypes), { headers });
    check(typeRes, {
      'Invalid types: rejected': (r) => r.status === 400,
    });

    // Test null byte injection
    const nullByteRes = http.get(`${BASE_URL}/api/candidates?search=test%00 malicious`, {
      headers: { 'Authorization': 'Bearer invalid' },
    });
    check(nullByteRes, {
      'Null byte: handled': (r) => r.status !== 500,
    });
  });

  group('Path Traversal Tests', () => {
    ATTACK_PAYLOADS.pathTraversal.forEach((payload, idx) => {
      const res = http.get(`${BASE_URL}/api/candidates/${encodeURIComponent(payload)}`, {
        headers: { 'Authorization': 'Bearer invalid' },
      });

      check(res, {
        [`Path traversal ${idx}: blocked`]: (r) => 
          r.status === 401 || r.status === 400 || r.status === 404,
      });
    });
  });

  sleep(1);
}

export function handleSummary(data) {
  const checks = data.metrics.checks;
  const passed = checks.values.passes;
  const failed = checks.values.fails;
  
  return {
    'security-test-results.json': JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: {
        total: passed + failed,
        passed,
        failed,
        passRate: ((passed / (passed + failed)) * 100).toFixed(2) + '%',
      },
      details: data,
    }),
    stdout: `
    ===========================================
    Security Penetration Test Results
    ===========================================
    Total Checks: ${passed + failed}
    Passed: ${passed}
    Failed: ${failed}
    Pass Rate: ${((passed / (passed + failed)) * 100).toFixed(2)}%
    
    ${failed > 0 ? '⚠️  SOME SECURITY TESTS FAILED - REVIEW REQUIRED' : '✅ All security tests passed'}
    ===========================================
    `,
  };
}
