import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { AnalyticsEngineService } from '../../../src/services/analytics-engine.service.js';
import { prisma } from '../../../src/server.js';

// Mock prisma
jest.mock('../../../src/server.js', () => ({
  prisma: {
    candidate: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    driverPerformanceSnapshot: {
      findMany: jest.fn(),
    },
    sourceQualityScore: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    zone: {
      findMany: jest.fn(),
    },
  },
}));

describe('AnalyticsEngineService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateSourceQualityScores', () => {
    it('should calculate quality scores correctly with valid data', async () => {
      const mockCandidates = [
        {
          id: '1',
          sourceChannel: 'FO_REFERRAL',
          currentStage: 'ONBOARDED',
          createdAt: new Date('2026-01-01'),
          performanceSnapshots: [
            { snapshotType: 'DAY_90', isActive: true, tierAtSnapshot: 'GOLD' },
          ],
        },
        {
          id: '2',
          sourceChannel: 'FO_REFERRAL',
          currentStage: 'ONBOARDED',
          createdAt: new Date('2026-01-01'),
          performanceSnapshots: [
            { snapshotType: 'DAY_90', isActive: false, tierAtSnapshot: 'SILVER' },
          ],
        },
      ];

      (prisma.candidate.findMany as jest.Mock).mockResolvedValue(mockCandidates);
      (prisma.sourceQualityScore.upsert as jest.Mock).mockResolvedValue({});

      const result = await AnalyticsEngineService.calculateSourceQualityScores(
        new Date('2026-01-01'),
        new Date('2026-12-31')
      );

      expect(result).toHaveLength(1);
      expect(result[0].sourceChannel).toBe('FO_REFERRAL');
      expect(result[0].totalApplications).toBe(2);
    });

    it('should handle empty candidate list', async () => {
      (prisma.candidate.findMany as jest.Mock).mockResolvedValue([]);

      const result = await AnalyticsEngineService.calculateSourceQualityScores(
        new Date('2026-01-01'),
        new Date('2026-12-31')
      );

      expect(result).toHaveLength(0);
    });

    it('should calculate tier distribution correctly', async () => {
      const mockCandidates = [
        {
          id: '1',
          sourceChannel: 'DRIVER_REFERRAL',
          currentStage: 'ONBOARDED',
          performanceSnapshots: [
            { snapshotType: 'DAY_90', tierAtSnapshot: 'GOLD' },
          ],
        },
        {
          id: '2',
          sourceChannel: 'DRIVER_REFERRAL',
          currentStage: 'ONBOARDED',
          performanceSnapshots: [
            { snapshotType: 'DAY_90', tierAtSnapshot: 'GOLD' },
          ],
        },
        {
          id: '3',
          sourceChannel: 'DRIVER_REFERRAL',
          currentStage: 'ONBOARDED',
          performanceSnapshots: [
            { snapshotType: 'DAY_90', tierAtSnapshot: 'BRONZE' },
          ],
        },
      ];

      (prisma.candidate.findMany as jest.Mock).mockResolvedValue(mockCandidates);

      const result = await AnalyticsEngineService.calculateSourceQualityScores(
        new Date('2026-01-01'),
        new Date('2026-12-31')
      );

      expect(result[0].tierDistribution.GOLD).toBe(2);
      expect(result[0].tierDistribution.BRONZE).toBe(1);
    });
  });

  describe('calculateCompositeScore', () => {
    it('should weight retention at 40%', () => {
      const drivers = [
        { snapshotType: 'DAY_90', isActive: true },
        { snapshotType: 'DAY_90', isActive: true },
        { snapshotType: 'DAY_90', isActive: false },
      ];

      const score = AnalyticsEngineService.calculateCompositeScore(drivers as any);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should return 0 for empty driver list', () => {
      const score = AnalyticsEngineService.calculateCompositeScore([]);
      expect(score).toBe(0);
    });
  });
});
