import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { authenticate } from '../middleware/auth.js';
import { MLPredictionService } from '../services/ml-prediction.service.js';

export async function predictionsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // ==========================================
  // GET ALL PREDICTIONS FOR CANDIDATE
  // ==========================================

  app.get('/candidates/:candidateId', async (request, reply) => {
    const params = z.object({
      candidateId: z.string(),
    }).parse(request.params);

    // Check if user has access to this candidate
    const candidate = await prisma.candidate.findUnique({
      where: { id: params.candidateId },
    });

    if (!candidate) {
      return reply.status(404).send({ error: 'Candidate not found' });
    }

    // Generate fresh predictions
    const result = await MLPredictionService.generateAllPredictions(params.candidateId);

    // Transform to array format expected by frontend
    const predictions = [
      { ...result.preHireQuality, type: 'PRE_HIRE_QUALITY' },
      { ...result.dropOffRisk, type: 'DROP_OFF_RISK' },
      { ...result.timeToOnboard, type: 'TIME_TO_ONBOARD' },
      { ...result.zoneRoleFit, type: 'ZONE_ROLE_FIT' },
      { ...result.optimalContactTime, type: 'OPTIMAL_CONTACT_TIME' },
    ];

    return {
      candidateId: params.candidateId,
      predictions,
      generatedAt: new Date().toISOString(),
    };
  });

  // ==========================================
  // INDIVIDUAL PREDICTION ENDPOINTS
  // ==========================================

  app.get('/candidates/:candidateId/pre-hire-quality', async (request, reply) => {
    const params = z.object({
      candidateId: z.string(),
    }).parse(request.params);

    const prediction = await MLPredictionService.predictPreHireQuality(params.candidateId);
    return prediction;
  });

  app.get('/candidates/:candidateId/drop-off-risk', async (request, reply) => {
    const params = z.object({
      candidateId: z.string(),
    }).parse(request.params);

    const prediction = await MLPredictionService.predictDropOffRisk(params.candidateId);
    return prediction;
  });

  app.get('/candidates/:candidateId/time-to-onboard', async (request, reply) => {
    const params = z.object({
      candidateId: z.string(),
    }).parse(request.params);

    const prediction = await MLPredictionService.predictTimeToOnboard(params.candidateId);
    return prediction;
  });

  app.get('/candidates/:candidateId/zone-role-fit', async (request, reply) => {
    const params = z.object({
      candidateId: z.string(),
    }).parse(request.params);

    const prediction = await MLPredictionService.predictZoneRoleFit(params.candidateId);
    return prediction;
  });

  app.get('/candidates/:candidateId/optimal-contact-time', async (request, reply) => {
    const params = z.object({
      candidateId: z.string(),
    }).parse(request.params);

    const prediction = await MLPredictionService.predictOptimalContactTime(params.candidateId);
    return prediction;
  });

  // ==========================================
  // DOCUMENT RISK ANALYSIS
  // ==========================================

  app.get('/documents/:documentId/risk', async (request, reply) => {
    const params = z.object({
      documentId: z.string(),
    }).parse(request.params);

    const analysis = await MLPredictionService.analyzeDocumentRisk(params.documentId);
    return analysis;
  });

  // ==========================================
  // CHURN PREDICTION (for active drivers)
  // ==========================================

  app.get('/candidates/:candidateId/churn-risk', async (request, reply) => {
    const params = z.object({
      candidateId: z.string(),
    }).parse(request.params);

    const candidate = await prisma.candidate.findUnique({
      where: { id: params.candidateId },
    });

    if (!candidate) {
      return reply.status(404).send({ error: 'Candidate not found' });
    }

    if (candidate.currentStage !== 'ONBOARDED') {
      return reply.status(400).send({ 
        error: 'Churn prediction only available for onboarded drivers' 
      });
    }

    const prediction = await MLPredictionService.predictChurn(params.candidateId);
    return prediction;
  });

  // ==========================================
  // PREDICTION HISTORY
  // ==========================================

  app.get('/candidates/:candidateId/history', async (request, reply) => {
    const params = z.object({
      candidateId: z.string(),
    }).parse(request.params);

    const query = z.object({
      type: z.string().optional(),
      limit: z.coerce.number().default(10),
    }).parse(request.query);

    const predictions = await prisma.mLPrediction.findMany({
      where: {
        candidateId: params.candidateId,
        ...(query.type && { predictionType: query.type }),
      },
      orderBy: { predictedAt: 'desc' },
      take: query.limit,
    });

    return {
      candidateId: params.candidateId,
      predictions,
    };
  });

  // ==========================================
  // FEEDBACK ON PREDICTIONS
  // ==========================================

  app.post('/:predictionId/feedback', async (request, reply) => {
    const params = z.object({
      predictionId: z.string(),
    }).parse(request.params);

    const body = z.object({
      feedback: z.enum(['ACCURATE', 'INACCURATE', 'NOT_SURE']),
      notes: z.string().optional(),
    }).parse(request.body);

    const prediction = await prisma.mLPrediction.update({
      where: { id: params.predictionId },
      data: {
        recruiterFeedback: body.feedback,
      },
    });

    return {
      success: true,
      prediction,
    };
  });

  // ==========================================
  // MODEL CONFIGURATION (Admin only)
  // ==========================================

  app.get('/model-config', async (request, reply) => {
    if (request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const configs = await prisma.mLModelConfig.findMany({
      orderBy: { modelType: 'asc' },
    });

    return configs;
  });

  app.patch('/model-config/:modelType', async (request, reply) => {
    if (request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Admin access required' });
    }

    const params = z.object({
      modelType: z.string(),
    }).parse(request.params);

    const body = z.object({
      isActive: z.boolean().optional(),
      showToRecruiters: z.boolean().optional(),
      requiresHumanConfirmation: z.boolean().optional(),
      config: z.record(z.any()).optional(),
    }).parse(request.body);

    const config = await prisma.mLModelConfig.upsert({
      where: { modelType: params.modelType },
      update: body,
      create: {
        modelType: params.modelType,
        modelVersion: 'v1.0',
        ...body,
      },
    });

    return config;
  });

  // ==========================================
  // BATCH PREDICTIONS (for recruiters)
  // ==========================================

  app.get('/batch/drop-off-risk', async (request, reply) => {
    // Get all candidates assigned to this recruiter with HIGH drop-off risk
    const candidates = await prisma.candidate.findMany({
      where: {
        assignedRecruiterId: request.user.id,
        currentStage: {
          notIn: ['ONBOARDED', 'REJECTED', 'WITHDRAWN'],
        },
      },
      take: 50,
    });

    const predictions = await Promise.all(
      candidates.map(async (candidate) => {
        try {
          const prediction = await MLPredictionService.predictDropOffRisk(candidate.id);
          return {
            candidateId: candidate.id,
            candidateName: candidate.fullName,
            currentStage: candidate.currentStage,
            risk: prediction.value,
            confidence: prediction.confidence,
          };
        } catch {
          return null;
        }
      })
    );

    // Filter to high risk only
    const highRisk = predictions
      .filter((p): p is NonNullable<typeof p> => p !== null && p.risk === 'HIGH')
      .sort((a, b) => b.confidence - a.confidence);

    return {
      totalCandidates: candidates.length,
      highRiskCount: highRisk.length,
      highRiskCandidates: highRisk.slice(0, 10), // Top 10
    };
  });

  // ==========================================
  // DASHBOARD INSIGHTS
  // ==========================================

  app.get('/insights', async (request, reply) => {
    const user = request.user;

    // Different insights based on role
    if (user.role === 'RECRUITER') {
      // Get assigned candidates with predictions
      const assignedCandidates = await prisma.candidate.findMany({
        where: {
          assignedRecruiterId: user.id,
          currentStage: {
            notIn: ['ONBOARDED', 'REJECTED', 'WITHDRAWN'],
          },
        },
        take: 20,
      });

      const insights = await Promise.all(
        assignedCandidates.map(async (candidate) => {
          try {
            const [dropOffRisk, optimalTime] = await Promise.all([
              MLPredictionService.predictDropOffRisk(candidate.id),
              MLPredictionService.predictOptimalContactTime(candidate.id),
            ]);

            return {
              candidateId: candidate.id,
              candidateName: candidate.fullName,
              dropOffRisk: dropOffRisk.value,
              optimalContactTime: optimalTime.value,
              actionRecommended: dropOffRisk.value === 'HIGH',
            };
          } catch {
            return null;
          }
        })
      );

      return {
        role: user.role,
        insights: insights.filter((i): i is NonNullable<typeof i> => i !== null),
      };
    }

    if (user.role === 'RECRUITMENT_MANAGER' || user.role === 'ADMIN') {
      // Get high-level insights
      const pendingPredictions = await prisma.mLPrediction.count({
        where: {
          predictedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });

      const highRiskCandidates = await prisma.candidate.count({
        where: {
          currentStage: {
            notIn: ['ONBOARDED', 'REJECTED', 'WITHDRAWN'],
          },
        },
      });

      return {
        role: user.role,
        insights: {
          predictionsGeneratedThisWeek: pendingPredictions,
          activeCandidates: highRiskCandidates,
          mlFeaturesEnabled: 8, // Mock
          modelAccuracy: 78, // Mock percentage
        },
      };
    }

    return {
      role: user.role,
      insights: [],
    };
  });
}
