import { prisma } from '../server.js';
import { Candidate, MLPrediction } from '@prisma/client';

interface PredictionResult {
  value: string | number;
  confidence: number;
  explanation: string;
  keyFactors: Array<{
    factor: string;
    weight: number;
    description: string;
  }>;
}

interface PreHireFeatures {
  sourceChannel: string;
  serviceType: string;
  zoneId: string;
  pipelineVariant: string;
  isExistingDriver: boolean;
  applicationCompletionTime?: number;
  quizScore?: number;
  applicationHour: number;
  applicationDayOfWeek: number;
  headcountGapAtApplication: number;
  documentSubmissionSpeed?: number;
  documentApprovalRate?: number;
  candidateResponsiveness?: number;
}

/**
 * ML Prediction Service
 * 
 * Provides ML-powered predictions for the recruitment process.
 * In production, these would call models built by Polina's data science team.
 * For now, they use heuristic/mock implementations with explainability.
 * 
 * Key Principle: ML suggests, humans decide. All predictions require human confirmation.
 */
export class MLPredictionService {
  
  // ==========================================
  // ML-01: PRE-HIRE QUALITY PREDICTION
  // ==========================================

  /**
   * Predict if a candidate will be a high-quality driver
   * Returns: LOW, MEDIUM, HIGH quality prediction
   */
  static async predictPreHireQuality(candidateId: string): Promise<PredictionResult & {
    qualityScore: number; // 0-100
  }> {
    const candidate = await this.getCandidateWithFeatures(candidateId);
    
    if (!candidate) {
      throw new Error('Candidate not found');
    }

    const features = await this.extractPreHireFeatures(candidate);
    
    // Calculate quality score based on features (heuristic model)
    let score = 50; // Base score
    const factors: Array<{ factor: string; weight: number; description: string; impact: number }> = [];

    // Source channel quality (historical data)
    const sourceQuality = await this.getSourceChannelQuality(features.sourceChannel);
    score += sourceQuality * 15;
    factors.push({
      factor: 'Source Channel',
      weight: 0.15,
      description: `${features.sourceChannel} has ${sourceQuality > 0.5 ? 'strong' : 'average'} historical performance`,
      impact: sourceQuality * 15,
    });

    // Existing driver bonus
    if (features.isExistingDriver) {
      score += 20;
      factors.push({
        factor: 'Existing Driver',
        weight: 0.20,
        description: 'Previously verified Xpress driver - significantly higher success rate',
        impact: 20,
      });
    }

    // Quiz score
    if (features.quizScore !== undefined) {
      const quizImpact = (features.quizScore / 100) * 10;
      score += quizImpact;
      factors.push({
        factor: 'Quiz Performance',
        weight: 0.10,
        description: `Scored ${features.quizScore}% on knowledge assessment`,
        impact: quizImpact,
      });
    }

    // Document submission speed
    if (features.documentSubmissionSpeed !== undefined) {
      const speedImpact = features.documentSubmissionSpeed < 3 ? 5 : 
                         features.documentSubmissionSpeed < 7 ? 0 : -5;
      score += speedImpact;
      factors.push({
        factor: 'Document Speed',
        weight: 0.05,
        description: `Submitted documents in ${features.documentSubmissionSpeed} days`,
        impact: speedImpact,
      });
    }

    // Application completion time
    if (features.applicationCompletionTime !== undefined) {
      const completionImpact = features.applicationCompletionTime < 15 ? 5 : 
                              features.applicationCompletionTime < 30 ? 0 : -3;
      score += completionImpact;
      factors.push({
        factor: 'Application Completion',
        weight: 0.05,
        description: `Completed application in ${features.applicationCompletionTime} minutes`,
        impact: completionImpact,
      });
    }

    // Headcount gap (high demand = more support available)
    if (features.headcountGapAtApplication > 10) {
      score += 5;
      factors.push({
        factor: 'Zone Demand',
        weight: 0.05,
        description: 'High demand zone with strong support infrastructure',
        impact: 5,
      });
    }

    // Normalize score to 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine quality level
    let quality: 'HIGH' | 'MEDIUM' | 'LOW';
    if (score >= 75) quality = 'HIGH';
    else if (score >= 50) quality = 'MEDIUM';
    else quality = 'LOW';

    // Store prediction
    await this.storePrediction(candidateId, 'PRE_HIRE_QUALITY', quality, score / 100, factors);

    return {
      value: quality,
      qualityScore: Math.round(score),
      confidence: this.calculateConfidence(factors),
      explanation: `Based on ${factors.length} signals, this candidate shows ${quality.toLowerCase()} potential to become a quality driver. ${factors[0].description}`,
      keyFactors: factors.map(f => ({ factor: f.factor, weight: f.weight, description: f.description })),
    };
  }

