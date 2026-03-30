import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../server.js';
import { authenticate } from '../middleware/auth.js';
import { FieldOperatorService } from '../services/field-operator.service.js';
import { QRCodeService } from '../services/qrcode.service.js';

export async function fieldOperatorRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // ==========================================
  // FIELD OPERATOR AUTHORIZATION
  // ==========================================

  app.addHook('preHandler', async (request, reply) => {
    const allowedRoles = ['FIELD_OPERATOR_RECRUITER', 'ADMIN', 'RECRUITMENT_MANAGER'];
    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({ 
        error: 'Access denied. Field Operator privileges required.' 
      });
    }
  });

  // ==========================================
  // NEARBY RECRUITING ZONES
  // ==========================================

  app.get('/zones/nearby', async (request, reply) => {
    const query = z.object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
      radius: z.coerce.number().default(5000), // meters
    }).parse(request.query);

    const zones = await FieldOperatorService.getNearbyZones(
      query.lat,
      query.lng,
      query.radius
    );

    return {
      zones,
      currentLocation: { lat: query.lat, lng: query.lng },
    };
  });

  // ==========================================
  // QUICK CANDIDATE REGISTRATION
  // ==========================================

  app.post('/quick-register', async (request, reply) => {
    const body = z.object({
      fullName: z.string().min(2).max(100),
      phonePrimary: z.string().regex(/^\+63[0-9]{10}$/),
      serviceType: z.enum(['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY']),
      zoneId: z.string(),
      notes: z.string().max(500).optional(),
      referralSource: z.enum(['WALK_IN', 'STREET_RECRUITING', 'EVENT', 'MARKET_STALL']).default('WALK_IN'),
      location: z.object({
        lat: z.number(),
        lng: z.number(),
        accuracy: z.number().optional(),
      }).optional(),
    }).parse(request.body);

    const candidate = await FieldOperatorService.quickRegister({
      ...body,
      fieldOfficerId: request.user.id,
    });

    return reply.status(201).send({
      success: true,
      candidate,
      message: 'Candidate registered successfully',
    });
  });

  // ==========================================
  // OFFLINE SYNC (Bulk upload when back online)
  // ==========================================

  app.post('/sync/offline-data', async (request, reply) => {
    const body = z.object({
      candidates: z.array(z.object({
        fullName: z.string().min(2),
        phonePrimary: z.string(),
        serviceType: z.enum(['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY']),
        zoneId: z.string(),
        referralSource: z.enum(['WALK_IN', 'STREET_RECRUITING', 'EVENT', 'MARKET_STALL']),
        createdAt: z.string().datetime(),
        location: z.object({ lat: z.number(), lng: z.number() }).optional(),
        photos: z.array(z.string().url()).optional(),
      })),
      deviceId: z.string(),
      syncTimestamp: z.string().datetime(),
    }).parse(request.body);

    const result = await FieldOperatorService.processOfflineData({
      ...body,
      fieldOfficerId: request.user.id,
    });

    return {
      success: true,
      processed: result.processed,
      failed: result.failed,
      errors: result.errors,
    };
  });

  // ==========================================
  // REFERRAL QR CODE GENERATION
  // ==========================================

  app.post('/referral/qr-code', async (request, reply) => {
    const body = z.object({
      zoneId: z.string(),
      serviceType: z.enum(['MOTO', 'SEDAN_SUV', 'TAXI', 'ETRIKE', 'DELIVERY']),
      expiresIn: z.number().default(7).optional(), // days
      maxUses: z.number().default(50).optional(),
    }).parse(request.body);

    const qrCode = await QRCodeService.generateReferralQRCode({
      ...body,
      fieldOfficerId: request.user.id,
    });

    return {
      qrCode,
      downloadUrl: `/api/field-operator/referral/qr-code/${qrCode.id}/download`,
    };
  });

  app.get('/referral/qr-code/:id/download', async (request, reply) => {
    const params = z.object({
      id: z.string(),
    }).parse(request.params);

    const qrImage = await QRCodeService.getQRCodeImage(params.id);
    
    reply.header('Content-Type', 'image/png');
    reply.header('Content-Disposition', `attachment; filename="referral-qr-${params.id}.png"`);
    return qrImage;
  });

  // ==========================================
  // SCAN QR CODE (Driver scans FO's code)
  // ==========================================

  app.post('/referral/scan', async (request, reply) => {
    const body = z.object({
      qrCodeId: z.string(),
      driverInfo: z.object({
        fullName: z.string(),
        phonePrimary: z.string(),
      }),
    }).parse(request.body);

    const result = await QRCodeService.processQRCodeScan({
      ...body,
      scannedBy: request.user.id,
    });

    return result;
  });

  // ==========================================
  // MY RECRUITING STATS
  // ==========================================

  app.get('/my-stats', async (request, reply) => {
    const query = z.object({
      period: z.enum(['today', 'week', 'month']).default('today'),
    }).parse(request.query);

    const stats = await FieldOperatorService.getFieldOfficerStats({
      fieldOfficerId: request.user.id,
      period: query.period,
    });

    return stats;
  });

  // ==========================================
  // DAILY TARGET TRACKING
  // ==========================================

  app.get('/daily-target', async (request, reply) => {
    const target = await FieldOperatorService.getDailyTarget(request.user.id);
    return target;
  });

  app.patch('/daily-target/progress', async (request, reply) => {
    const body = z.object({
      registrations: z.number().int().min(0).optional(),
      qualified: z.number().int().min(0).optional(),
      onboarded: z.number().int().min(0).optional(),
    }).parse(request.body);

    const updated = await FieldOperatorService.updateProgress({
      fieldOfficerId: request.user.id,
      ...body,
    });

    return updated;
  });

  // ==========================================
  // CHECK IN / CHECK OUT (GPS Tracking)
  // ==========================================

  app.post('/check-in', async (request, reply) => {
    const body = z.object({
      lat: z.number(),
      lng: z.number(),
      accuracy: z.number().optional(),
      zoneId: z.string().optional(),
      activityType: z.enum(['STREET_RECRUITING', 'EVENT', 'MARKET_STALL', 'OFFICE']).default('STREET_RECRUITING'),
    }).parse(request.body);

    const checkIn = await FieldOperatorService.checkIn({
      ...body,
      fieldOfficerId: request.user.id,
    });

    return checkIn;
  });

  app.post('/check-out', async (request, reply) => {
    const body = z.object({
      lat: z.number(),
      lng: z.number(),
      notes: z.string().max(500).optional(),
    }).parse(request.body);

    const checkOut = await FieldOperatorService.checkOut({
      ...body,
      fieldOfficerId: request.user.id,
    });

    return checkOut;
  });

  // ==========================================
  // PHOTO UPLOAD (Capture driver photos in field)
  // ==========================================

  app.post('/upload-photo', async (request, reply) => {
    const data = await request.file();
    
    if (!data) {
      return reply.status(400).send({ error: 'No file uploaded' });
    }

    const candidateId = data.fields?.candidateId?.value;
    const photoType = data.fields?.photoType?.value || 'GENERAL';

    const result = await FieldOperatorService.uploadPhoto({
      file: data,
      candidateId,
      photoType,
      uploadedBy: request.user.id,
    });

    return result;
  });

  // ==========================================
  // GET MY ASSIGNED CANDIDATES
  // ==========================================

  app.get('/my-candidates', async (request, reply) => {
    const query = z.object({
      status: z.enum(['ALL', 'NEW', 'QUALIFIED', 'ONBOARDED', 'DROPPED']).default('ALL'),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).parse(request.query);

    const candidates = await FieldOperatorService.getMyCandidates({
      fieldOfficerId: request.user.id,
      ...query,
    });

    return candidates;
  });

  // ==========================================
  // EVENT MANAGEMENT
  // ==========================================

  app.get('/events/upcoming', async (request, reply) => {
    const events = await FieldOperatorService.getUpcomingEvents(request.user.id);
    return events;
  });

  app.post('/events/check-in', async (request, reply) => {
    const body = z.object({
      eventId: z.string(),
      lat: z.number(),
      lng: z.number(),
    }).parse(request.body);

    const checkIn = await FieldOperatorService.checkInToEvent({
      ...body,
      fieldOfficerId: request.user.id,
    });

    return checkIn;
  });

  // ==========================================
  // DRIVER VERIFICATION (Quick ID check)
  // ==========================================

  app.post('/verify-driver', async (request, reply) => {
    const body = z.object({
      phoneOrId: z.string(),
      verificationMethod: z.enum(['PHONE', 'LICENSE', 'OR_CR']),
    }).parse(request.body);

    const result = await FieldOperatorService.verifyDriver(body);
    return result;
  });

  // ==========================================
  // REFERRAL BONUS TRACKING
  // ==========================================

  app.get('/referral-bonuses', async (request, reply) => {
    const query = z.object({
      status: z.enum(['PENDING', 'APPROVED', 'PAID', 'ALL']).default('ALL'),
      period: z.enum(['this_month', 'last_month', 'all']).default('this_month'),
    }).parse(request.query);

    const bonuses = await FieldOperatorService.getReferralBonuses({
      fieldOfficerId: request.user.id,
      ...query,
    });

    return bonuses;
  });

  // ==========================================
  // LEADERBOARD (Gamification)
  // ==========================================

  app.get('/leaderboard', async (request, reply) => {
    const query = z.object({
      period: z.enum(['week', 'month', 'quarter']).default('month'),
      zoneId: z.string().optional(),
    }).parse(request.query);

    const leaderboard = await FieldOperatorService.getLeaderboard(query);
    
    // Get current user's rank
    const myRank = leaderboard.findIndex(
      entry => entry.fieldOfficerId === request.user.id
    ) + 1;

    return {
      leaderboard: leaderboard.slice(0, 10), // Top 10
      myRank: myRank > 0 ? myRank : null,
      totalParticipants: leaderboard.length,
    };
  });

  // ==========================================
  // EMERGENCY / SUPPORT
  // ==========================================

  app.post('/sos', async (request, reply) => {
    const body = z.object({
      lat: z.number(),
      lng: z.number(),
      reason: z.enum(['SAFETY', 'ACCIDENT', 'HARASSMENT', 'OTHER']),
      description: z.string().max(1000).optional(),
    }).parse(request.body);

    const alert = await FieldOperatorService.createSOSAlert({
      ...body,
      fieldOfficerId: request.user.id,
      fieldOfficerName: request.user.fullName,
      phone: request.user.phone,
    });

    // In production: Send push notification to managers, SMS to emergency contact
    return {
      success: true,
      alertId: alert.id,
      message: 'Help is on the way. Stay safe.',
    };
  });
}
