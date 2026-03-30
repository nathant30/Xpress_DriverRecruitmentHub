import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { PipelineStage, SourceChannel, InteractionType, InteractionOutcome } from '@prisma/client';
import { prisma } from '../server.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { CandidateService } from '../services/candidate.service.js';
import { OpsTowerIntegrationService } from '../services/opstower-integration.service.js';

const createCandidateSchema = z.object({
  fullName: z.string().min(1),
  phonePrimary: z.string().min(1),
  phoneSecondary: z.string().optional(),
  email: z.string().email().optional(),
  dateOfBirth: z.string().datetime().optional(),
  address: z.string().optional(),
  zoneId: z.string().uuid(),
  serviceType: z.enum(['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY']),
  employmentType: z.enum(['CONTRACTOR', 'SALARIED', 'OPERATOR']).optional(),
  sourceChannel: z.enum([
    'JOBBoard', 'SOCIAL_AD', 'DRIVER_APP', 'FO_REFERRAL', 
    'DRIVER_REFERRAL', 'WALK_IN', 'LGU_PARTNER', 'AGENCY', 'WEBSITE_ORGANIC'
  ]),
  sourceCampaignId: z.string().optional(),
  sourceFoId: z.string().optional(),
  sourceReferringDriverId: z.string().optional(),
  sourceAgencyId: z.string().optional(),
  sourceM12ContactId: z.string().optional(),
  existingDriverId: z.string().optional(),
  isExistingDriver: z.boolean().default(false),
  notes: z.string().optional(),
});

const updateStageSchema = z.object({
  stage: z.enum([
    'APPLICATION', 'SCREENING', 'DOCS_SUBMITTED', 'DOCS_VERIFIED',
    'BACKGROUND_CHECK', 'TRAINING', 'VEHICLE_INSPECTION', 
    'CONTRACT_SIGNING', 'ONBOARDED', 'REJECTED', 'WITHDRAWN'
  ]),
  note: z.string().optional(),
  opstowerDriverId: z.string().optional(),
  rejectionReason: z.string().optional(),
  withdrawalReason: z.string().optional(),
});

const logInteractionSchema = z.object({
  interactionType: z.enum([
    'PHONE_CALL', 'WHATSAPP', 'SMS', 'EMAIL', 'IN_PERSON',
    'DOCUMENT_REVIEW', 'TRAINING_SESSION', 'INSPECTION',
    'CONTRACT_MEETING', 'NOTE'
  ]),
  outcome: z.enum(['POSITIVE', 'NEUTRAL', 'NEEDS_FOLLOWUP', 'STAGE_ADVANCED', 'REJECTED', 'WITHDREW']).optional(),
  summary: z.string().min(1),
  interactionDate: z.string().datetime().optional(),
});

