import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { PrismaClient } from '@prisma/client';
import { appConfig } from './config/app.config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './api/auth.routes.js';
import { candidateRoutes } from './api/candidate.routes.js';
import { dashboardRoutes } from './api/dashboard.routes.js';
import { flowBuilderRoutes } from './api/flow-builder.routes.js';
import { settingsRoutes } from './api/settings.routes.js';
import { portalRoutes } from './api/portal.routes.js';
import { webhooksRoutes } from './api/webhooks.routes.js';
import { analyticsRoutes } from './api/analytics.routes.js';
import { predictionsRoutes } from './api/predictions.routes.js';
import { fieldOperatorRoutes } from './api/field-operator.routes.js';

// Initialize Prisma
export const prisma = new PrismaClient({
  log: appConfig.nodeEnv === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

// Create Fastify instance
const app = Fastify({
  logger: {
    level: appConfig.nodeEnv === 'development' ? 'debug' : 'info',
    transport: appConfig.nodeEnv === 'development' ? { target: 'pino-pretty' } : undefined,
  },
});

// Register plugins
await app.register(helmet, {
  contentSecurityPolicy: false, // Disable for API
});

await app.register(cors, {
  origin: appConfig.nodeEnv === 'development' ? true : appConfig.corsOrigins,
  credentials: true,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

await app.register(jwt, {
  secret: appConfig.jwtSecret,
  sign: {
    expiresIn: appConfig.jwtExpiresIn,
  },
});

await app.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10,
  },
});

// Set error handler
app.setErrorHandler(errorHandler);

// Register routes
await app.register(authRoutes, { prefix: '/api/auth' });
await app.register(candidateRoutes, { prefix: '/api/candidates' });
await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
await app.register(flowBuilderRoutes, { prefix: '/api/flow-builder' });
await app.register(settingsRoutes, { prefix: '/api/settings' });
await app.register(portalRoutes, { prefix: '/api/portal' });
await app.register(webhooksRoutes, { prefix: '/api/webhooks' });
await app.register(analyticsRoutes, { prefix: '/api/analytics' });
await app.register(predictionsRoutes, { prefix: '/api/predictions' });
await app.register(fieldOperatorRoutes, { prefix: '/api/field-operator' });

// Health check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
try {
  await app.listen({ port: appConfig.port, host: '0.0.0.0' });
  console.log(`🚀 Server running on port ${appConfig.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
});
