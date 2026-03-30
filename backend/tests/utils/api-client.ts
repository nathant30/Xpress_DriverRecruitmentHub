import Fastify from 'fastify';
import { prisma } from '../../src/server.js';
import { authRoutes } from '../../src/api/auth.routes.js';
import { candidateRoutes } from '../../src/api/candidate.routes.js';
import { analyticsRoutes } from '../../src/api/analytics.routes.js';
import { predictionsRoutes } from '../../src/api/predictions.routes.js';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';

export class TestApiClient {
  private app: any;
  private authToken: string | null = null;

  async setup() {
    this.app = Fastify({
      logger: false,
    });

    await this.app.register(jwt, {
      secret: 'test-secret-key-for-testing-only',
    });

    await this.app.register(cors);

    // Register routes
    await this.app.register(authRoutes, { prefix: '/api/auth' });
    await this.app.register(candidateRoutes, { prefix: '/api/candidates' });
    await this.app.register(analyticsRoutes, { prefix: '/api/analytics' });
    await this.app.register(predictionsRoutes, { prefix: '/api/predictions' });

    return this;
  }

  async teardown() {
    await this.app.close();
  }

  setAuthToken(token: string) {
    this.authToken = token;
  }

  private getHeaders() {
    const headers: any = {
      'Content-Type': 'application/json',
    };
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }
    return headers;
  }

  async get(url: string) {
    return this.app.inject({
      method: 'GET',
      url,
      headers: this.getHeaders(),
    });
  }

  async post(url: string, payload?: any) {
    return this.app.inject({
      method: 'POST',
      url,
      headers: this.getHeaders(),
      payload,
    });
  }

  async put(url: string, payload?: any) {
    return this.app.inject({
      method: 'PUT',
      url,
      headers: this.getHeaders(),
      payload,
    });
  }

  async patch(url: string, payload?: any) {
    return this.app.inject({
      method: 'PATCH',
      url,
      headers: this.getHeaders(),
      payload,
    });
  }

  async delete(url: string) {
    return this.app.inject({
      method: 'DELETE',
      url,
      headers: this.getHeaders(),
    });
  }

  // Rate limiting test helper
  async floodRequests(url: string, count: number, method: 'GET' | 'POST' = 'GET', payload?: any) {
    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(
        method === 'GET' 
          ? this.get(url) 
          : this.post(url, payload)
      );
    }
    return Promise.all(promises);
  }
}