  // ==========================================
  // ML-02: PIPELINE DROP-OFF RISK
  // ==========================================

  /**
   * Predict likelihood of candidate withdrawing from pipeline
   * Returns: LOW, MEDIUM, HIGH risk
   */
  static async predictDropOffRisk(candidateId: string): Promise<PredictionResult> {
    const candidate = await this.getCandidateWithFeatures(candidateId);
    
    if (!candidate) {
      throw new Error('Candidate not found');
    }

    const factors: Array<{ factor: string; weight: number; description: string }> = [];
    let riskScore = 50; // Base risk

    // Time in current stage
    const daysInStage = Math.floor(
      (Date.now() - candidate.stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysInStage > 7) {
      riskScore += 20;
      factors.push({
        factor: 'Stage Duration',
        weight: 0.20,
        description: `${daysInStage} days in current stage without progression`,
      });
    }

    // No recruiter contact
    const lastContact = await prisma.candidateInteractionLog.findFirst({
      where: { candidateId },
      orderBy: { loggedAt: 'desc' },
    });

    if (!lastContact || 
        (Date.now() - lastContact.loggedAt.getTime()) / (1000 * 60 * 60 * 24) > 3) {
      riskScore += 15;
      factors.push({
        factor: 'Contact Gap',
        weight: 0.15,
        description: 'No recruiter contact in the last 3 days',
      });
    }

    // Document rejections
    const rejections = await prisma.candidateDocument.count({
      where: { candidateId, status: 'REJECTED' },
    });
    
    if (rejections > 2) {
      riskScore += 15;
      factors.push({
        factor: 'Document Issues',
        weight: 0.15,
        description: `${rejections} documents rejected - may indicate frustration`,
      });
    }

    // Source channel historical withdrawal rate
    const sourceWithdrawalRate = await this.getSourceWithdrawalRate(candidate.sourceChannel);
    if (sourceWithdrawalRate > 0.3) {
      riskScore += 10;
      factors.push({
        factor: 'Source Pattern',
        weight: 0.10,
        description: `${candidate.sourceChannel} has higher than average withdrawal rate`,
      });
    }

    riskScore = Math.max(0, Math.min(100, riskScore));

    let risk: 'HIGH' | 'MEDIUM' | 'LOW';
    if (riskScore >= 70) risk = 'HIGH';
    else if (riskScore >= 40) risk = 'MEDIUM';
    else risk = 'LOW';

    await this.storePrediction(candidateId, 'DROP_OFF_RISK', risk, riskScore / 100, factors);

    return {
      value: risk,
      confidence: this.calculateConfidence(factors),
      explanation: risk === 'HIGH' 
        ? 'Multiple risk factors suggest this candidate may withdraw soon. Immediate recruiter contact recommended.'
        : risk === 'MEDIUM'
        ? 'Some risk factors present. Monitor closely and maintain regular contact.'
        : 'Low risk of withdrawal. Candidate progressing normally.',
      keyFactors: factors,
    };
  }

  // ==========================================
  // ML-03: TIME-TO-ONBOARD PREDICTION
  // ==========================================

  static async predictTimeToOnboard(candidateId: string): Promise<PredictionResult & {
    estimatedDays: number;
    range: { min: number; max: number };
  }> {
    const candidate = await this.getCandidateWithFeatures(candidateId);
    
    if (!candidate) {
      throw new Error('Candidate not found');
    }

    const features = await this.extractPreHireFeatures(candidate);
    const factors: Array<{ factor: string; weight: number; description: string }> = [];

    let baseDays = 14; // Average time to onboard

    // Source channel factor
    const sourceSpeed = await this.getSourceAverageTimeToOnboard(features.sourceChannel);
    baseDays = sourceSpeed;
    factors.push({
      factor: 'Source Channel',
      weight: 0.25,
      description: `${features.sourceChannel} averages ${sourceSpeed} days`,
    });

    // Pipeline variant
    if (features.pipelineVariant === 'ABBREVIATED') {
      baseDays *= 0.6; // 40% faster
      factors.push({
        factor: 'Existing Driver',
        weight: 0.20,
        description: 'Abbreviated pipeline - faster processing',
      });
    }

    // Document submission speed (if known)
    if (features.documentSubmissionSpeed !== undefined) {
      if (features.documentSubmissionSpeed < 2) {
        baseDays *= 0.9;
        factors.push({
          factor: 'Fast Document Submission',
          weight: 0.15,
          description: 'Quick document turnaround suggests motivated candidate',
        });
      }
    }

    // Quiz score
    if (features.quizScore !== undefined && features.quizScore > 80) {
      baseDays *= 0.95;
      factors.push({
        factor: 'High Quiz Score',
        weight: 0.10,
        description: 'Strong knowledge = smoother training',
      });
    }

    const estimatedDays = Math.round(baseDays);
    const range = { min: Math.round(baseDays * 0.7), max: Math.round(baseDays * 1.3) };

    await this.storePrediction(
      candidateId, 
      'TIME_TO_ONBOARD', 
      `${estimatedDays} days`, 
      0.75, 
      factors
    );

    return {
      value: `${estimatedDays} days`,
      estimatedDays,
      range,
      confidence: 0.75,
      explanation: `Based on ${features.sourceChannel} historical data and candidate profile, estimated ${estimatedDays} days (range: ${range.min}-${range.max} days).`,
      keyFactors: factors,
    };
  }

  // ==========================================
  // ML-04: ZONE & ROLE FIT SCORE
  // ==========================================

  static async predictZoneRoleFit(candidateId: string): Promise<PredictionResult & {
    recommendations: Array<{
      zoneId: string;
      serviceType: string;
      fitScore: number;
      reason: string;
    }>;
  }> {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        zone: true,
        documents: true,
      },
    });

    if (!candidate) {
      throw new Error('Candidate not found');
    }

    const zones = await prisma.zone.findMany({ where: { isActive: true } });
    const recommendations = [];
    const factors: Array<{ factor: string; weight: number; description: string }> = [];

    // Current application
    let currentFitScore = 70; // Base

    // Check headcount gap
    const headcountTarget = await prisma.headcountTarget.findFirst({
      where: {
        zoneId: candidate.zoneId,
        serviceType: candidate.serviceType,
      },
    });

    if (headcountTarget) {
      // Mock current active count - in real implementation would come from OpsTower
      const currentActive = 50; 
      const gap = headcountTarget.targetCount - currentActive;
      
      if (gap > 20) {
        currentFitScore += 15;
        factors.push({
          factor: 'High Demand',
          weight: 0.20,
          description: `${candidate.zone.name} has strong demand for ${candidate.serviceType}`,
        });
      }
    }

    // Generate alternative recommendations
    for (const zone of zones.filter(z => z.id !== candidate.zoneId)) {
      const target = await prisma.headcountTarget.findFirst({
        where: { zoneId: zone.id, serviceType: candidate.serviceType },
      });

      if (target) {
        const gap = target.targetCount - 40; // Mock current
        if (gap > 15) {
          recommendations.push({
            zoneId: zone.id,
            serviceType: candidate.serviceType,
            fitScore: Math.round(60 + (gap / target.targetCount) * 30),
            reason: `High demand zone with ${gap} driver gap`,
          });
        }
      }
    }

    // Sort by fit score
    recommendations.sort((a, b) => b.fitScore - a.fitScore);

    await this.storePrediction(candidateId, 'ZONE_ROLE_FIT', 'CALCULATED', currentFitScore / 100, factors);

    return {
      value: currentFitScore >= 80 ? 'STRONG_FIT' : currentFitScore >= 60 ? 'GOOD_FIT' : 'MODERATE_FIT',
      confidence: 0.70,
      explanation: `Current application to ${candidate.zone.name} shows ${currentFitScore >= 80 ? 'strong' : 'good'} fit based on demand and profile.`,
      keyFactors: factors,
      recommendations: recommendations.slice(0, 3), // Top 3 alternatives
    };
  }

  // ==========================================
  // ML-05: OPTIMAL CONTACT TIME
  // ==========================================

  static async predictOptimalContactTime(candidateId: string): Promise<PredictionResult & {
    bestTimes: Array<{
      day: string;
      hour: number;
      confidence: number;
    }>;
  }> {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      throw new Error('Candidate not found');
    }

    // In a real implementation, this would analyze:
    // - Historical response times from this candidate
    // - Similar candidates' response patterns
    // - Time zone and working hours

    // Mock optimal times based on Philippine patterns
    const bestTimes = [
      { day: 'Today', hour: 14, confidence: 0.85 }, // 2 PM
      { day: 'Tomorrow', hour: 10, confidence: 0.78 }, // 10 AM
      { day: 'Tomorrow', hour: 19, confidence: 0.72 }, // 7 PM
    ];

    const factors = [
      {
        factor: 'Application Time',
        weight: 0.30,
        description: `Applied at ${candidate.createdAt.getHours()}:00 - likely available at similar times`,
      },
      {
        factor: 'Historical Patterns',
        weight: 0.40,
        description: 'Afternoon (2-4 PM) shows highest response rates for this source',
      },
      {
        factor: 'Day of Week',
        weight: 0.30,
        description: 'Weekdays show better response than weekends',
      },
    ];

    await this.storePrediction(candidateId, 'OPTIMAL_CONTACT_TIME', '14:00', 0.80, factors);

    return {
      value: '14:00 today',
      confidence: 0.80,
      explanation: 'Best contact window is 2:00-4:00 PM today based on application timing and historical response patterns.',
      keyFactors: factors,
      bestTimes,
    };
  }

  // ==========================================
  // ML-07 & ML-08: DOCUMENT FRAUD DETECTION
  // ==========================================

  static async analyzeDocumentRisk(documentId: string): Promise<PredictionResult & {
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    checks: Array<{
      check: string;
      status: 'PASS' | 'WARN' | 'FAIL';
      details: string;
    }>;
  }> {
    const document = await prisma.candidateDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Mock document analysis
    const checks = [
      {
        check: 'Image Quality',
        status: 'PASS' as const,
        details: 'Clear, high-resolution image detected',
      },
      {
        check: 'OCR Confidence',
        status: document.ocrExtractedData ? 'PASS' : 'WARN',
        details: document.ocrExtractedData 
          ? 'Text extracted with 94% confidence'
          : 'OCR pending - manual review recommended',
      },
      {
        check: 'Visual Authenticity',
        status: 'PASS' as const,
        details: 'No obvious manipulation detected',
      },
      {
        check: 'Cross-Reference',
        status: 'PASS' as const,
        details: 'Document details consistent with application',
      },
    ];

    const factors = [
      {
        factor: 'Image Quality',
        weight: 0.25,
        description: checks[0].details,
      },
      {
        factor: 'OCR Confidence',
        weight: 0.35,
        description: checks[1].details,
      },
      {
        factor: 'Visual Analysis',
        weight: 0.40,
        description: checks[2].details,
      },
    ];

    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';

    await this.storePrediction(
      document.candidateId, 
      'DOCUMENT_RISK', 
      riskLevel, 
      0.95, 
      factors
    );

    return {
      value: riskLevel,
      riskLevel,
      confidence: 0.95,
      explanation: 'Document appears authentic. All automated checks passed.',
      keyFactors: factors,
      checks,
    };
  }

  // ==========================================
  // ML-10: CHURN PREDICTION (for active drivers)
  // ==========================================

  static async predictChurn(candidateId: string): Promise<PredictionResult & {
    riskScore: number;
    earlyWarning: boolean;
  }> {
    // Get latest performance snapshot
    const latestSnapshot = await prisma.driverPerformanceSnapshot.findFirst({
      where: { candidateId },
      orderBy: { snapshotDate: 'desc' },
    });

    if (!latestSnapshot) {
      return {
        value: 'UNKNOWN',
        riskScore: 50,
        confidence: 0.30,
        explanation: 'Insufficient performance data for churn prediction.',
        keyFactors: [],
        earlyWarning: false,
      };
    }

    const factors: Array<{ factor: string; weight: number; description: string }> = [];
    let riskScore = 30; // Base risk

    // Completion rate
    if (latestSnapshot.avgCompletionRate !== null && latestSnapshot.avgCompletionRate < 0.6) {
      riskScore += 25;
      factors.push({
        factor: 'Low Completion Rate',
        weight: 0.25,
        description: `${(latestSnapshot.avgCompletionRate * 100).toFixed(1)}% completion rate - below 60% threshold`,
      });
    }

    // GMV trend
    if (latestSnapshot.gmvGenerated !== null && latestSnapshot.gmvGenerated < 5000) {
      riskScore += 15;
      factors.push({
        factor: 'Low GMV',
        weight: 0.15,
        description: 'Below-average earnings in period',
      });
    }

    // Incidents
    if (latestSnapshot.incidentsCount && latestSnapshot.incidentsCount > 2) {
      riskScore += 20;
      factors.push({
        factor: 'Multiple Incidents',
        weight: 0.20,
        description: `${latestSnapshot.incidentsCount} incidents reported`,
      });
    }

    // Tier status
    if (latestSnapshot.currentTier === 'UNRANKED') {
      riskScore += 10;
      factors.push({
        factor: 'Unranked Status',
        weight: 0.10,
        description: 'Has not achieved tier status yet',
      });
    }

    riskScore = Math.min(100, riskScore);
    const earlyWarning = riskScore >= 60;

    let risk: 'HIGH' | 'MEDIUM' | 'LOW';
    if (riskScore >= 70) risk = 'HIGH';
    else if (riskScore >= 40) risk = 'MEDIUM';
    else risk = 'LOW';

    await this.storePrediction(candidateId, 'CHURN_RISK', risk, riskScore / 100, factors);

    return {
      value: risk,
      riskScore,
      confidence: 0.75,
      explanation: earlyWarning 
        ? 'Early warning: Multiple risk factors suggest this driver may churn within 30 days. Proactive outreach recommended.'
        : `Churn risk is ${risk.toLowerCase()}. No immediate intervention required.`,
      keyFactors: factors,
      earlyWarning,
    };
  }

  // ==========================================
  // HELPER METHODS
  // ==========================================

  private static async getCandidateWithFeatures(candidateId: string) {
    return prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        documents: true,
        applicationData: true,
        interactionLogs: {
          orderBy: { loggedAt: 'desc' },
          take: 10,
        },
        zone: true,
      },
    });
  }

  private static async extractPreHireFeatures(candidate: any): Promise<PreHireFeatures> {
    // Get headcount gap
    const headcountTarget = await prisma.headcountTarget.findFirst({
      where: {
        zoneId: candidate.zoneId,
        serviceType: candidate.serviceType,
      },
    });

    // Calculate document submission speed
    const docSubmitLog = candidate.interactionLogs.find(
      (log: any) => log.stageAfter === 'DOCS_SUBMITTED'
    );
    const documentSubmissionSpeed = docSubmitLog
      ? Math.floor((docSubmitLog.loggedAt.getTime() - candidate.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    // Calculate document approval rate
    const approvedDocs = candidate.documents.filter((d: any) => d.status === 'APPROVED').length;
    const totalDocs = candidate.documents.length;
    const documentApprovalRate = totalDocs > 0 ? approvedDocs / totalDocs : undefined;

    // Extract quiz score
    const quizScore = candidate.applicationData?.formData?.quizScore 
      ? parseFloat(candidate.applicationData.formData.quizScore)
      : undefined;

    return {
      sourceChannel: candidate.sourceChannel,
      serviceType: candidate.serviceType,
      zoneId: candidate.zoneId,
      pipelineVariant: candidate.pipelineVariant,
      isExistingDriver: candidate.isExistingDriver,
      applicationCompletionTime: undefined, // Would need session tracking
      quizScore,
      applicationHour: candidate.createdAt.getHours(),
      applicationDayOfWeek: candidate.createdAt.getDay(),
      headcountGapAtApplication: headcountTarget ? headcountTarget.targetCount - 50 : 0, // Mock current
      documentSubmissionSpeed,
      documentApprovalRate,
      candidateResponsiveness: undefined, // Would need message tracking
    };
  }

  private static async getSourceChannelQuality(sourceChannel: string): Promise<number> {
    // In real implementation, would query historical quality scores
    // Mock data based on typical patterns
    const qualityMap: Record<string, number> = {
      'DRIVER_REFERRAL': 0.85,
      'FO_REFERRAL': 0.80,
      'DRIVER_APP': 0.75,
      'LGU_PARTNER': 0.70,
      'WALK_IN': 0.65,
      'JOBBoard': 0.60,
      'WEBSITE_ORGANIC': 0.55,
      'SOCIAL_AD': 0.50,
      'AGENCY': 0.45,
    };
    return qualityMap[sourceChannel] || 0.50;
  }

  private static async getSourceWithdrawalRate(sourceChannel: string): Promise<number> {
    const withdrawalMap: Record<string, number> = {
      'SOCIAL_AD': 0.35,
      'JOBBoard': 0.30,
      'WEBSITE_ORGANIC': 0.25,
      'AGENCY': 0.25,
      'WALK_IN': 0.20,
      'LGU_PARTNER': 0.15,
      'FO_REFERRAL': 0.10,
      'DRIVER_REFERRAL': 0.08,
      'DRIVER_APP': 0.05,
    };
    return withdrawalMap[sourceChannel] || 0.25;
  }

  private static async getSourceAverageTimeToOnboard(sourceChannel: string): Promise<number> {
    const timeMap: Record<string, number> = {
      'DRIVER_APP': 7,
      'DRIVER_REFERRAL': 10,
      'FO_REFERRAL': 12,
      'LGU_PARTNER': 14,
      'WALK_IN': 14,
      'WEBSITE_ORGANIC': 16,
      'JOBBoard': 18,
      'SOCIAL_AD': 20,
      'AGENCY': 22,
    };
    return timeMap[sourceChannel] || 14;
  }

  private static calculateConfidence(factors: Array<{ weight: number }>): number {
    // Confidence based on number and weight of factors
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    return Math.min(0.95, 0.50 + (totalWeight * 0.5));
  }

  private static async storePrediction(
    candidateId: string,
    predictionType: string,
    value: string | number,
    confidence: number,
    factors: Array<{ factor: string; weight: number; description: string }>
  ): Promise<void> {
    await prisma.mLPrediction.create({
      data: {
        candidateId,
        predictionType,
        predictionValue: String(value),
        confidenceScore: confidence,
        keyFactors: factors,
        explanation: factors.map(f => f.description).join('. '),
        modelVersion: 'v1.0-mock',
        featuresUsed: {}, // Would store actual features used
      },
    });
  }

  // ==========================================
  // BATCH PREDICTIONS
  // ==========================================

  static async generateAllPredictions(candidateId: string): Promise<{
    preHireQuality: Awaited<ReturnType<typeof this.predictPreHireQuality>>;
    dropOffRisk: Awaited<ReturnType<typeof this.predictDropOffRisk>>;
    timeToOnboard: Awaited<ReturnType<typeof this.predictTimeToOnboard>>;
    zoneRoleFit: Awaited<ReturnType<typeof this.predictZoneRoleFit>>;
    optimalContactTime: Awaited<ReturnType<typeof this.predictOptimalContactTime>>;
  }> {
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
    });

    if (!candidate) {
      throw new Error('Candidate not found');
    }

    // Run all predictions in parallel
    const [preHireQuality, dropOffRisk, timeToOnboard, zoneRoleFit, optimalContactTime] = await Promise.all([
      this.predictPreHireQuality(candidateId),
      this.predictDropOffRisk(candidateId),
      this.predictTimeToOnboard(candidateId),
      this.predictZoneRoleFit(candidateId),
      this.predictOptimalContactTime(candidateId),
    ]);

    return {
      preHireQuality,
      dropOffRisk,
      timeToOnboard,
      zoneRoleFit,
      optimalContactTime,
    };
  }
}
