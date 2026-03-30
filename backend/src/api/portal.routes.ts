import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../server.js';

// Public routes - no authentication required (token-based)
export async function portalRoutes(app: FastifyInstance) {
  // Get candidate status by portal token
  app.get('/status/:token', async (request, reply) => {
    const { token } = z.object({ token: z.string() }).parse(request.params);

    const candidate = await prisma.candidate.findUnique({
      where: { candidatePortalToken: token },
      include: {
        zone: { select: { name: true } },
        documents: {
          select: {
            id: true,
            documentType: true,
            status: true,
            rejectionReason: true,
          },
          orderBy: { orderIndex: 'asc' },
        },
        interactionLogs: {
          where: { interactionType: { in: ['STAGE_TRANSITION', 'MESSAGE_SENT'] } },
          orderBy: { loggedAt: 'desc' },
          take: 10,
          select: {
            interactionType: true,
            summary: true,
            loggedAt: true,
            stageAfter: true,
          },
        },
      },
    });

    if (!candidate) {
      return reply.status(404).send({ error: 'Application not found' });
    }

    // Don't show rejected/withdrawn candidates
    if (['REJECTED', 'WITHDRAWN'].includes(candidate.currentStage)) {
      return {
        status: 'closed',
        message: candidate.currentStage === 'REJECTED' 
          ? 'Your application was not successful at this time.'
          : 'Your application has been withdrawn.',
      };
    }

    if (candidate.currentStage === 'ONBOARDED') {
      return {
        status: 'completed',
        message: 'Welcome to Xpress! You are now an active driver.',
      };
    }

    return {
      candidate: {
        id: candidate.id,
        fullName: candidate.fullName,
        currentStage: candidate.currentStage,
        zone: candidate.zone,
        serviceType: candidate.serviceType,
      },
      documents: candidate.documents,
      recentActivity: candidate.interactionLogs,
    };
  });

  // Upload document via portal
  app.post('/documents/:token', async (request, reply) => {
    const { token } = z.object({ token: z.string() }).parse(request.params);

    const candidate = await prisma.candidate.findUnique({
      where: { candidatePortalToken: token },
    });

    if (!candidate) {
      return reply.status(404).send({ error: 'Application not found' });
    }

    // Get multipart data
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const { documentType } = z.object({
      documentType: z.string(),
    }).parse(JSON.parse(data.fields?.metadata?.value || '{}'));

    // In real implementation, upload to S3
    // const fileUrl = await uploadToS3(data.file, data.filename);
    const fileUrl = `https://s3.amazonaws.com/bucket/${uuidv4()}-${data.filename}`;

    // Update or create document record
    const document = await prisma.candidateDocument.upsert({
      where: {
        candidateId_documentType: {
          candidateId: candidate.id,
          documentType: documentType as any,
        },
      },
      update: {
        fileUrl,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      create: {
        candidateId: candidate.id,
        documentType: documentType as any,
        fileUrl,
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
    });

    // TODO: Trigger OCR processing
    // TODO: Notify recruiter

    return reply.status(201).send({
      message: 'Document uploaded successfully',
      documentId: document.id,
    });
  });

  // Resend portal link
  app.post('/resend-link', async (request, reply) => {
    const { phone } = z.object({
      phone: z.string().min(1),
    }).parse(request.body);

    const candidate = await prisma.candidate.findFirst({
      where: { phonePrimary: phone },
      orderBy: { createdAt: 'desc' },
    });

    if (!candidate) {
      // Don't reveal if phone exists or not (security)
      return { message: 'If an application exists, a link will be sent.' };
    }

    // TODO: Send SMS with portal link
    // await sendSMS(phone, `Track your Xpress application: ${candidatePortalUrl}/status/${candidate.candidatePortalToken}`);

    return { message: 'Portal link sent to your phone.' };
  });

  // Submit new application (public endpoint)
  app.post('/apply', async (request, reply) => {
    const applicationSchema = z.object({
      fullName: z.string().min(1),
      phonePrimary: z.string().min(1),
      email: z.string().email().optional(),
      dateOfBirth: z.string().optional(),
      address: z.string().min(1),
      zoneId: z.string().uuid(),
      serviceType: z.enum(['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY']),
      sourceChannel: z.enum(['WEBSITE_ORGANIC', 'JOBBoard', 'SOCIAL_AD', 'WALK_IN']).default('WEBSITE_ORGANIC'),
      formData: z.record(z.any()),
    });

    const data = applicationSchema.parse(request.body);

    // Generate portal token
    const portalToken = uuidv4().replace(/-/g, '');

    const candidate = await prisma.candidate.create({
      data: {
        fullName: data.fullName,
        phonePrimary: data.phonePrimary,
        email: data.email,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        address: data.address,
        zoneId: data.zoneId,
        serviceType: data.serviceType,
        sourceChannel: data.sourceChannel,
        candidatePortalToken: portalToken,
        currentStage: 'APPLICATION',
        stageEnteredAt: new Date(),
        pipelineVariant: 'STANDARD',
      },
    });

    // Create application data record
    await prisma.candidateApplicationData.create({
      data: {
        candidateId: candidate.id,
        formData: data.formData,
        isSubmitted: true,
        submittedAt: new Date(),
        progressPercent: 100,
      },
    });

    // Create document checklist
    const { CandidateService } = await import('../services/candidate.service.js');
    await CandidateService.createDocumentChecklist(candidate.id, data.serviceType);

    // TODO: Send confirmation SMS
    // await sendSMS(data.phonePrimary, `Thank you for applying to Xpress! Track your application: ${candidatePortalUrl}/status/${portalToken}`);

    return reply.status(201).send({
      message: 'Application submitted successfully',
      applicationId: candidate.id,
      portalToken,
      portalUrl: `/status/${portalToken}`,
    });
  });

  // Get active zones (for application form)
  app.get('/zones', async (request, reply) => {
    const zones = await prisma.zone.findMany({
      where: { 
        isActive: true,
        recruitingStatus: { in: ['ACTIVELY_RECRUITING', 'PAUSED'] }
      },
      select: {
        id: true,
        name: true,
        region: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });

    return zones;
  });

  // Get active flow (for application form)
  app.get('/active-flow', async (request, reply) => {
    const flow = await prisma.applicationFlow.findFirst({
      include: {
        versions: {
          where: { status: 'PUBLISHED' },
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            steps: {
              where: { isActive: true },
              orderBy: { stepNumber: 'asc' },
              include: { fields: { orderBy: { orderIndex: 'asc' } } },
            },
          },
        },
      },
    });

    if (!flow || flow.versions.length === 0) {
      return reply.status(404).send({ error: 'No active application form available' });
    }

    return {
      flowId: flow.id,
      versionId: flow.versions[0].id,
      steps: flow.versions[0].steps,
    };
  });
}
