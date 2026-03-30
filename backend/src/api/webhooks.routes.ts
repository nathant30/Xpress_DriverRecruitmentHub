import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { OpsTowerIntegrationService } from '../services/opstower-integration.service.js';

/**
 * Webhooks API - For receiving events from external systems
 * 
 * OpsTower → Recruitment Hub webhooks
 * Marketing Hub → Recruitment Hub webhooks
 */

export async function webhooksRoutes(app: FastifyInstance) {
  // OpsTower webhooks
  app.post('/opstower', async (request, reply) => {
    // Verify webhook signature if configured
    const signature = request.headers['x-opstower-signature'];
    // TODO: Implement HMAC signature verification
    
    const bodySchema = z.object({
      event: z.enum([
        'driver.created',
        'driver.activated',
        'driver.suspended',
        'driver.updated',
        'driver.deactivated',
        'document.verified',
        'document.rejected',
      ]),
      payload: z.record(z.any()),
      timestamp: z.string().datetime(),
    });

    const { event, payload } = bodySchema.parse(request.body);

    // Process webhook
    await OpsTowerIntegrationService.handleWebhook(event, payload);

    return { received: true, event };
  });

  // Marketing Hub webhooks
  app.post('/marketing', async (request, reply) => {
    const bodySchema = z.object({
      event: z.enum([
        'campaign.attributed',
        'referral.claimed',
      ]),
      payload: z.record(z.any()),
    });

    const { event, payload } = bodySchema.parse(request.body);

    // Handle marketing events
    switch (event) {
      case 'campaign.attributed':
        // Update candidate with campaign attribution
        break;
      case 'referral.claimed':
        // Process referral bonus
        break;
    }

    return { received: true, event };
  });

  // Driver App webhooks
  app.post('/driver-app', async (request, reply) => {
    const bodySchema = z.object({
      event: z.enum([
        'application.submitted',
        'application.updated',
      ]),
      payload: z.record(z.any()),
    });

    const { event, payload } = bodySchema.parse(request.body);

    // Handle driver app events
    // These are typically handled via the portal API, but webhooks provide async updates

    return { received: true, event };
  });
}
