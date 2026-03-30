import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { prisma } from '../server.js';
import { authenticate } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(['ADMIN', 'RECRUITMENT_MANAGER', 'RECRUITER', 'HIRING_MANAGER', 'MARKETING_VIEWER']),
});

export async function authRoutes(app: FastifyInstance) {
  // Login
  app.post('/login', async (request, reply) => {
    const { email, password } = loginSchema.parse(request.body);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { assignedZones: { select: { id: true } } },
    });

    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const validPassword = await argon2.verify(user.passwordHash, password);
    if (!validPassword) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = app.jwt.sign({ userId: user.id });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        assignedZoneIds: user.assignedZones.map((z) => z.id),
      },
    };
  });

  // Register (ADMIN only)
  app.post('/register', { preHandler: authenticate }, async (request, reply) => {
    // Check if requester is ADMIN
    if (request.user.role !== 'ADMIN') {
      return reply.status(403).send({ error: 'Only ADMIN can register users' });
    }

    const data = registerSchema.parse(request.body);
    const passwordHash = await argon2.hash(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        role: data.role,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
      },
    });

    return { user, message: 'User created successfully' };
  });

  // Get current user
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      include: { assignedZones: true },
    });

    if (!user) {
      return reply.status(404).send({ error: 'User not found' });
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      assignedZones: user.assignedZones,
    };
  });

  // SSO callback (for integration with Marketing Hub/OpsTower)
  app.post('/sso/callback', async (request, reply) => {
    const { token } = z.object({ token: z.string() }).parse(request.body);

    // Validate token with shared auth provider
    // This would integrate with your existing auth system
    try {
      const decoded = await request.jwt.verify(token);
      return { token, user: decoded };
    } catch {
      return reply.status(401).send({ error: 'Invalid SSO token' });
    }
  });
}
