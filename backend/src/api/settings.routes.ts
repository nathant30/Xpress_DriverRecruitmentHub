import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const headcountTargetSchema = z.object({
  zoneId: z.string().uuid(),
  serviceType: z.enum(['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY']),
  targetCount: z.number().int().positive(),
  targetPeriod: z.enum(['MONTHLY', 'QUARTERLY']).default('MONTHLY'),
  effectiveFrom: z.string().datetime(),
});

const driverAppCampaignSchema = z.object({
  zoneId: z.string().uuid(),
  serviceType: z.enum(['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY']),
  headline: z.string().max(60),
  body: z.string().max(120),
  eligibleDriverFilter: z.record(z.any()),
  expiresAt: z.string().datetime(),
});

const kioskDeviceSchema = z.object({
  deviceName: z.string().min(1),
  zoneId: z.string().uuid(),
  mode: z.enum(['SELF_SERVICE', 'STAFF_ASSISTED']).default('SELF_SERVICE'),
  defaultServiceType: z.enum(['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY']).optional(),
  defaultLanguage: z.enum(['en', 'fil']).default('en'),
  sessionTimeoutMinutes: z.number().int().default(15),
});

export async function settingsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // ==================== HEADCOUNT TARGETS ====================

  app.get('/headcount-targets', async (request, reply) => {
    const { zoneId, serviceType } = z.object({
      zoneId: z.string().optional(),
      serviceType: z.string().optional(),
    }).parse(request.query);

    const targets = await prisma.headcountTarget.findMany({
      where: {
        ...(zoneId && { zoneId }),
        ...(serviceType && { serviceType: serviceType as any }),
      },
      include: { zone: { select: { name: true } } },
      orderBy: [{ effectiveFrom: 'desc' }],
    });

    return targets;
  });

  app.post('/headcount-targets', async (request, reply) => {
    // Only ADMIN and RECRUITMENT_MANAGER
    if (!['ADMIN', 'RECRUITMENT_MANAGER'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    const data = headcountTargetSchema.parse(request.body);

    const target = await prisma.headcountTarget.create({
      data: {
        ...data,
        effectiveFrom: new Date(data.effectiveFrom),
        createdBy: request.user.id,
      },
    });

    return reply.status(201).send(target);
  });

  // ==================== DRIVER APP CAMPAIGNS ====================

  app.get('/driver-app-campaigns', async (request, reply) => {
    const { isActive } = z.object({
      isActive: z.coerce.boolean().optional(),
    }).parse(request.query);

    const campaigns = await prisma.driverAppCampaign.findMany({
      where: isActive !== undefined ? { isActive } : {},
      include: { zone: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return campaigns;
  });

  app.post('/driver-app-campaigns', async (request, reply) => {
    if (!['ADMIN', 'RECRUITMENT_MANAGER'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    const data = driverAppCampaignSchema.parse(request.body);

    const campaign = await prisma.driverAppCampaign.create({
      data: {
        ...data,
        expiresAt: new Date(data.expiresAt),
        createdBy: request.user.id,
      },
    });

    return reply.status(201).send(campaign);
  });

  app.patch('/driver-app-campaigns/:id', async (request, reply) => {
    if (!['ADMIN', 'RECRUITMENT_MANAGER'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Insufficient permissions' });
    }

    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const data = z.object({ isActive: z.boolean() }).parse(request.body);

    const campaign = await prisma.driverAppCampaign.update({
      where: { id },
      data,
    });

    return campaign;
  });

  // ==================== KIOSK DEVICES ====================

  app.get('/kiosk-devices', async (request, reply) => {
    const { zoneId } = z.object({ zoneId: z.string().optional() }).parse(request.query);

    const devices = await prisma.kioskDevice.findMany({
      where: zoneId ? { zoneId } : {},
      include: { zone: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return devices;
  });

  app.post('/kiosk-devices', async (request, reply) => {
    if (!['ADMIN'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Only ADMIN can create kiosk devices' });
    }

    const data = kioskDeviceSchema.parse(request.body);

    // Generate pairing code
    const deviceCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const device = await prisma.kioskDevice.create({
      data: {
        ...data,
        deviceCode,
        pairedAt: new Date(),
      },
    });

    return reply.status(201).send(device);
  });

  // ==================== ZONES ====================

  app.get('/zones', async (request, reply) => {
    const zones = await prisma.zone.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    return zones;
  });

  app.post('/zones', async (request, reply) => {
    if (!['ADMIN'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Only ADMIN can create zones' });
    }

    const data = z.object({
      name: z.string().min(1),
      region: z.string().min(1),
      description: z.string().optional(),
    }).parse(request.body);

    const zone = await prisma.zone.create({ data: data });
    return reply.status(201).send(zone);
  });

  // ==================== DOCUMENT REQUIREMENTS ====================

  app.get('/document-requirements', async (request, reply) => {
    const { serviceType } = z.object({ serviceType: z.string().optional() }).parse(request.query);

    const requirements = await prisma.documentRequirement.findMany({
      where: serviceType ? { serviceType: serviceType as any } : {},
      orderBy: [{ serviceType: 'asc' }, { orderIndex: 'asc' }],
    });

    return requirements;
  });

  app.post('/document-requirements', async (request, reply) => {
    if (!['ADMIN'].includes(request.user.role)) {
      return reply.status(403).send({ error: 'Only ADMIN can configure document requirements' });
    }

    const data = z.object({
      serviceType: z.enum(['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY']),
      documentType: z.enum([
        'GOVERNMENT_ID', 'DRIVERS_LICENSE', 'NBI_CLEARANCE', 'PROOF_OF_ADDRESS',
        'VEHICLE_OR_CR', 'VEHICLE_PHOTO_FRONT', 'VEHICLE_PHOTO_REAR', 'INSURANCE_CERTIFICATE',
        'LTFRB_FRANCHISE', 'MEDICAL_CERTIFICATE', 'DRUG_TEST_RESULT', 'SELFIE_PHOTO',
        'FOOD_HANDLING_CERTIFICATE', 'CONTRACT', 'BANK_DOCUMENT', 'OTHER'
      ]),
      isRequired: z.boolean().default(true),
      requiresOcr: z.boolean().default(false),
      uploadGuidance: z.string().optional(),
      orderIndex: z.number().int(),
    }).parse(request.body);

    const req = await prisma.documentRequirement.upsert({
      where: {
        serviceType_documentType: {
          serviceType: data.serviceType,
          documentType: data.documentType,
        },
      },
      update: data,
      create: data,
    });

    return reply.status(201).send(req);
  });

  // ==================== USERS ====================

  app.get('/users', async (request, reply) => {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        avatarUrl: true,
        assignedZones: { select: { id: true, name: true } },
      },
      orderBy: { fullName: 'asc' },
    });

    return users;
  });

  app.get('/recruiters', async (request, reply) => {
    const recruiters = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['RECRUITER', 'RECRUITMENT_MANAGER'] },
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        avatarUrl: true,
      },
      orderBy: { fullName: 'asc' },
    });

    return recruiters;
  });
}
