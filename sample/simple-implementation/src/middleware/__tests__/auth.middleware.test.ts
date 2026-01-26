import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import {
  signJWT,
  verifyJWT,
  AuthMiddleware,
  RequireRole,
  RequireSubscription,
  AdminOnly,
  ProAndAdmin,
  ProAndEnterprise,
  EnterpriseOnly,
} from '../auth.middleware.js';
import type { JwtPayload } from '../../types.js';

// Mock environment variables
const TEST_JWT_SECRET = 'test-secret-key-for-testing-only';
const TEST_JWT_EXPIRES_IN = 3600; // 1 hour

// Define the environment type for Hono context
interface Env {
  Variables: {
    user: JwtPayload & { role?: 'free' | 'pro' | 'admin' };
  };
}

describe('auth.middleware', () => {
  beforeEach(() => {
    // Set test environment variables
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_EXPIRES_IN = TEST_JWT_EXPIRES_IN.toString();
    vi.clearAllMocks();
    // Reload the module to pick up new environment variables
    vi.resetModules();
  });

  describe('signJWT', () => {
    it('should sign a JWT token with valid payload', async () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'free',
      };

      const token = await signJWT(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      // Verify the token was signed correctly
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as any;
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.subscription).toBe(payload.subscription);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });

    it('should sign tokens with different subscription types', async () => {
      const subscriptions: Array<'free' | 'pro' | 'enterprise'> = ['free', 'pro', 'enterprise'];

      for (const subscription of subscriptions) {
        const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
          id: `user-${subscription}`,
          email: `${subscription}@example.com`,
          subscription,
        };

        const token = await signJWT(payload);
        const decoded = jwt.verify(token, TEST_JWT_SECRET) as JwtPayload;

        expect(decoded.subscription).toBe(subscription);
      }
    });

    it('should reject signing with invalid secret', async () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'free',
      };

      const token = await signJWT(payload);
      expect(token).toBeDefined();
    });
  });

  describe('verifyJWT', () => {
    it('should verify a valid JWT token', async () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'pro',
      };

      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: TEST_JWT_EXPIRES_IN });
      const decoded = await verifyJWT(token);

      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.subscription).toBe(payload.subscription);
    });

    it('should reject an invalid token', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(verifyJWT(invalidToken)).rejects.toThrow();
    });

    it('should reject an expired token', async () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'free',
      };

      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '-1s' }); // Already expired

      await expect(verifyJWT(token)).rejects.toThrow();
    });

    it('should reject a token signed with wrong secret', async () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'enterprise',
      };

      const token = jwt.sign(payload, 'wrong-secret', { expiresIn: TEST_JWT_EXPIRES_IN });

      await expect(verifyJWT(token)).rejects.toThrow();
    });
  });

  describe('AuthMiddleware', () => {
    let app: Hono<Env>;

    beforeEach(() => {
      app = new Hono<Env>();
    });

    it('should allow request with valid Bearer token', async () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'pro',
      };

      const token = await signJWT(payload);

      app.use('*', AuthMiddleware);
      app.get('/test', (c) => c.json({ success: true, user: c.get('user') }));

      const res = await app.request('/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.id).toBe(payload.id);
      expect(json.user.email).toBe(payload.email);
      expect(json.user.subscription).toBe(payload.subscription);
    });

    it('should reject request without Authorization header', async () => {
      app.use('*', AuthMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Unauthorized');
      expect(json.error).toContain('No token provided');
    });

    it('should reject request with malformed Authorization header', async () => {
      app.use('*', AuthMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', {
        headers: {
          Authorization: 'InvalidFormat token',
        },
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Unauthorized');
    });

    it('should reject request with invalid token', async () => {
      app.use('*', AuthMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', {
        headers: {
          Authorization: 'Bearer invalid.token.here',
        },
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Unauthorized');
      expect(json.error).toContain('Invalid or expired token');
    });

    it('should reject request with expired token', async () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        id: 'user-123',
        email: 'test@example.com',
        subscription: 'free',
      };

      const token = jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '-1s' });

      app.use('*', AuthMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Unauthorized');
    });
  });

  describe('RequireRole', () => {
    let app: Hono<Env>;

    beforeEach(() => {
      app = new Hono<Env>();
    });

    it('should allow user with matching role', async () => {
      const user: Env['Variables']['user'] = { id: 'user-123', email: 'admin@example.com', subscription: 'enterprise', role: 'admin' };

      app.use('*', (c, next) => {
        c.set('user', user);
        return next();
      });
      app.use('*', RequireRole('admin'));
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('should allow user with one of multiple allowed roles', async () => {
      const user: Env['Variables']['user'] = { id: 'user-123', email: 'pro@example.com', subscription: 'pro', role: 'pro' };

      app.use('*', (c, next) => {
        c.set('user', user);
        return next();
      });
      app.use('*', RequireRole('admin', 'pro'));
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
    });

    it('should reject user without matching role', async () => {
      const user: Env['Variables']['user'] = { id: 'user-123', email: 'free@example.com', subscription: 'free', role: 'free' };

      app.use('*', (c, next) => {
        c.set('user', user);
        return next();
      });
      app.use('*', RequireRole('admin'));
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Forbidden');
      expect(json.error).toContain('Insufficient permissions');
    });

    it('should reject request when user is not set', async () => {
      app.use('*', RequireRole('admin'));
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Forbidden');
    });
  });

  describe('RequireSubscription', () => {
    let app: Hono<Env>;

    beforeEach(() => {
      app = new Hono<Env>();
    });

    it('should allow user with matching subscription', async () => {
      const user: Env['Variables']['user'] = { id: 'user-123', email: 'enterprise@example.com', subscription: 'enterprise', role: 'admin' };

      app.use('*', (c, next) => {
        c.set('user', user);
        return next();
      });
      app.use('*', RequireSubscription('enterprise'));
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('should allow user with one of multiple allowed subscriptions', async () => {
      const user: Env['Variables']['user'] = { id: 'user-123', email: 'pro@example.com', subscription: 'pro', role: 'pro' };

      app.use('*', (c, next) => {
        c.set('user', user);
        return next();
      });
      app.use('*', RequireSubscription('pro', 'enterprise'));
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
    });

    it('should reject user without matching subscription', async () => {
      const user: Env['Variables']['user'] = { id: 'user-123', email: 'free@example.com', subscription: 'free', role: 'free' };

      app.use('*', (c, next) => {
        c.set('user', user);
        return next();
      });
      app.use('*', RequireSubscription('enterprise'));
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toContain('Forbidden');
      expect(json.error).toContain('Subscription level required');
      expect(json.requiredSubscription).toEqual(['enterprise']);
    });

    it('should reject request when user is not set', async () => {
      app.use('*', RequireSubscription('pro'));
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe('Pre-configured middleware', () => {
    let app: Hono<Env>;

    beforeEach(() => {
      app = new Hono<Env>();
    });

    describe('AdminOnly', () => {
      it('should allow admin users', async () => {
        const user: Env['Variables']['user'] = { id: 'user-123', email: 'admin@example.com', subscription: 'enterprise', role: 'admin' };

        app.use('*', (c, next) => {
          c.set('user', user);
          return next();
        });
        app.use('*', AdminOnly);
        app.get('/test', (c) => c.json({ success: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(200);
      });

      it('should reject non-admin users', async () => {
        const user: Env['Variables']['user'] = { id: 'user-123', email: 'pro@example.com', subscription: 'pro', role: 'pro' };

        app.use('*', (c, next) => {
          c.set('user', user);
          return next();
        });
        app.use('*', AdminOnly);
        app.get('/test', (c) => c.json({ success: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(403);
      });
    });

    describe('ProAndAdmin', () => {
      it('should allow pro users', async () => {
        const user: Env['Variables']['user'] = { id: 'user-123', email: 'pro@example.com', subscription: 'pro', role: 'pro' };

        app.use('*', (c, next) => {
          c.set('user', user);
          return next();
        });
        app.use('*', ProAndAdmin);
        app.get('/test', (c) => c.json({ success: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(200);
      });

      it('should allow admin users', async () => {
        const user: Env['Variables']['user'] = { id: 'user-123', email: 'admin@example.com', subscription: 'enterprise', role: 'admin' };

        app.use('*', (c, next) => {
          c.set('user', user);
          return next();
        });
        app.use('*', ProAndAdmin);
        app.get('/test', (c) => c.json({ success: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(200);
      });

      it('should reject free users', async () => {
        const user: Env['Variables']['user'] = { id: 'user-123', email: 'free@example.com', subscription: 'free', role: 'free' };

        app.use('*', (c, next) => {
          c.set('user', user);
          return next();
        });
        app.use('*', ProAndAdmin);
        app.get('/test', (c) => c.json({ success: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(403);
      });
    });

    describe('ProAndEnterprise', () => {
      it('should allow pro users', async () => {
        const user: Env['Variables']['user'] = { id: 'user-123', email: 'pro@example.com', subscription: 'pro', role: 'pro' };

        app.use('*', (c, next) => {
          c.set('user', user);
          return next();
        });
        app.use('*', ProAndEnterprise);
        app.get('/test', (c) => c.json({ success: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(200);
      });

      it('should allow enterprise users', async () => {
        const user: Env['Variables']['user'] = { id: 'user-123', email: 'enterprise@example.com', subscription: 'enterprise', role: 'admin' };

        app.use('*', (c, next) => {
          c.set('user', user);
          return next();
        });
        app.use('*', ProAndEnterprise);
        app.get('/test', (c) => c.json({ success: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(200);
      });

      it('should reject free users', async () => {
        const user: Env['Variables']['user'] = { id: 'user-123', email: 'free@example.com', subscription: 'free', role: 'free' };

        app.use('*', (c, next) => {
          c.set('user', user);
          return next();
        });
        app.use('*', ProAndEnterprise);
        app.get('/test', (c) => c.json({ success: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(403);
      });
    });

    describe('EnterpriseOnly', () => {
      it('should allow enterprise users', async () => {
        const user: Env['Variables']['user'] = { id: 'user-123', email: 'enterprise@example.com', subscription: 'enterprise', role: 'admin' };

        app.use('*', (c, next) => {
          c.set('user', user);
          return next();
        });
        app.use('*', EnterpriseOnly);
        app.get('/test', (c) => c.json({ success: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(200);
      });

      it('should reject pro users', async () => {
        const user: Env['Variables']['user'] = { id: 'user-123', email: 'pro@example.com', subscription: 'pro', role: 'pro' };

        app.use('*', (c, next) => {
          c.set('user', user);
          return next();
        });
        app.use('*', EnterpriseOnly);
        app.get('/test', (c) => c.json({ success: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(403);
      });

      it('should reject free users', async () => {
        const user: Env['Variables']['user'] = { id: 'user-123', email: 'free@example.com', subscription: 'free', role: 'free' };

        app.use('*', (c, next) => {
          c.set('user', user);
          return next();
        });
        app.use('*', EnterpriseOnly);
        app.get('/test', (c) => c.json({ success: true }));

        const res = await app.request('/test');
        expect(res.status).toBe(403);
      });
    });
  });

  describe('Middleware composition', () => {
    it('should work correctly when AuthMiddleware and RequireRole are chained', async () => {
      const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
        id: 'user-123',
        email: 'admin@example.com',
        subscription: 'enterprise',
      };

      const token = await signJWT(payload);
      const user: Env['Variables']['user'] = { ...payload, role: 'admin' };

      const app = new Hono<Env>();
      app.use('*', AuthMiddleware);
      app.use('*', (c, next) => {
        // Simulate adding role to user after auth
        const authUser = c.get('user');
        c.set('user', { ...authUser, role: 'admin' });
        return next();
      });
      app.use('*', RequireRole('admin'));
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      expect(res.status).toBe(200);
    });

    it('should fail when RequireRole is used without AuthMiddleware', async () => {
      const app = new Hono<Env>();
      app.use('*', RequireRole('admin'));
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(403);
    });
  });
});
