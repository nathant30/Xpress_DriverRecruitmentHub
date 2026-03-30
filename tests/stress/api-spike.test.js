import http from 'k6/http';
import { check, sleep } from 'k6';

// Spike test - sudden traffic surge
export const options = {
  stages: [
    { duration: '1m', target: 50 },   // Baseline
    { duration: '30s', target: 500 }, // Spike to 500 users
    { duration: '1m', target: 500 },  // Stay at spike
    { duration: '30s', target: 50 },  // Recover
    { duration: '2m', target: 50 },   // Verify recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // Allow higher latency during spike
    http_req_failed: ['rate<0.2'],      // Allow higher error rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

export default function () {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Health check during spike
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health is 200': (r) => r.status === 200,
    'health response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(0.1);

  // Login endpoint stress
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: `spike_${__VU}_${Date.now()}@example.com`,
    password: 'TestPassword123!',
  }), { headers });
  
  check(loginRes, {
    'login returns valid response': (r) => r.status === 200 || r.status === 401 || r.status === 429,
  });

  sleep(0.5);
}
