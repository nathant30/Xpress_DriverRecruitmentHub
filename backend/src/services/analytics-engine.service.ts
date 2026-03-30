import { prisma } from '../server.js';
import { PipelineStage, SourceChannel } from '@prisma/client';

interface QualityScoreComponents {
  retention90DayWeight: number;      // 40%
  completionRate30DayWeight: number; // 30%
  bronzePlusRateWeight: number;      // 30%
}

interface SourceQualityMetrics {
  sourceChannel: string;
  zoneId?: string;
  serviceType?: string;
  periodStart: Date;
  periodEnd: Date;
  
  // Pipeline
  applicationCount: number;
  onboardedCount: number;
  
  // Post-hire
  retention90Day?: number;
  avgCompletionRate30Day?: number;
  bronzePlusRate90Day?: number;
  
  // Quality Score
  qualityScore?: number;
  sampleSize: number;
  hasSufficientData: boolean;
}

/**
 * Analytics Engine for calculating source quality metrics
 * Computes pipeline funnel metrics and post-hire quality scores
 */
export class AnalyticsEngineService {
  
  // ==========================================
  // SOURCE QUALITY SCORE CALCULATION
  // ==========================================

  /**
   * Calculate quality scores for all sources in a period
   * This should run daily or weekly via cron job
   */
  static async calculateSourceQualityScores(
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    console.log(`📊 Calculating source quality scores for ${periodStart.toDateString()} - ${periodEnd.toDateString()}`);

    // Get all source channels
    const sourceChannels = Object.values(SourceChannel);
    
    for (const sourceChannel of sourceChannels) {
      // Calculate with different dimensions
      await this.calculateForSource(sourceChannel, null, null, periodStart, periodEnd);
      
      // Get all zones and service types for this source
      const candidates = await prisma.candidate.findMany({
        where: {
          sourceChannel,
          createdAt: { gte: periodStart, lte: periodEnd },
        },
        select: {
          zoneId: true,
          serviceType: true,
        },
        distinct: ['zoneId', 'serviceType'],
      });

      // Calculate per zone
      const uniqueZones = [...new Set(candidates.map(c => c.zoneId))];
      for (const zoneId of uniqueZones) {
        await this.calculateForSource(sourceChannel, zoneId, null, periodStart, periodEnd);
      }

      // Calculate per service type
      const uniqueServiceTypes = [...new Set(candidates.map(c => c.serviceType))];
      for (const serviceType of uniqueServiceTypes) {
        await this.calculateForSource(sourceChannel, null, serviceType, periodStart, periodEnd);
      }
    }

    console.log('✅ Source quality score calculation complete');
  }

  private static async calculateForSource(
    sourceChannel: string,
    zoneId: string | null,
    serviceType: string | null,
    periodStart: Date,
    periodEnd: Date
  ): Promise<void> {
    // Build where clause
    const where: any = {
      sourceChannel,
      createdAt: { gte: periodStart, lte: periodEnd },
    };
    if (zoneId) where.zoneId = zoneId;
    if (serviceType) where.serviceType = serviceType;

    // Get all candidates from this source in period
    const candidates = await prisma.candidate.findMany({
      where,
      include: {
        documents: true,
        interactionLogs: true,
      },
    });

    if (candidates.length === 0) return;

    // Get onboarded candidates
    const onboardedCandidates = candidates.filter(
      c => c.currentStage === PipelineStage.ONBOARDED && c.opstowerDriverId
    );

    // Calculate pipeline metrics
    const pipelineMetrics = this.calculatePipelineMetrics(candidates);

    // Calculate post-hire metrics (if we have onboarded drivers)
    let postHireMetrics = null;
    if (onboardedCandidates.length > 0) {
      postHireMetrics = await this.calculatePostHireMetrics(onboardedCandidates.map(c => c.id));
    }

    // Calculate quality score
    const qualityScore = postHireMetrics 
      ? this.calculateQualityScore(postHireMetrics)
      : null;

    // Get prior period for trend
    const priorPeriodScore = await this.getPriorPeriodScore(
      sourceChannel,
      zoneId,
      serviceType,
      periodStart
    );

    const trend = this.calculateTrend(qualityScore?.score, priorPeriodScore);

    // Upsert quality score record
    await prisma.sourceQualityScore.upsert({
      where: {
        sourceChannel_zoneId_serviceType_periodStart: {
          sourceChannel,
          zoneId,
          serviceType,
          periodStart,
        },
      },
      update: {
        periodEnd,
        ...pipelineMetrics,
        ...postHireMetrics,
        qualityScore: qualityScore?.score,
        qualityScoreComponents: qualityScore?.components,
        priorPeriodQualityScore: priorPeriodScore,
        trend,
        sampleSize: onboardedCandidates.length,
        hasSufficientData: onboardedCandidates.length >= 10,
      },
      create: {
        sourceChannel,
        zoneId,
        serviceType,
        periodStart,
        periodEnd,
        ...pipelineMetrics,
        ...postHireMetrics,
        qualityScore: qualityScore?.score,
        qualityScoreComponents: qualityScore?.components,
        priorPeriodQualityScore: priorPeriodScore,
        trend,
        sampleSize: onboardedCandidates.length,
        hasSufficientData: onboardedCandidates.length >= 10,
      },
    });
  }

