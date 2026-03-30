import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

// Helper to get auth token
function getAuthToken() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'loadtest@example.com',
    password: 'LoadTest123!',
  });
  
  if (loginRes.status === 200) {
    return JSON.parse(loginRes.body).token;
  }
  return null;
}

export default function () {
  const token = getAuthToken();
  
  if (!token) {
    console.log('Failed to get auth token');
    errorRate.add(1);
    return;
  }
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  group('Candidates API', () => {
    // List candidates
    const listRes = http.get(`${BASE_URL}/api/candidates?page=1&limit=20`, { headers });
    const listSuccess = check(listRes, {
      'list status is 200': (r) => r.status === 200,
      'list has data': (r) => JSON.parse(r.body).data !== undefined,
    });
    errorRate.add(!listSuccess);
    apiLatency.add(listRes.timings.duration);

    sleep(1);

    // Create candidate
    const createRes = http.post(`${BASE_URL}/api/candidates`, JSON.stringify({
      fullName: `Load Test ${__VU}-${__ITER}`,
      phonePrimary: `+639${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
      sourceChannel: 'FO_REFERRAL',
      serviceType: 'MOTO',
      zoneId: 'zone_1',
    }), { headers });
    
    const createSuccess = check(createRes, {
      'create status is 201': (r) => r.status === 201,
      'create has id': (r) => JSON.parse(r.body).id !== undefined,
    });
    errorRate.add(!createSuccess);
    apiLatency.add(createRes.timings.duration);

    if (createRes.status === 201) {
      const candidateId = JSON.parse(createRes.body).id;

      sleep(1);

      // Get candidate details
      const getRes = http.get(`${BASE_URL}/api/candidates/${candidateId}`, { headers });
      check(getRes, {
        'get status is 200': (r) => r.status === 200,
      });
      apiLatency.add(getRes.timings.duration);

      sleep(0.5);

      // Update stage
      const updateRes = http.patch(`${BASE_URL}/api/candidates/${candidateId}/stage`, JSON.stringify({
        stage: 'SCREENING',
      }), { headers });
      check(updateRes, {
        'update status is 200': (r) => r.status === 200,
      });
      apiLatency.add(updateRes.timings.duration);
    }
  });

  sleep(2);

  group('Analytics API', () => {
    // Get scoreboard
    const scoreboardRes = http.get(`${BASE_URL}/api/analytics/source-quality/scoreboard?period=90d`, { headers });
    const scoreboardSuccess = check(scoreboardRes, {
      'scoreboard status is 200': (r) => r.status === 200,
      'scoreboard has data': (r) => JSON.parse(r.body).scoreboard !== undefined,
    });
    errorRate.add(!scoreboardSuccess);
    apiLatency.add(scoreboardRes.timings.duration);

    sleep(1);

    // Get predictions
    const predictionsRes = http.get(`${BASE_URL}/api/predictions/insights`, { headers });
    check(predictionsRes, {
      'predictions status is 200': (r) => r.status === 200,
    });
    apiLatency.add(predictionsRes.timings.duration);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data),
    stdout: `
    Load Test Summary:
    =================
    Duration: ${data.state.testRunDuration}
    Requests: ${data.metrics.http_reqs.values.count}
    Failed: ${data.metrics.http_req_failed.values.rate * 100}%
    Avg Latency: ${data.metrics.http_req_duration.values.avg}ms
    P95 Latency: ${data.metrics.http_req_duration.values['p(95)']}ms
    `,
  };
}
