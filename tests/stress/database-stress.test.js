import http from 'k6/http';
import { check, sleep, group } from 'k6';

// Stress test - push beyond normal capacity
export const options = {
  stages: [
    { duration: '5m', target: 100 },  // Ramp up
    { duration: '10m', target: 300 }, // Stress phase
    { duration: '5m', target: 500 },  // Extreme stress
    { duration: '10m', target: 500 }, // Sustained extreme
    { duration: '5m', target: 0 },    // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000'],
  },
  noConnectionReuse: true, // More realistic - new connections per request
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

let authToken = null;

export function setup() {
  // Get initial auth token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, {
    email: 'stresstest@example.com',
    password: 'StressTest123!',
  });
  
  if (loginRes.status === 200) {
    return { token: JSON.parse(loginRes.body).token };
  }
  return { token: null };
}

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  group('Database Write Load', () => {
    // Heavy write operations
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(
        http.post(`${BASE_URL}/api/candidates`, JSON.stringify({
          fullName: `Stress Test ${__VU}-${__ITER}-${i}`,
          phonePrimary: `+639${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
          sourceChannel: ['FO_REFERRAL', 'DRIVER_REFERRAL', 'FACEBOOK_ADS'][i % 3],
          serviceType: ['MOTO', 'SEDAN_SUV', 'TAXI'][i % 3],
          zoneId: `zone_${(i % 5) + 1}`,
        }), { headers })
      );
    }
    
    const responses = promises;
    
    check(responses[0], {
      'write successful': (r) => r.status === 201 || r.status === 429,
    });
  });

  sleep(0.5);

  group('Complex Queries', () => {
    // Analytics queries (CPU intensive)
    const analyticsRes = http.get(
      `${BASE_URL}/api/analytics/source-quality/scoreboard?period=12m&zoneId=zone_1`,
      { headers }
    );
    
    check(analyticsRes, {
      'analytics query completed': (r) => r.status === 200,
      'analytics under 5s': (r) => r.timings.duration < 5000,
    });

    sleep(0.5);

    // ML predictions (memory intensive)
    const predictionsRes = http.get(`${BASE_URL}/api/predictions/batch/drop-off-risk`, { headers });
    
    check(predictionsRes, {
      'predictions query completed': (r) => r.status === 200,
    });
  });

  sleep(1);

  group('Concurrent Reads', () => {
    // Simulate many users reading simultaneously
    const readPromises = [];
    
    for (let i = 0; i < 10; i++) {
      readPromises.push(
        http.get(`${BASE_URL}/api/candidates?page=${i + 1}&limit=20`, { headers })
      );
    }
    
    const readResponses = readPromises;
    
    const successCount = readResponses.filter(r => r.status === 200).length;
    
    check(null, {
      'majority of reads successful': () => successCount >= 7,
    });
  });

  sleep(2);
}

export function teardown(data) {
  console.log('Stress test completed');
}