  private static calculatePipelineMetrics(candidates: any[]) {
    const total = candidates.length;
    
    return {
      applicationCount: total,
      screenedCount: candidates.filter(c => 
        ['SCREENING', 'DOCS_SUBMITTED', 'DOCS_VERIFIED', 'BACKGROUND_CHECK', 
         'TRAINING', 'VEHICLE_INSPECTION', 'CONTRACT_SIGNING', 'ONBOARDED'].includes(c.currentStage)
      ).length,
      docsSubmittedCount: candidates.filter(c => 
        ['DOCS_SUBMITTED', 'DOCS_VERIFIED', 'BACKGROUND_CHECK', 'TRAINING', 
         'VEHICLE_INSPECTION', 'CONTRACT_SIGNING', 'ONBOARDED'].includes(c.currentStage)
      ).length,
      docsVerifiedCount: candidates.filter(c => 
        ['DOCS_VERIFIED', 'BACKGROUND_CHECK', 'TRAINING', 'VEHICLE_INSPECTION', 
         'CONTRACT_SIGNING', 'ONBOARDED'].includes(c.currentStage)
      ).length,
      backgroundCheckCount: candidates.filter(c => 
        ['BACKGROUND_CHECK', 'TRAINING', 'VEHICLE_INSPECTION', 'CONTRACT_SIGNING', 'ONBOARDED'].includes(c.currentStage)
      ).length,
      trainingCompletedCount: candidates.filter(c => 
        ['TRAINING', 'VEHICLE_INSPECTION', 'CONTRACT_SIGNING', 'ONBOARDED'].includes(c.currentStage)
      ).length,
      onboardedCount: candidates.filter(c => c.currentStage === PipelineStage.ONBOARDED).length,
      rejectedCount: candidates.filter(c => c.currentStage === PipelineStage.REJECTED).length,
      withdrawnCount: candidates.filter(c => c.currentStage === PipelineStage.WITHDRAWN).length,
      
      // Rates
      screeningPassRate: total > 0 ? (candidates.filter(c => 
        ['SCREENING', 'DOCS_SUBMITTED', 'DOCS_VERIFIED', 'BACKGROUND_CHECK', 
         'TRAINING', 'VEHICLE_INSPECTION', 'CONTRACT_SIGNING', 'ONBOARDED'].includes(c.currentStage)
      ).length / total) * 100 : null,
      
      documentCompletionRate: candidates.filter(c => 
        ['SCREENING', 'DOCS_SUBMITTED', 'DOCS_VERIFIED', 'BACKGROUND_CHECK', 
         'TRAINING', 'VEHICLE_INSPECTION', 'CONTRACT_SIGNING', 'ONBOARDED'].includes(c.currentStage)
      ).length > 0 ? (candidates.filter(c => 
        ['DOCS_SUBMITTED', 'DOCS_VERIFIED', 'BACKGROUND_CHECK', 'TRAINING', 
         'VEHICLE_INSPECTION', 'CONTRACT_SIGNING', 'ONBOARDED'].includes(c.currentStage)
      ).length / candidates.filter(c => 
        ['SCREENING', 'DOCS_SUBMITTED', 'DOCS_VERIFIED', 'BACKGROUND_CHECK', 
         'TRAINING', 'VEHICLE_INSPECTION', 'CONTRACT_SIGNING', 'ONBOARDED'].includes(c.currentStage)
      ).length) * 100 : null,
      
      overallConversionRate: total > 0 ? (candidates.filter(c => 
        c.currentStage === PipelineStage.ONBOARDED
      ).length / total) * 100 : null,
      
      avgDaysToOnboard: this.calculateAvgDaysToOnboard(candidates),
    };
  }

