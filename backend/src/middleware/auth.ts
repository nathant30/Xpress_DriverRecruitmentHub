import type { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '@prisma/client';
import { prisma } from '../server.js';

// Extend Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      role: UserRole;
      assignedZoneIds: string[];
    };
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const decoded = await request.jwtVerify<{ userId: string }>();
    
    // Fetch user with zones
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId, isActive: true },
      include: { assignedZones: { select: { id: true } } },
    });

    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
    }

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      assignedZoneIds: user.assignedZones.map((z) => z.id),
    };
  } catch (err) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token' });
  }
}

// Role-based access control
export function requireRole(...allowedRoles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({ 
        error: 'Forbidden', 
        message: 'Insufficient permissions' 
      });
    }
  };
}

// Check if user can access candidate data
export function canAccessCandidate(candidateZoneId: string, request: FastifyRequest): boolean {
  const { role, assignedZoneIds, id } = request.user;

  // ADMIN and RECRUITMENT_MANAGER can access all
  if (role === UserRole.ADMIN || role === UserRole.RECRUITMENT_MANAGER) {
    return true;
  }

  // RECRUITER and HIRING_MANAGER can access their assigned zones
  if (role === UserRole.RECRUITER || role === UserRole.HIRING_MANAGER) {
    return assignedZoneIds.includes(candidateZoneId);
  }

  // AGENCY can only access their own candidates (handled separately)
  // FIELD_OPERATOR_RECRUITER can only access their zone (handled separately)
  
  return false;
}
