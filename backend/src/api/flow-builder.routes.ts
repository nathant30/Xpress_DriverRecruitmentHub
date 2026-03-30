import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const createFlowSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

const createStepSchema = z.object({
  stepType: z.enum([
    'WELCOME', 'SERVICE_TYPE_SELECTION', 'ZONE_SELECTION', 'PERSONAL_DETAILS',
    'DOCUMENT_UPLOAD', 'VEHICLE_DETAILS', 'AVAILABILITY_SHIFT', 'EMERGENCY_CONTACT',
    'BANK_PAYMENT_DETAILS', 'QUIZ_KNOWLEDGE', 'DECLARATIONS_AGREEMENTS', 'E_SIGNATURE'
  ]),
  title: z.string().min(1),
  description: z.string().optional(),
  config: z.record(z.any()),
  conditions: z.array(z.any()).optional(),
  fields: z.array(z.object({
    fieldKey: z.string(),
    fieldType: z.enum(['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'PHONE', 'EMAIL', 'DROPDOWN', 'MULTI_SELECT', 'RADIO', 'CHECKBOX', 'FILE_UPLOAD', 'SIGNATURE']),
    label: z.string(),
    placeholder: z.string().optional(),
    helpText: z.string().optional(),
    isRequired: z.boolean().default(false),
    validationRules: z.any().optional(),
    options: z.array(z.any()).optional(),
    defaultValue: z.string().optional(),
    orderIndex: z.number(),
  })).optional(),
});

export async function flowBuilderRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Get all flows
  app.get('/flows', async (request, reply) => {
    const flows = await prisma.applicationFlow.findMany({
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 5,
          select: {
            id: true,
            versionNumber: true,
            status: true,
            publishedAt: true,
            publisher: { select: { fullName: true } },
          },
        },
      },
    });

    return flows;
  });

  // Get flow with steps
  app.get('/flows/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { version } = z.object({ version: z.coerce.number().optional() }).parse(request.query);

    const flow = await prisma.applicationFlow.findUnique({
      where: { id },
      include: {
        versions: {
          where: version ? { versionNumber: version } : { status: 'PUBLISHED' },
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

    if (!flow) {
      return reply.status(404).send({ error: 'Flow not found' });
    }

    return flow;
  });

  // Create new flow
  app.post('/flows', async (request, reply) => {
    const data = createFlowSchema.parse(request.body);

    const flow = await prisma.applicationFlow.create({
      data: {
        name: data.name,
        description: data.description,
        versions: {
          create: {
            versionNumber: 1,
            status: 'DRAFT',
            changeSummary: 'Initial version',
          },
        },
      },
    });

    return reply.status(201).send(flow);
  });

  // Add step to flow version
  app.post('/flows/:id/steps', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = createStepSchema.parse(request.body);

    // Find draft version
    const version = await prisma.applicationFlowVersion.findFirst({
      where: { flowId: id, status: 'DRAFT' },
    });

    if (!version) {
      return reply.status(400).send({ error: 'No draft version exists' });
    }

    // Get next step number
    const lastStep = await prisma.flowStep.findFirst({
      where: { versionId: version.id },
      orderBy: { stepNumber: 'desc' },
    });
    const nextStepNumber = (lastStep?.stepNumber || 0) + 1;

    // Create step with fields
    const step = await prisma.flowStep.create({
      data: {
        versionId: version.id,
        stepNumber: nextStepNumber,
        stepType: data.stepType,
        title: data.title,
        description: data.description,
        config: data.config,
        conditions: data.conditions,
        fields: {
          create: data.fields || [],
        },
      },
      include: { fields: true },
    });

    return reply.status(201).send(step);
  });

  // Publish flow version
  app.post('/flows/:id/publish', async (request, reply) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const { changeSummary } = z.object({ changeSummary: z.string() }).parse(request.body);

    // Archive current published version
    await prisma.applicationFlowVersion.updateMany({
      where: { flowId: id, status: 'PUBLISHED' },
      data: { status: 'ARCHIVED' },
    });

    // Get draft version
    const draft = await prisma.applicationFlowVersion.findFirst({
      where: { flowId: id, status: 'DRAFT' },
    });

    if (!draft) {
      return reply.status(400).send({ error: 'No draft version to publish' });
    }

    // Publish draft
    await prisma.applicationFlowVersion.update({
      where: { id: draft.id },
      data: {
        status: 'PUBLISHED',
        publishedAt: new Date(),
        publishedBy: request.user.id,
        changeSummary,
      },
    });

    // Create new draft for future edits
    const maxVersion = await prisma.applicationFlowVersion.findFirst({
      where: { flowId: id },
      orderBy: { versionNumber: 'desc' },
    });

    await prisma.applicationFlowVersion.create({
      data: {
        flowId: id,
        versionNumber: (maxVersion?.versionNumber || 1) + 1,
        status: 'DRAFT',
      },
    });

    return { message: 'Flow published successfully' };
  });

  // Get active published flow (for candidate-facing forms)
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
      return reply.status(404).send({ error: 'No published flow found' });
    }

    return flow;
  });
}
