import { prisma } from '../../src/server.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { appConfig } from '../../src/config/app.config.js';

export class TestHelpers {
  static async createTestUser(overrides: Partial<any> = {}) {
    const defaultUser = {
      id: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      email: `test_${Date.now()}@example.com`,
      password: await bcrypt.hash('TestPassword123!', 10),
      fullName: 'Test User',
      role: 'RECRUITER',
      isActive: true,
    };

    const user = await prisma.user.create({
      data: { ...defaultUser, ...overrides },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      appConfig.jwtSecret,
      { expiresIn: '1h' }
    );

    return { user, token };
  }

  static async createTestCandidate(overrides: Partial<any> = {}) {
    const defaultCandidate = {
      id: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      fullName: 'Test Candidate',
      phonePrimary: `+639${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`,
      email: `candidate_${Date.now()}@example.com`,
      sourceChannel: 'FO_REFERRAL',
      currentStage: 'APPLICATION',
      serviceType: 'MOTO',
      zoneId: 'zone_1',
      isExistingDriver: false,
    };

    return prisma.candidate.create({
      data: { ...defaultCandidate, ...overrides },
    });
  }

  static async createTestDocument(candidateId: string, overrides: Partial<any> = {}) {
    const defaultDoc = {
      id: `test_${Date.now()}`,
      candidateId,
      documentType: 'GOVERNMENT_ID',
      status: 'PENDING',
      fileUrl: 'https://example.com/test.pdf',
    };

    return prisma.document.create({
      data: { ...defaultDoc, ...overrides },
    });
  }

  static generateTestPhone(): string {
    return `+639${Math.floor(Math.random() * 1000000000).toString().padStart(9, '0')}`;
  }

  static generateTestEmail(): string {
    return `test_${Date.now()}_${Math.random().toString(36).substring(7)}@example.com`;
  }

  static async cleanupTestData() {
    const tables = [
      'interaction_logs',
      'documents',
      'candidates',
      'users',
      'ml_predictions',
    ];

    for (const table of tables) {
      try {
        await prisma.$executeRawUnsafe(`DELETE FROM "${table}" WHERE id LIKE 'test_%'`);
      } catch {
        // Ignore errors
      }
    }
  }
}

// Fuzz test data generators
export const FuzzGenerators = {
  strings: {
    empty: () => '',
    whitespace: () => '   ',
    long: (length = 10000) => 'A'.repeat(length),
    special: () => '!@#$%^&*()_+-=[]{}|;\':",./<>?',
    unicode: () => '日本語中文العربية🎉🚀',
    sqlInjection: () => "'; DROP TABLE users; --",
    xss: () => '<script>alert("xss")</script>',
    newline: () => '\n\r\t\0',
  },
  numbers: {
    negative: () => -1,
    zero: () => 0,
    maxInt: () => Number.MAX_SAFE_INTEGER,
    minInt: () => Number.MIN_SAFE_INTEGER,
    infinity: () => Infinity,
    nan: () => NaN,
    float: () => 3.14159,
  },
  objects: {
    empty: () => ({}),
    circular: () => {
      const obj: any = { a: 1 };
      obj.self = obj;
      return obj;
    },
    deep: (depth = 100) => {
      let obj: any = { value: 'leaf' };
      for (let i = 0; i < depth; i++) {
        obj = { nested: obj };
      }
      return obj;
    },
  },
};
