import { prisma } from '../src/server.js';

// Global test setup
beforeAll(async () => {
  // Clean test database
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// Clean up after each test
afterEach(async () => {
  const tables = [
    'interaction_logs',
    'documents',
    'candidates',
    'users',
    'ml_predictions',
    'driver_performance_snapshots',
    'source_quality_scores',
  ];
  
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE id LIKE 'test_%'`);
    } catch {
      // Table might not exist
    }
  }
});

// Global test utilities
declare global {
  var testContext: {
    authToken?: string;
    testUser?: any;
    testCandidate?: any;
  };
}

global.testContext = {};
