import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { authenticate } from '../middleware/auth.js';
import { AnalyticsEngineService } from '../services/analytics-engine.service.js';
import { OpsTowerBidirectionalSyncService } from '../services/opstower-bidirectional-sync.service.js';

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // ==========================================
  // SOURCE QUALITY SCOREBOARD
  // ==========================================

  app.get('/source-quality/scoreboard', async (request, reply) => {
    const query = z.object({
      period: z.enum(['30d', '90d', '6m', '12m']).default('90d'),
      zoneId: z.string().optional(),
      serviceType: z.enum(['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY']).optional(),
    }).parse(request.query);

    // Calculate period dates
    const periodEnd = new Date();
    const periodStart = new Date();
    
    switch (query.period) {
      case '30d':
        periodStart.setDate(periodStart.getDate() - 30);
        break;
      case '90d':
        periodStart.setDate(periodStart.getDate() - 90);
        break;
      case '6m':
        periodStart.setMonth(periodStart.getMonth() - 6);
        break;
      case '12m':
        periodStart.setFullYear(periodStart.getFullYear() - 1);
        break;
    }

    // Ensure scores are calculated
    await AnalyticsEngineService.calculateSourceQualityScores(periodStart, periodEnd);

    const scoreboard = await AnalyticsEngineService.getSourceQualityScoreboard(
      periodStart,
      periodEnd,
      {
        zoneId: query.zoneId,
        serviceType: query.serviceType,
      }
    );

    return {
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        label: query.period,
      },
      scoreboard,
      filters: {
        zoneId: query.zoneId,
        serviceType: query.serviceType,
      },
    };
  });

  // ==========================================
  // SOURCE DETAIL DRILL-DOWN
  // ==========================================

  app.get('/source-quality/detail/:sourceChannel', async (request, reply) => {
    const params = z.object({
      sourceChannel: z.string(),
    }).parse(request.params);

    const query = z.object({
      period: z.enum(['30d', '90d', '6m', '12m']).default('90d'),
    }).parse(request.query);

    const periodEnd = new Date();
    const periodStart = new Date();
    
    switch (query.period) {
      case '30d':
        periodStart.setDate(periodStart.getDate() - 30);
        break;
      case '90d':
        periodStart.setDate(periodStart.getDate() - 90);
        break;
      case '6m':
        periodStart.setMonth(periodStart.getMonth() - 6);
        break;
      case '12m':
        periodStart.setFullYear(periodStart.getFullYear() - 1);
        break;
    }

    const detail = await AnalyticsEngineService.getSourceDetail(
      params.sourceChannel,
      periodStart,
      periodEnd
    );

    if (!detail) {
      return reply.status(404).send({ error: 'Source not found for period' });
    }

    return detail;
  });

  // ==========================================
  // RECRUITER PERFORMANCE
  // ==========================================

  app.get('/recruiter-performance', async (request, reply) => {
    // Only for managers and admins
    if (!['ADMIN', 'RECRUITMENT_MANAGER'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    const query = z.object({
      period: z.enum(['30d', '90d', '6m']).default('90d'),
    }).parse(request.query);

    const periodEnd = new Date();
    const periodStart = new Date();
    
    switch (query.period) {
      case '30d':
        periodStart.setDate(periodStart.getDate() - 30);
        break;
      case '90d':
        periodStart.setDate(periodStart.getDate() - 90);
        break;
      case '6m':
        periodStart.setMonth(periodStart.getMonth() - 6);
        break;
    }

    const performance = await AnalyticsEngineService.getRecruiterPerformance(
      periodStart,
      periodEnd
    );

    return {
      period: {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString(),
        label: query.period,
      },
      recruiters: performance,
    };
  });

  // ==========================================
  // CAMPAIGN QUALITY REPORT
  // ==========================================

  app.get('/campaign-quality/:campaignId', async (request, reply) => {
    const params = z.object({
      campaignId: z.string(),
    }).parse(request.params);

    // This would integrate with Marketing Hub to get campaign data
    // For now, return mock data structure
    const report = {
      campaign: {
        id: params.campaignId,
        name: 'Facebook Driver Recruitment Q1',
        dates: '2026-01-01 to 2026-03-31',
      },
      metrics: {
        totalSpend: 500000, // ₱
        applicationsAttributed: 248,
        onboarded: 38,
        costPerApplication: 2016, // ₱
        costPerOnboard: 13158, // ₱
        retention90Day: 65,
        activeAt90Days: 25,
        costPerRetainedDriver: 20000, // ₱
        avgQualityScore: 72,
        bestZone: 'Metro Manila',
      },
    };

    return report;
  });

  // ==========================================
  // ZONE SOURCING REPORT
  // ==========================================

  app.get('/zone-sourcing', async (request, reply) => {
    const query = z.object({
      period: z.enum(['30d', '90d']).default('90d'),
    }).parse(request.query);

    const zones = await prisma.zone.findMany({
      where: { isActive: true },
    });

    const report = await Promise.all(
      zones.map(async (zone) => {
        const candidates = await prisma.candidate.count({
          where: {
            zoneId: zone.id,
            createdAt: {
              gte: new Date(Date.now() - (query.period === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000),
            },
          },
        });

        const onboarded = await prisma.candidate.count({
          where: {
            zoneId: zone.id,
            currentStage: 'ONBOARDED',
            createdAt: {
              gte: new Date(Date.now() - (query.period === '30d' ? 30 : 90) * 24 * 60 * 60 * 1000),
            },
          },
        });

        return {
          zoneId: zone.id,
          zoneName: zone.name,
          totalOnboarded: onboarded,
          headcountGap: 15, // Mock - would come from OpsTower
          topSourceByVolume: 'FO_REFERRAL', // Mock
          topSourceByQuality: 'DRIVER_REFERRAL', // Mock
        };
      })
    );

    return {
      period: query.period,
      zones: report,
    };
  });

  // ==========================================
  // SYNC STATUS
  // ==========================================

  app.get('/sync-status', async (request, reply) => {
    // Only for admins
    if (request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const status = await OpsTowerBidirectionalSyncService.getSyncStatusOverview();
    return status;
  });

  // Trigger sync retry
  app.post('/sync/:candidateId/retry', async (request, reply) => {
    if (request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const params = z.object({
      candidateId: z.string(),
    }).parse(request.params);

    const result = await OpsTowerBidirectionalSyncService.sendRecruitmentMetadata(
      params.candidateId
    );

    if (!result.success) {
      return reply.status(500).send({ error: result.error });
    }

    return { success: true, message: 'Sync triggered successfully' };
  });

  // ==========================================
  // MANUAL SCORE CALCULATION
  // ==========================================

  app.post('/calculate-scores', async (request, reply) => {
    // Only for admins
    if (request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const body = z.object({
      periodStart: z.string().datetime(),
      periodEnd: z.string().datetime(),
    }).parse(request.body);

    await AnalyticsEngineService.calculateSourceQualityScores(
      new Date(body.periodStart),
      new Date(body.periodEnd)
    );

    return { success: true, message: 'Scores calculated successfully' };
  });
}
