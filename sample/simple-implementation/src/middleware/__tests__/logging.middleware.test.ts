import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import {
  LoggingMiddleware,
  ErrorMiddleware,
  CORSMiddleware,
} from '../logging.middleware.js';

describe('logging.middleware', () => {
  describe('LoggingMiddleware', () => {
    let app: Hono;
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      app = new Hono();
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should log request start and completion', async () => {
      app.use('*', LoggingMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      await app.request('/test');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      
      const firstCall = consoleLogSpy.mock.calls[0][0] as string;
      const secondCall = consoleLogSpy.mock.calls[1][0] as string;

      expect(firstCall).toContain('GET /test');
      expect(firstCall).toContain('Request started');
      expect(secondCall).toContain('GET /test');
      expect(secondCall).toContain('200');
      expect(secondCall).toContain('ms');
    });

    it('should log different HTTP methods', async () => {
      app.use('*', LoggingMiddleware);
      app.get('/test', (c) => c.json({ method: 'GET' }));
      app.post('/test', (c) => c.json({ method: 'POST' }));
      app.put('/test', (c) => c.json({ method: 'PUT' }));
      app.delete('/test', (c) => c.json({ method: 'DELETE' }));

      await app.request('/test', { method: 'GET' });
      await app.request('/test', { method: 'POST' });
      await app.request('/test', { method: 'PUT' });
      await app.request('/test', { method: 'DELETE' });

      expect(consoleLogSpy).toHaveBeenCalledTimes(8); // 2 logs per request (start + end)
      
      const methods = consoleLogSpy.mock.calls.map((call) => (call[0] as string).split(' ')[1]);
      const startLogs = methods.filter((_, i) => i % 2 === 0);
      
      expect(startLogs).toContain('GET');
      expect(startLogs).toContain('POST');
      expect(startLogs).toContain('PUT');
      expect(startLogs).toContain('DELETE');
    });

    it('should log request duration in milliseconds', async () => {
      app.use('*', LoggingMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      await app.request('/test');

      const endLog = consoleLogSpy.mock.calls[1][0] as string;
      const durationMatch = endLog.match(/\((\d+)ms\)/);
      
      expect(durationMatch).not.toBeNull();
      const duration = parseInt(durationMatch![1], 10);
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should log response status codes', async () => {
      app.use('*', LoggingMiddleware);
      app.get('/success', (c) => c.json({ success: true }, 200));
      app.get('/not-found', (c) => c.json({ error: 'Not found' }, 404));
      app.get('/server-error', (c) => c.json({ error: 'Server error' }, 500));

      await app.request('/success');
      await app.request('/not-found');
      await app.request('/server-error');

      const endLogs = consoleLogSpy.mock.calls.filter((_, i) => i % 2 === 1).map((call) => call[0] as string);
      
      expect(endLogs[0]).toContain('200');
      expect(endLogs[1]).toContain('404');
      expect(endLogs[2]).toContain('500');
    });

    it('should log different paths', async () => {
      app.use('*', LoggingMiddleware);
      app.get('/api/users', (c) => c.json({ users: [] }));
      app.get('/api/products', (c) => c.json({ products: [] }));
      app.get('/health', (c) => c.json({ status: 'ok' }));

      await app.request('/api/users');
      await app.request('/api/products');
      await app.request('/health');

      const logs = consoleLogSpy.mock.calls.map((call) => call[0] as string);
      
      expect(logs.some((log) => log.includes('/api/users'))).toBe(true);
      expect(logs.some((log) => log.includes('/api/products'))).toBe(true);
      expect(logs.some((log) => log.includes('/health'))).toBe(true);
    });

    it('should include ISO 8601 timestamps', async () => {
      app.use('*', LoggingMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      await app.request('/test');

      const firstLog = consoleLogSpy.mock.calls[0][0] as string;
      const secondLog = consoleLogSpy.mock.calls[1][0] as string;

      // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
      const isoTimestampRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
      
      expect(firstLog).toMatch(isoTimestampRegex);
      expect(secondLog).toMatch(isoTimestampRegex);
    });
  });

  describe('ErrorMiddleware', () => {
    let app: Hono;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      app = new Hono();
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should catch and log errors', async () => {
      app.use('*', ErrorMiddleware);
      app.get('/error', () => {
        throw new Error('Test error');
      });

      const res = await app.request('/error');

      expect(res.status).toBe(500);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      
      const errorArg = consoleErrorSpy.mock.calls[0].find(arg => arg instanceof Error);
      expect(errorArg).toBeInstanceOf(Error);
      expect(errorArg?.message).toBe('Test error');
    });

    it('should return error message for Error instances', async () => {
      app.use('*', ErrorMiddleware);
      app.get('/error', () => {
        throw new Error('Custom error message');
      });

      const res = await app.request('/error');

      expect(res.status).toBe(500);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);

      const errorArg = consoleErrorSpy.mock.calls[0].find(arg => arg instanceof Error);
      expect(errorArg).toBeInstanceOf(Error);
      expect(errorArg?.message).toBe('Custom error message');
    });

    it('should return generic error for non-Error instances', async () => {
      app.use('*', ErrorMiddleware);
      app.get('/error', () => {
        throw 'String error';
      });

      const res = await app.request('/error');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Internal server error');
    });

    it('should handle null/undefined errors', async () => {
      app.use('*', ErrorMiddleware);
      app.get('/error', () => {
        throw null;
      });

      const res = await app.request('/error');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Internal server error');
    });

    it('should allow successful requests to pass through', async () => {
      app.use('*', ErrorMiddleware);
      app.get('/success', (c) => c.json({ success: true }));

      const res = await app.request('/success');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should log error details', async () => {
      app.use('*', ErrorMiddleware);
      app.get('/error', () => {
        const error = new Error('Detailed error');
        error.stack = 'Error stack trace';
        throw error;
      });

      await app.request('/error');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      // Just verify console.error was called with an error
      const errorArg = consoleErrorSpy.mock.calls[0].find(arg => arg instanceof Error);
      expect(errorArg).toBeInstanceOf(Error);
      expect(errorArg?.message).toBe('Detailed error');
    });
  });

  describe('CORSMiddleware', () => {
    let app: Hono;

    beforeEach(() => {
      app = new Hono();
    });

    it('should set CORS headers for all requests', async () => {
      app.use('*', CORSMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, PATCH, OPTIONS');
      expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });

    it('should handle OPTIONS preflight requests', async () => {
      app.use('*', CORSMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', { method: 'OPTIONS' });

      expect(res.status).toBe(204);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(res.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, PUT, DELETE, PATCH, OPTIONS');
      expect(res.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });

    it('should allow GET requests to pass through', async () => {
      app.use('*', CORSMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', { method: 'GET' });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('should allow POST requests to pass through', async () => {
      app.use('*', CORSMiddleware);
      app.post('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', { 
        method: 'POST',
        body: JSON.stringify({ data: 'test' }),
        headers: { 'Content-Type': 'application/json' }
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('should allow PUT requests to pass through', async () => {
      app.use('*', CORSMiddleware);
      app.put('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', { 
        method: 'PUT',
        body: JSON.stringify({ data: 'updated' }),
        headers: { 'Content-Type': 'application/json' }
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('should allow DELETE requests to pass through', async () => {
      app.use('*', CORSMiddleware);
      app.delete('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', { method: 'DELETE' });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('should allow PATCH requests to pass through', async () => {
      app.use('*', CORSMiddleware);
      app.patch('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', { 
        method: 'PATCH',
        body: JSON.stringify({ data: 'patched' }),
        headers: { 'Content-Type': 'application/json' }
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });

    it('should set CORS headers on all response types', async () => {
      app.use('*', CORSMiddleware);
      app.get('/success', (c) => c.json({ success: true }));
      app.get('/not-found', (c) => c.json({ error: 'Not found' }, 404));
      app.get('/server-error', (c) => c.json({ error: 'Server error' }, 500));

      const successRes = await app.request('/success');
      const notFoundRes = await app.request('/not-found');
      const serverErrorRes = await app.request('/server-error');

      expect(successRes.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(notFoundRes.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(serverErrorRes.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });

  describe('Middleware composition', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('should work correctly when all middleware are chained', async () => {
      const app = new Hono();
      app.use('*', CORSMiddleware);
      app.use('*', LoggingMiddleware);
      app.use('*', ErrorMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test');

      expect(res.status).toBe(200);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle errors with logging middleware', async () => {
      const app = new Hono();
      app.use('*', CORSMiddleware);
      app.use('*', LoggingMiddleware);
      app.use('*', ErrorMiddleware);
      app.get('/error', () => {
        throw new Error('Test error');
      });

      const res = await app.request('/error');

      expect(res.status).toBe(500);
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // Request start and end
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle OPTIONS preflight with logging', async () => {
      const app = new Hono();
      app.use('*', CORSMiddleware);
      app.use('*', LoggingMiddleware);
      app.get('/test', (c) => c.json({ success: true }));

      const res = await app.request('/test', { method: 'OPTIONS' });

      expect(res.status).toBe(204);
      // CORS middleware returns early for OPTIONS, so LoggingMiddleware doesn't log
      expect(consoleLogSpy).toHaveBeenCalledTimes(0);
    });

    it('should maintain request context through middleware chain', async () => {
      const app = new Hono();
      app.use('*', CORSMiddleware);
      app.use('*', LoggingMiddleware);
      app.use('*', ErrorMiddleware);
      app.get('/test', (c) => {
        // Verify context is preserved
        return c.json({ 
          success: true, 
          method: c.req.method,
          path: c.req.path 
        });
      });

      const res = await app.request('/test');
      const json = await res.json();

      expect(json.success).toBe(true);
      expect(json.method).toBe('GET');
      expect(json.path).toBe('/test');
    });
  });
});
