import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

interface CustomError extends Error {
  statusCode?: number;
  code?: string;
}

export async function errorHandler(
  error: CustomError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error(error);

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return reply.status(409).send({
          error: 'Conflict',
          message: 'A record with this unique identifier already exists',
        });
      case 'P2025':
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Record not found',
        });
      case 'P2003':
        return reply.status(400).send({
          error: 'Foreign Key Constraint',
          message: 'Related record does not exist',
        });
      default:
        return reply.status(500).send({
          error: 'Database Error',
          message: 'An error occurred while accessing the database',
        });
    }
  }

  // JWT errors
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_COOKIE') {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'No authorization token provided',
    });
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = error.statusCode ? error.message : 'Internal Server Error';

  return reply.status(statusCode).send({
    error: statusCode === 500 ? 'Internal Server Error' : 'Error',
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
    }),
  });
}
