import { prisma } from '../server.js';
import { appConfig } from '../config/app.config.js';
import { Candidate, PipelineStage } from '@prisma/client';
import axios from 'axios';

// OpsTower API Client
const opstowerApi = axios.create({
  baseURL: appConfig.opstowerApiUrl,
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': appConfig.opstowerApiKey || '',
  },
  timeout: 30000, // 30 second timeout
});

interface RecruitmentMetadataPayload {
  recruitment_source_channel: string;
  recruitment_source_campaign_id?: string;
  recruitment_source_fo_id?: string;
  recruitment_referring_driver_id?: string;
  recruitment_source_agency_id?: string;
  recruitment_pipeline_variant: string;
  recruitment_days_to_onboard: number;
  recruitment_quiz_score?: number;
  recruitment_recruiter_id?: string;
  recruitment_zone_id: string;
  recruitment_service_type: string;
  recruitment_candidate_id: string;
  recruitment_onboarded_at: string;
}

interface PerformanceSnapshotPayload {
  recruitment_candidate_id: string;
  snapshot_type: 'FIRST_SHIFT' | 'DAY_30' | 'DAY_60' | 'DAY_90' | 'TIER_CHANGE' | 'DEACTIVATION';
  snapshot_date: string;
  days_since_onboarding: number;
  
  // Performance metrics
  is_still_active?: boolean;
  trips_completed?: number;
  avg_completion_rate?: number;
  avg_cancellation_rate?: number;
  gmv_generated?: number;
  current_tier?: string;
  incidents_count?: number;
  
  // First shift
  first_shift_date?: string;
  first_shift_trips?: number;
  first_shift_gmv?: number;
  first_shift_completion_rate?: number;
  
  // Tier change
  prior_tier?: string;
  new_tier?: string;
  
  // Deactivation
  deactivation_date?: string;
  deactivation_reason?: string;
  days_active_total?: number;
}

/**
 * Bidirectional sync service for OpsTower V3 integration
 * Handles data flow: Recruitment Hub → OpsTower (onboarding)
 * and OpsTower → Recruitment Hub (performance snapshots)
 */
export class OpsTowerBidirectionalSyncService {
  
  // ==========================================
  // RECRUITMENT HUB → OPSTOWER (Onboarding)
  // ==========================================
  
