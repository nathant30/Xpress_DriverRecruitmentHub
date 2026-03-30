import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { authenticate } from '../middleware/auth.js';
import { CandidateService } from '../services/candidate.service.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Main dashboard data
  app.get('/', async (request, reply) => {
    const { user } = request;
    
    // Determine accessible zones
    const zoneIds = user.role === 'ADMIN' || user.role === 'RECRUITMENT_MANAGER' 
      ? undefined 
      : user.assignedZoneIds;

    const [
      pipelineMetrics,
      slaBreaches,
      recentCandidates,
      headcountSummary,
      channelStats,
    ] = await Promise.all([
      // Pipeline metrics
      CandidateService.getPipelineMetrics(zoneIds),
      
      // SLA breaches
      CandidateService.getSlaBreaches(zoneIds),
      
      // Recent candidates (last 7 days)
      prisma.candidate.findMany({
        where: zoneIds ? { zoneId: { in: zoneIds } } : {},
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          fullName: true,
          currentStage: true,
          sourceChannel: true,
          createdAt: true,
          zone: { select: { name: true } },
        },
      }),
      
      // Headcount summary
      getHeadcountSummary(zoneIds),
      
      // Channel stats
      getChannelStats(zoneIds),
    ]);

    return {
      pipeline: pipelineMetrics,
      slaBreaches,
      recentCandidates,
      headcount: headcountSummary,
      channels: channelStats,
    };
  });

  // Pipeline funnel data
  app.get('/funnel', async (request, reply) => {
    const { user } = request;
    const zoneIds = user.role === 'ADMIN' || user.role === 'RECRUITMENT_MANAGER' 
      ? undefined 
      : user.assignedZoneIds;

    const where = zoneIds ? { zoneId: { in: zoneIds } } : {};

    // Get counts per stage for last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stageCounts = await prisma.candidate.groupBy({
      by: ['currentStage'],
      where: {
        ...where,
        createdAt: { gte: thirtyDaysAgo },
      },
      _count: { id: true },
    });

    // Get conversion data
    const conversions = await prisma.candidateInteractionLog.groupBy({
      by: ['stageBefore', 'stageAfter'],
      where: {
        interactionType: 'STAGE_TRANSITION',
        loggedAt: { gte: thirtyDaysAgo },
        candidate: zoneIds ? { zoneId: { in: zoneIds } } : {},
      },
      _count: { id: true },
    });

    return {
      stageCounts: stageCounts.map((s) => ({
        stage: s.currentStage,
        count: s._count.id,
      })),
      conversions: conversions.map((c) => ({
        from: c.stageBefore,
        to: c.stageAfter,
        count: c._count.id,
      })),
    };
  });

  // Recruiter performance
  app.get('/recruiter-performance', async (request, reply) => {
    const { user } = request;
    
    // Only ADMIN and RECRUITMENT_MANAGER can see all recruiters
    if (user.role !== 'ADMIN' && user.role !== 'RECRUITMENT_MANAGER') {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recruiters = await prisma.user.findMany({
      where: { role: { in: ['RECRUITER', 'RECRUITMENT_MANAGER'] }, isActive: true },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
      },
    });

    const performance = await Promise.all(
      recruiters.map(async (r) => {
        const [assigned, progressed, onboarded] = await Promise.all([
          prisma.candidate.count({
            where: { assignedRecruiterId: r.id, createdAt: { gte: thirtyDaysAgo } },
          }),
          prisma.candidateInteractionLog.count({
            where: {
              recruiterId: r.id,
              outcome: 'STAGE_ADVANCED',
              loggedAt: { gte: thirtyDaysAgo },
            },
          }),
          prisma.candidate.count({
            where: {
              assignedRecruiterId: r.id,
              currentStage: 'ONBOARDED',
              updatedAt: { gte: thirtyDaysAgo },
            },
          }),
        ]);

        return {
          ...r,
          assigned,
          progressed,
          onboarded,
          conversionRate: assigned > 0 ? Math.round((onboarded / assigned) * 100) : 0,
        };
      })
    );

    return performance.sort((a, b) => b.onboarded - a.onboarded);
  });

  // Time-to-onboard metrics
  app.get('/time-to-onboard', async (request, reply) => {
    const { user } = request;
    const zoneIds = user.role === 'ADMIN' || user.role === 'RECRUITMENT_MANAGER' 
      ? undefined 
      : user.assignedZoneIds;

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const onboarded = await prisma.candidate.findMany({
      where: {
        ...(zoneIds ? { zoneId: { in: zoneIds } } : {}),
        currentStage: 'ONBOARDED',
        updatedAt: { gte: ninetyDaysAgo },
      },
      select: {
        id: true,
        serviceType: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Calculate average days
    const withDays = onboarded.map((c) => ({
      ...c,
      days: Math.floor((c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
    }));

    const byServiceType = groupBy(withDays, 'serviceType');
    const averages = Object.entries(byServiceType).map(([type, items]) => ({
      serviceType: type,
      averageDays: Math.round(items.reduce((sum, i) => sum + i.days, 0) / items.length),
      count: items.length,
    }));

    return {
      overall: {
        averageDays: withDays.length > 0 
          ? Math.round(withDays.reduce((sum, i) => sum + i.days, 0) / withDays.length)
          : 0,
        totalOnboarded: withDays.length,
      },
      byServiceType: averages,
    };
  });
}

// Helper functions
async function getHeadcountSummary(zoneIds?: string[]) {
  const where = zoneIds ? { zoneId: { in: zoneIds } } : {};

  const targets = await prisma.headcountTarget.findMany({
    where: {
      ...where,
      effectiveFrom: { lte: new Date() },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    include: { zone: { select: { name: true } } },
  });

  // In real implementation, these would come from OpsTower API
  // For now, return mock data structure
  return targets.map((t) => ({
    zoneId: t.zoneId,
    zoneName: t.zone.name,
    serviceType: t.serviceType,
    target: t.targetCount,
    currentActive: 0, // From OpsTower
    pipeline: 0, // Calculated
    gap: t.targetCount,
    status: t.recruitingStatus,
  }));
}

async function getChannelStats(zoneIds?: string[]) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const where = {
    ...zoneIds ? { zoneId: { in: zoneIds } } : {},
    createdAt: { gte: thirtyDaysAgo },
  };

  const byChannel = await prisma.candidate.groupBy({
    by: ['sourceChannel'],
    where,
    _count: { id: true },
  });

  return byChannel.map((c) => ({
    channel: c.sourceChannel,
    count: c._count.id,
  }));
}

function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const groupKey = String(item[key]);
    result[groupKey] = result[groupKey] || [];
    result[groupKey].push(item);
    return result;
  }, {} as Record<string, T[]>);
}