export async function candidateRoutes(app: FastifyInstance) {
  // Apply authentication to all routes
  app.addHook('preHandler', authenticate);

  // List candidates with filters
  app.get('/', async (request, reply) => {
    const querySchema = z.object({
      page: z.coerce.number().default(1),
      limit: z.coerce.number().max(100).default(20),
      zoneId: z.string().optional(),
      serviceType: z.enum(['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY']).optional(),
      stage: z.enum([
        'APPLICATION', 'SCREENING', 'DOCS_SUBMITTED', 'DOCS_VERIFIED',
        'BACKGROUND_CHECK', 'TRAINING', 'VEHICLE_INSPECTION',
        'CONTRACT_SIGNING', 'ONBOARDED', 'REJECTED', 'WITHDRAWN'
      ]).optional(),
      sourceChannel: z.string().optional(),
      assignedToMe: z.coerce.boolean().optional(),
      search: z.string().optional(),
    });

    const query = querySchema.parse(request.query);
    const { user } = request;

    const where: any = {};

    // Apply role-based filters
    if (user.role === 'RECRUITER') {
      if (query.assignedToMe) {
        where.assignedRecruiterId = user.id;
      } else {
        where.zoneId = { in: user.assignedZoneIds };
      }
    } else if (user.role === 'HIRING_MANAGER') {
      where.zoneId = { in: user.assignedZoneIds };
    } else if (user.role === 'AGENCY') {
      where.sourceAgencyId = user.id; // Would need agency lookup
    }

    // Apply query filters
    if (query.zoneId) where.zoneId = query.zoneId;
    if (query.serviceType) where.serviceType = query.serviceType;
    if (query.stage) where.currentStage = query.stage;
    if (query.sourceChannel) where.sourceChannel = query.sourceChannel;
    
    if (query.search) {
      where.OR = [
        { fullName: { contains: query.search, mode: 'insensitive' } },
        { phonePrimary: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          zone: { select: { id: true, name: true } },
          assignedRecruiter: { select: { id: true, fullName: true, avatarUrl: true } },
          _count: { select: { documents: true } },
        },
      }),
      prisma.candidate.count({ where }),
    ]);

    // Get document progress for each candidate
    const candidatesWithProgress = await Promise.all(
      candidates.map(async (c) => {
        const totalDocs = await prisma.candidateDocument.count({
          where: { candidateId: c.id },
        });
        const approvedDocs = await prisma.candidateDocument.count({
          where: { candidateId: c.id, status: 'APPROVED' },
        });
        return {
          ...c,
          documentProgress: { total: totalDocs, approved: approvedDocs },
        };
      })
    );

    return {
      data: candidatesWithProgress,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  });

  // Get single candidate
  app.get('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        zone: true,
        assignedRecruiter: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        agency: { select: { id: true, name: true } },
        documents: { orderBy: { createdAt: 'desc' } },
        interactionLogs: {
          orderBy: { loggedAt: 'desc' },
          include: { recruiter: { select: { fullName: true, avatarUrl: true } } },
        },
        applicationData: true,
      },
    });

    if (!candidate) {
      return reply.status(404).send({ error: 'Candidate not found' });
    }

    // Check permissions
    // (would implement proper permission checking here)

    return candidate;
  });

  // Create candidate
  app.post('/', async (request, reply) => {
    const data = createCandidateSchema.parse(request.body);

    // Generate portal token
    const portalToken = uuidv4().replace(/-/g, '');

    // Determine pipeline variant
    let pipelineVariant: 'STANDARD' | 'ABBREVIATED' | 'ROLE_CHANGE' = 'STANDARD';
    if (data.isExistingDriver && data.existingDriverId) {
      // Would check if same service type in OpsTower
      pipelineVariant = 'ABBREVIATED';
    }

    const candidate = await prisma.candidate.create({
      data: {
        ...data,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        candidatePortalToken: portalToken,
        pipelineVariant,
        currentStage: PipelineStage.APPLICATION,
        stageEnteredAt: new Date(),
        assignedRecruiterId: request.user.role === 'RECRUITER' ? request.user.id : undefined,
      },
      include: {
        zone: { select: { id: true, name: true } },
      },
    });

    // Create initial document checklist based on service type
    await CandidateService.createDocumentChecklist(candidate.id, candidate.serviceType);

    // Log creation
    await prisma.candidateInteractionLog.create({
      data: {
        candidateId: candidate.id,
        recruiterId: request.user.id,
        interactionDate: new Date(),
        interactionType: InteractionType.NOTE,
        outcome: InteractionOutcome.POSITIVE,
        summary: `Candidate created via ${candidate.sourceChannel}`,
        stageBefore: PipelineStage.APPLICATION,
        stageAfter: PipelineStage.APPLICATION,
        editExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return reply.status(201).send(candidate);
  });

  // Update candidate stage
  app.patch('/:id/stage', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = updateStageSchema.parse(request.body);

    const candidate = await prisma.candidate.findUnique({ where: { id } });
    if (!candidate) {
      return reply.status(404).send({ error: 'Candidate not found' });
    }

    const oldStage = candidate.currentStage;
    const newStage = data.stage as PipelineStage;

    // Validate stage transition
    // (would add proper state machine validation)

    // For ONBOARDED, require opstower_driver_id
    if (newStage === PipelineStage.ONBOARDED && !data.opstowerDriverId && !candidate.opstowerDriverId) {
      return reply.status(400).send({
        error: 'OpsTower Driver ID required',
        message: 'Cannot mark as onboarded without OpsTower driver ID',
      });
    }

    const updated = await prisma.candidate.update({
      where: { id },
      data: {
        currentStage: newStage,
        stageEnteredAt: new Date(),
        opstowerDriverId: data.opstowerDriverId || candidate.opstowerDriverId,
        rejectionReason: data.rejectionReason,
        withdrawalReason: data.withdrawalReason,
      },
    });

    // Log stage transition
    await prisma.candidateInteractionLog.create({
      data: {
        candidateId: id,
        recruiterId: request.user.id,
        interactionDate: new Date(),
        interactionType: InteractionType.STAGE_TRANSITION,
        outcome: newStage === PipelineStage.REJECTED 
          ? InteractionOutcome.REJECTED 
          : newStage === PipelineStage.WITHDRAWN 
            ? InteractionOutcome.WITHDREW 
            : InteractionOutcome.STAGE_ADVANCED,
        summary: data.note || `Stage changed from ${oldStage} to ${newStage}`,
        stageBefore: oldStage,
        stageAfter: newStage,
        editExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return updated;
  });

  // Log interaction
  app.post('/:id/interactions', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = logInteractionSchema.parse(request.body);

    const candidate = await prisma.candidate.findUnique({ where: { id } });
    if (!candidate) {
      return reply.status(404).send({ error: 'Candidate not found' });
    }

    const log = await prisma.candidateInteractionLog.create({
      data: {
        candidateId: id,
        recruiterId: request.user.id,
        interactionDate: data.interactionDate ? new Date(data.interactionDate) : new Date(),
        interactionType: data.interactionType as InteractionType,
        outcome: data.outcome as InteractionOutcome,
        summary: data.summary,
        stageBefore: candidate.currentStage,
        stageAfter: candidate.currentStage,
        editExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return reply.status(201).send(log);
  });

  // Update document status
  app.patch('/:id/documents/:docId', async (request, reply) => {
    const params = z.object({ 
      id: z.string().uuid(), 
      docId: z.string().uuid() 
    }).parse(request.params);
    
    const body = z.object({
      status: z.enum(['APPROVED', 'REJECTED']),
      rejectionReason: z.string().optional(),
    }).parse(request.body);

    const document = await prisma.candidateDocument.update({
      where: { id: params.docId, candidateId: params.id },
      data: {
        status: body.status,
        rejectionReason: body.rejectionReason,
        reviewedBy: request.user.id,
        reviewedAt: new Date(),
      },
    });

    // Log document review
    await prisma.candidateInteractionLog.create({
      data: {
        candidateId: params.id,
        recruiterId: request.user.id,
        interactionDate: new Date(),
        interactionType: InteractionType.DOCUMENT_REVIEW,
        outcome: body.status === 'APPROVED' ? InteractionOutcome.POSITIVE : InteractionOutcome.NEEDS_FOLLOWUP,
        summary: `Document ${document.documentType} ${body.status.toLowerCase()}${body.rejectionReason ? `: ${body.rejectionReason}` : ''}`,
        editExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return document;
  });

  // Assign recruiter
  app.patch('/:id/assign', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { recruiterId } = z.object({ recruiterId: z.string().uuid() }).parse(request.body);

    const updated = await prisma.candidate.update({
      where: { id },
      data: { assignedRecruiterId: recruiterId },
    });

    return updated;
  });

  // Transfer candidate to OpsTower (seamless onboarding)
  app.post('/:id/transfer-to-opstower', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: { documents: true },
    });

    if (!candidate) {
      return reply.status(404).send({ error: 'Candidate not found' });
    }

    // Validate candidate is ready for transfer
    if (candidate.currentStage !== PipelineStage.CONTRACT_SIGNING) {
      return reply.status(400).send({
        error: 'Invalid stage',
        message: 'Candidate must be in CONTRACT_SIGNING stage to transfer to OpsTower',
      });
    }

    // Check all required documents are approved
    const requiredDocs = candidate.documents.filter(d => 
      d.status !== 'APPROVED' && d.status !== 'SKIPPED_EXISTING_DRIVER'
    );
    
    if (requiredDocs.length > 0) {
      return reply.status(400).send({
        error: 'Documents pending',
        message: `${requiredDocs.length} documents are not yet approved`,
        documents: requiredDocs.map(d => d.documentType),
      });
    }

    // Perform the transfer
    const result = await OpsTowerIntegrationService.transferCandidateToOpsTower(id);

    if (!result.success) {
      return reply.status(500).send({
        error: 'Transfer failed',
        message: result.error,
      });
    }

    return {
      success: true,
      message: 'Candidate successfully transferred to OpsTower',
      driverId: result.driverId,
    };
  });

  // Get sync status with OpsTower
  app.get('/:id/sync-status', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);

    const status = await OpsTowerIntegrationService.getSyncStatus(id);

    return status;
  });

  // Validate OpsTower driver ID
  app.post('/:id/validate-opstower-id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { driverId } = z.object({ driverId: z.string() }).parse(request.body);

    const validation = await OpsTowerIntegrationService.validateDriverId(driverId);

    if (!validation.exists) {
      return reply.status(404).send({
        valid: false,
        error: 'Driver ID not found in OpsTower',
      });
    }

    return {
      valid: true,
      status: validation.status,
      isActive: validation.isActive,
    };
  });
}