  /**
   * Send recruitment metadata to OpsTower when driver is onboarded
   * This is a one-time write per driver
   */
  static async sendRecruitmentMetadata(candidateId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: {
          documents: true,
          applicationData: true,
          interactionLogs: {
            orderBy: { loggedAt: 'desc' },
            take: 1,
            where: { stageAfter: PipelineStage.ONBOARDED },
          },
        },
      });

      if (!candidate) {
        return { success: false, error: 'Candidate not found' };
      }

      if (!candidate.opstowerDriverId) {
        return { success: false, error: 'No OpsTower driver ID associated' };
      }

      // Calculate days to onboard
      const daysToOnboard = Math.floor(
        (candidate.stageEnteredAt.getTime() - candidate.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Get quiz score from application data if available
      const quizScore = this.extractQuizScore(candidate);

      const payload: RecruitmentMetadataPayload = {
        recruitment_source_channel: candidate.sourceChannel,
        recruitment_source_campaign_id: candidate.sourceCampaignId || undefined,
        recruitment_source_fo_id: candidate.sourceFoId || undefined,
        recruitment_referring_driver_id: candidate.sourceReferringDriverId || undefined,
        recruitment_source_agency_id: candidate.sourceAgencyId || undefined,
        recruitment_pipeline_variant: candidate.pipelineVariant,
        recruitment_days_to_onboard: daysToOnboard,
        recruitment_quiz_score: quizScore,
        recruitment_recruiter_id: candidate.assignedRecruiterId || undefined,
        recruitment_zone_id: candidate.zoneId,
        recruitment_service_type: candidate.serviceType,
        recruitment_candidate_id: candidate.id,
        recruitment_onboarded_at: candidate.stageEnteredAt.toISOString(),
      };

      // Track sync attempt
      await this.trackSyncAttempt(
        'CANDIDATE',
        candidateId,
        'TO_OPSTOWER',
        'ONBOARDING_METADATA',
        payload
      );

      // Send to OpsTower (or mock if not configured)
      if (!appConfig.opstowerApiUrl) {
        console.log('⚠️ No OpsTower API configured, simulating metadata sync');
        await this.simulateSuccessfulSync(candidateId, 'ONBOARDING_METADATA');
        return { success: true };
      }

      await opstowerApi.post(
        `/api/v3/drivers/${candidate.opstowerDriverId}/recruitment-metadata`,
        payload
      );

      // Mark sync as successful
      await this.markSyncSuccess(candidateId, 'ONBOARDING_METADATA');

      return { success: true };
    } catch (error: any) {
      console.error('Failed to send recruitment metadata:', error);
      
      // Schedule retry
      await this.scheduleRetry(
        'CANDIDATE',
        candidateId,
        'TO_OPSTOWER',
        'ONBOARDING_METADATA',
        error.message
      );

      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // OPSTOWER → RECRUITMENT HUB (Performance)
  // ==========================================

  /**
   * Receive performance snapshot from OpsTower
   * Called by webhook handler
   */
  static async receivePerformanceSnapshot(
    payload: PerformanceSnapshotPayload
  ): Promise<void> {
    try {
      // Find candidate by reverse link
      const candidate = await prisma.candidate.findFirst({
        where: {
          id: payload.recruitment_candidate_id,
          opstowerDriverId: { not: null },
        },
      });

      if (!candidate) {
        // Legacy driver or not found - skip per FR-SYNC05
        console.log(`No candidate found for recruitment_candidate_id: ${payload.recruitment_candidate_id}`);
        return;
      }

      // Store snapshot
      await prisma.driverPerformanceSnapshot.create({
        data: {
          candidateId: candidate.id,
          snapshotType: payload.snapshot_type,
          snapshotDate: new Date(payload.snapshot_date),
          daysSinceOnboarding: payload.days_since_onboarding,
          
          // Performance metrics
          isStillActive: payload.is_still_active,
          tripsCompleted: payload.trips_completed,
          avgCompletionRate: payload.avg_completion_rate,
          avgCancellationRate: payload.avg_cancellation_rate,
          gmvGenerated: payload.gmv_generated,
          currentTier: payload.current_tier,
          incidentsCount: payload.incidents_count,
          
          // First shift
          firstShiftDate: payload.first_shift_date ? new Date(payload.first_shift_date) : null,
          firstShiftTrips: payload.first_shift_trips,
          firstShiftGmv: payload.first_shift_gmv,
          firstShiftCompletionRate: payload.first_shift_completion_rate,
          
          // Tier change
          priorTier: payload.prior_tier,
          newTier: payload.new_tier,
          
          // Deactivation
          deactivationDate: payload.deactivation_date ? new Date(payload.deactivation_date) : null,
          deactivationReason: payload.deactivation_reason,
          daysActiveTotal: payload.days_active_total,
          
          // Raw data for debugging
          rawData: payload as any,
        },
      });

      // Update candidate status based on snapshot
      await this.updateCandidateStatusFromSnapshot(candidate.id, payload);

      // Trigger quality score recalculation
      await this.triggerQualityScoreRecalculation(candidate.sourceChannel);

      console.log(`✅ Stored ${payload.snapshot_type} snapshot for candidate ${candidate.id}`);
    } catch (error) {
      console.error('Failed to process performance snapshot:', error);
      throw error;
    }
  }

  /**
   * Update candidate status based on performance snapshot
   */
  private static async updateCandidateStatusFromSnapshot(
    candidateId: string,
    payload: PerformanceSnapshotPayload
  ): Promise<void> {
    // Handle deactivation
    if (payload.snapshot_type === 'DEACTIVATION' && payload.deactivation_date) {
      await prisma.candidateInteractionLog.create({
        data: {
          candidateId,
          recruiterId: 'system',
          interactionDate: new Date(),
          interactionType: 'NOTE',
          outcome: 'NEEDS_FOLLOWUP',
          summary: `Driver deactivated in OpsTower: ${payload.deactivation_reason || 'Unknown reason'}`,
          editExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }

    // Handle tier changes
    if (payload.snapshot_type === 'TIER_CHANGE' && payload.new_tier) {
      await prisma.candidateInteractionLog.create({
        data: {
          candidateId,
          recruiterId: 'system',
          interactionDate: new Date(),
          interactionType: 'NOTE',
          outcome: 'POSITIVE',
          summary: `Driver tier changed from ${payload.prior_tier} to ${payload.new_tier}`,
          editExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // ==========================================
  // SYNC STATUS TRACKING
  // ==========================================

  private static async trackSyncAttempt(
    entityType: string,
    entityId: string,
    direction: string,
    syncType: string,
    payload: any
  ): Promise<void> {
    await prisma.syncStatus.upsert({
      where: {
        entityType_entityId_syncType: {
          entityType,
          entityId,
          syncType,
        },
      },
      update: {
        status: 'IN_PROGRESS',
        attemptCount: { increment: 1 },
        lastAttemptAt: new Date(),
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        payloadSize: JSON.stringify(payload).length,
      },
      create: {
        entityType,
        entityId,
        syncDirection: direction,
        syncType,
        status: 'IN_PROGRESS',
        attemptCount: 1,
        lastAttemptAt: new Date(),
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
        payloadSize: JSON.stringify(payload).length,
      },
    });
  }

  private static async markSyncSuccess(
    entityId: string,
    syncType: string
  ): Promise<void> {
    await prisma.syncStatus.updateMany({
      where: {
        entityType: 'CANDIDATE',
        entityId,
        syncType,
      },
      data: {
        status: 'SUCCESS',
        succeededAt: new Date(),
        lastError: null,
        errorDetails: null,
      },
    });
  }

  private static async scheduleRetry(
    entityType: string,
    entityId: string,
    direction: string,
    syncType: string,
    error: string
  ): Promise<void> {
    const existing = await prisma.syncStatus.findUnique({
      where: {
        entityType_entityId_syncType: {
          entityType,
          entityId,
          syncType,
        },
      },
    });

    const attemptCount = existing ? existing.attemptCount + 1 : 1;
    
    // Exponential backoff: 5min, 25min, 2h, 10h, 24h
    const backoffMinutes = [5, 25, 120, 600, 1440][Math.min(attemptCount - 1, 4)];
    
    await prisma.syncStatus.upsert({
      where: {
        entityType_entityId_syncType: {
          entityType,
          entityId,
          syncType,
        },
      },
      update: {
        status: attemptCount >= 288 ? 'FAILED' : 'PENDING', // 24h / 5min = 288 attempts
        attemptCount,
        lastError: error,
        nextRetryAt: new Date(Date.now() + backoffMinutes * 60 * 1000),
      },
      create: {
        entityType,
        entityId,
        syncDirection: direction,
        syncType,
        status: 'PENDING',
        attemptCount: 1,
        lastError: error,
        nextRetryAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
  }

  private static async simulateSuccessfulSync(
    entityId: string,
    syncType: string
  ): Promise<void> {
    await prisma.syncStatus.upsert({
      where: {
        entityType_entityId_syncType: {
          entityType: 'CANDIDATE',
          entityId,
          syncType,
        },
      },
      update: {
        status: 'SUCCESS',
        succeededAt: new Date(),
      },
      create: {
        entityType: 'CANDIDATE',
        entityId,
        syncDirection: 'TO_OPSTOWER',
        syncType,
        status: 'SUCCESS',
        succeededAt: new Date(),
      },
    });
  }

  // ==========================================
  // RETRY PROCESSING
  // ==========================================

  /**
   * Process pending sync retries
   * Call this from a cron job every 5 minutes
   */
  static async processPendingSyncs(): Promise<void> {
    const pendingSyncs = await prisma.syncStatus.findMany({
      where: {
        status: 'PENDING',
        nextRetryAt: { lte: new Date() },
      },
      take: 10, // Process in batches
    });

    for (const sync of pendingSyncs) {
      if (sync.syncType === 'ONBOARDING_METADATA') {
        await this.sendRecruitmentMetadata(sync.entityId);
      }
    }
  }

  /**
   * Get sync status for display in Settings → Sync Status
   */
  static async getSyncStatusOverview(): Promise<{
    pending: number;
    failed: number;
    success: number;
    recentFailures: Array<{
      entityId: string;
      syncType: string;
      attemptCount: number;
      lastError: string | null;
    }>;
  }> {
    const [pending, failed, success, recentFailures] = await Promise.all([
      prisma.syncStatus.count({ where: { status: 'PENDING' } }),
      prisma.syncStatus.count({ where: { status: 'FAILED' } }),
      prisma.syncStatus.count({ where: { status: 'SUCCESS' } }),
      prisma.syncStatus.findMany({
        where: { status: { in: ['FAILED', 'PENDING'] } },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          entityId: true,
          syncType: true,
          attemptCount: true,
          lastError: true,
        },
      }),
    ]);

    return { pending, failed, success, recentFailures };
  }

  // ==========================================
  // QUALITY SCORE TRIGGER
  // ==========================================

  private static async triggerQualityScoreRecalculation(
    sourceChannel: string
  ): Promise<void> {
    // This will be implemented by the analytics service
    // For now, just log it
    console.log(`🔄 Triggering quality score recalculation for ${sourceChannel}`);
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private static extractQuizScore(candidate: Candidate & { applicationData: any }): number | undefined {
    if (!candidate.applicationData?.formData) return undefined;
    
    const formData = candidate.applicationData.formData as any;
    
    // Look for quiz score in various possible locations
    if (formData.quizScore !== undefined) {
      return parseFloat(formData.quizScore);
    }
    if (formData.quiz?.score !== undefined) {
      return parseFloat(formData.quiz.score);
    }
    if (formData.knowledgeCheck?.score !== undefined) {
      return parseFloat(formData.knowledgeCheck.score);
    }
    
    return undefined;
  }
}