  private static async calculatePostHireMetrics(candidateIds: string[]) {
    if (candidateIds.length === 0) return null;

    // Get latest snapshots for each candidate
    const snapshots = await prisma.driverPerformanceSnapshot.findMany({
      where: {
        candidateId: { in: candidateIds },
      },
      orderBy: { snapshotDate: 'desc' },
      distinct: ['candidateId', 'snapshotType'],
    });

    // Group by type
    const firstShiftSnapshots = snapshots.filter(s => s.snapshotType === 'FIRST_SHIFT');
    const day30Snapshots = snapshots.filter(s => s.snapshotType === 'DAY_30');
    const day90Snapshots = snapshots.filter(s => s.snapshotType === 'DAY_90');
    const deactivationSnapshots = snapshots.filter(s => s.snapshotType === 'DEACTIVATION');

    // Calculate retention at 90 days
    const retention90Day = day90Snapshots.length > 0
      ? (day90Snapshots.filter(s => s.isStillActive).length / day90Snapshots.length) * 100
      : null;

    // Calculate avg completion rate at 30 days
    const avgCompletionRate30Day = day30Snapshots.length > 0
      ? day30Snapshots.reduce((sum, s) => sum + (s.avgCompletionRate || 0), 0) / day30Snapshots.length
      : null;

    // Calculate GMV at 30 days
    const avgGmv30Day = day30Snapshots.length > 0
      ? day30Snapshots.reduce((sum, s) => sum + (s.gmvGenerated || 0), 0) / day30Snapshots.length
      : null;

    // Calculate tier distribution at 90 days
    const bronzePlusCount = day90Snapshots.filter(s => 
      ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].includes(s.currentTier || '')
    ).length;
    const bronzePlusRate90Day = day90Snapshots.length > 0
      ? (bronzePlusCount / day90Snapshots.length) * 100
      : null;

    // Calculate early deactivation rate
    const earlyDeactivationRate = candidateIds.length > 0
      ? (deactivationSnapshots.length / candidateIds.length) * 100
      : null;

    // Calculate first shift completion
    const firstShiftCompletionRate = firstShiftSnapshots.length > 0
      ? (firstShiftSnapshots.filter(s => s.firstShiftDate).length / firstShiftSnapshots.length) * 100
      : null;

    // Calculate retention at 30 and 60 days
    const retention30Day = day30Snapshots.length > 0
      ? (day30Snapshots.filter(s => s.isStillActive).length / day30Snapshots.length) * 100
      : null;

    return {
      firstShiftCompletionRate,
      retention30Day,
      retention60Day: null, // Would need DAY_60 snapshots
      retention90Day,
      avgCompletionRate30Day,
      avgGmv30Day,
      bronzePlusRate90Day,
      earlyDeactivationRate,
    };
  }

  private static calculateQualityScore(postHireMetrics: any): {
    score: number;
    components: any;
  } | null {
    const weights = {
      retention90Day: 0.40,
      completionRate30Day: 0.30,
      bronzePlusRate: 0.30,
    };

    // Normalize each metric to 0-100 scale
    const retentionScore = postHireMetrics.retention90Day || 0;
    const completionScore = postHireMetrics.avgCompletionRate30Day 
      ? (postHireMetrics.avgCompletionRate30Day / 100) * 100 
      : 0;
    const tierScore = postHireMetrics.bronzePlusRate90Day || 0;

    // Calculate weighted score
    const score = (
      retentionScore * weights.retention90Day +
      completionScore * weights.completionRate30Day +
      tierScore * weights.bronzePlusRate
    );

    return {
      score: Math.round(score * 10) / 10, // Round to 1 decimal
      components: {
        retention90Day: { value: retentionScore, weight: weights.retention90Day, contribution: retentionScore * weights.retention90Day },
        completionRate30Day: { value: completionScore, weight: weights.completionRate30Day, contribution: completionScore * weights.completionRate30Day },
        bronzePlusRate: { value: tierScore, weight: weights.bronzePlusRate, contribution: tierScore * weights.bronzePlusRate },
      },
    };
  }

  /**
   * Calculate composite quality score from driver performance data
   * Used by tests and external services
   */
  static calculateCompositeScore(drivers: Array<{ isActive?: boolean; snapshotType?: string }>): number {
    if (!drivers || drivers.length === 0) return 0;

    // Filter for 90-day snapshots
    const day90Snapshots = drivers.filter(d => d.snapshotType === 'DAY_90');
    if (day90Snapshots.length === 0) return 0;

    // Calculate retention (40%)
    const activeCount = day90Snapshots.filter(d => d.isActive).length;
    const retentionRate = (activeCount / day90Snapshots.length) * 100;

    // For this simplified version, we weight retention at 40%
    // Full implementation would include completion rate and tier distribution
    const weightedScore = retentionRate * 0.4;

    return Math.round(weightedScore);
  }

  private static calculateAvgDaysToOnboard(candidates: any[]): number | null {
    const onboardedWithDates = candidates.filter(
      c => c.currentStage === PipelineStage.ONBOARDED && c.stageEnteredAt
    );

    if (onboardedWithDates.length === 0) return null;

    const totalDays = onboardedWithDates.reduce((sum, c) => {
      const days = Math.floor(
        (c.stageEnteredAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      return sum + days;
    }, 0);

    return Math.round((totalDays / onboardedWithDates.length) * 10) / 10;
  }

  private static async getPriorPeriodScore(
    sourceChannel: string,
    zoneId: string | null,
    serviceType: string | null,
    currentPeriodStart: Date
  ): Promise<number | null> {
    // Calculate prior period (same duration)
    const periodDuration = currentPeriodStart.getTime() - new Date(currentPeriodStart.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();
    const priorPeriodStart = new Date(currentPeriodStart.getTime() - periodDuration);
    const priorPeriodEnd = new Date(currentPeriodStart.getTime() - 1);

    const priorScore = await prisma.sourceQualityScore.findUnique({
      where: {
        sourceChannel_zoneId_serviceType_periodStart: {
          sourceChannel,
          zoneId,
          serviceType,
          periodStart: priorPeriodStart,
        },
      },
    });

    return priorScore?.qualityScore || null;
  }

  private static calculateTrend(
    currentScore: number | null | undefined,
    priorScore: number | null | undefined
  ): string {
    if (currentScore === null || currentScore === undefined || priorScore === null || priorScore === undefined) {
      return 'STABLE';
    }

    const diff = currentScore - priorScore;
    const threshold = 5; // 5 point change is significant

    if (diff > threshold) return 'IMPROVED';
    if (diff < -threshold) return 'DECLINED';
    return 'STABLE';
  }

  // ==========================================
  // QUERY METHODS FOR API
  // ==========================================

  static async getSourceQualityScoreboard(
    periodStart: Date,
    periodEnd: Date,
    filters?: {
      zoneId?: string;
      serviceType?: string;
    }
  ): Promise<any[]> {
    const where: any = {
      periodStart,
      periodEnd,
      zoneId: filters?.zoneId || null,
      serviceType: filters?.serviceType || null,
    };

    const scores = await prisma.sourceQualityScore.findMany({
      where,
      orderBy: { qualityScore: 'desc' },
    });

    return scores.map((score, index) => ({
      rank: index + 1,
      sourceChannel: score.sourceChannel,
      applications: score.applicationCount,
      onboarded: score.onboardedCount,
      conversionRate: score.overallConversionRate,
      retention90Day: score.retention90Day,
      avgCompletionRate: score.avgCompletionRate30Day,
      bronzePlusRate: score.bronzePlusRate90Day,
      qualityScore: score.qualityScore,
      trend: score.trend,
      hasSufficientData: score.hasSufficientData,
      sampleSize: score.sampleSize,
    }));
  }

  static async getSourceDetail(
    sourceChannel: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<any> {
    const score = await prisma.sourceQualityScore.findFirst({
      where: {
        sourceChannel,
        periodStart,
        periodEnd,
        zoneId: null,
        serviceType: null,
      },
    });

    if (!score) return null;

    // Get waterfall data
    const candidates = await prisma.candidate.findMany({
      where: {
        sourceChannel,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
      select: {
        currentStage: true,
      },
    });

    const waterfall = [
      { stage: 'Applications', count: candidates.length, percentOfApplications: 100, dropOff: 0 },
      { stage: 'Screening', count: 0, percentOfApplications: 0, dropOff: 0 },
      { stage: 'Docs Submitted', count: 0, percentOfApplications: 0, dropOff: 0 },
      { stage: 'Docs Verified', count: 0, percentOfApplications: 0, dropOff: 0 },
      { stage: 'Background Check', count: 0, percentOfApplications: 0, dropOff: 0 },
      { stage: 'Training', count: 0, percentOfApplications: 0, dropOff: 0 },
      { stage: 'Contract Signing', count: 0, percentOfApplications: 0, dropOff: 0 },
      { stage: 'Onboarded', count: 0, percentOfApplications: 0, dropOff: 0 },
    ];

    // Calculate counts per stage
    const stageOrder = [
      'SCREENING', 'DOCS_SUBMITTED', 'DOCS_VERIFIED', 'BACKGROUND_CHECK',
      'TRAINING', 'VEHICLE_INSPECTION', 'CONTRACT_SIGNING', 'ONBOARDED'
    ];

    for (let i = 0; i < stageOrder.length; i++) {
      const stage = stageOrder[i];
      const count = candidates.filter(c => {
        const stageIndex = stageOrder.indexOf(c.currentStage);
        return stageIndex >= i || c.currentStage === 'ONBOARDED';
      }).length;
      
      waterfall[i + 1].count = count;
      waterfall[i + 1].percentOfApplications = candidates.length > 0 ? (count / candidates.length) * 100 : 0;
      
      const priorCount = i === 0 ? candidates.length : waterfall[i].count;
      waterfall[i + 1].dropOff = priorCount - count;
    }

    return {
      ...score,
      waterfall,
    };
  }

  static async getRecruiterPerformance(
    periodStart: Date,
    periodEnd: Date
  ): Promise<any[]> {
    const recruiters = await prisma.user.findMany({
      where: {
        role: { in: ['RECRUITER', 'RECRUITMENT_MANAGER'] },
        isActive: true,
      },
    });

    const performance = await Promise.all(
      recruiters.map(async (recruiter) => {
        const candidates = await prisma.candidate.findMany({
          where: {
            assignedRecruiterId: recruiter.id,
            createdAt: { gte: periodStart, lte: periodEnd },
          },
          include: {
            performanceSnapshots: true,
          },
        });

        const onboarded = candidates.filter(c => c.currentStage === 'ONBOARDED');
        
        // Get quality scores for onboarded drivers
        const qualityScores = await prisma.sourceQualityScore.findMany({
          where: {
            recruiterId: recruiter.id,
            periodStart,
            periodEnd,
          },
        });

        const avgQualityScore = qualityScores.length > 0
          ? qualityScores.reduce((sum, s) => sum + (s.qualityScore || 0), 0) / qualityScores.length
          : null;

        return {
          recruiterId: recruiter.id,
          recruiterName: recruiter.fullName,
          avatarUrl: recruiter.avatarUrl,
          candidatesManaged: candidates.length,
          onboarded: onboarded.length,
          conversionRate: candidates.length > 0 ? (onboarded.length / candidates.length) * 100 : 0,
          avgDaysToOnboard: this.calculateAvgDaysToOnboard(candidates),
          qualityScore: avgQualityScore,
        };
      })
    );

    return performance.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));
  }
}
