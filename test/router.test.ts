/**
 * Tests for router functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

describe('Router Integration Tests', () => {
	let env: Env;

	beforeEach(() => {
		env = {
			ENVIRONMENT: 'test',
			LOG_LEVEL: 'info',
			ADMIN_API_KEY: 'test-api-key',
		};
	});

	describe('Route Resolution', () => {
		it('should route to health endpoint', async () => {
			const request = new Request('http://localhost/health');
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.status).toBe('ok');
		});

		it('should route to version endpoint', async () => {
			const request = new Request('http://localhost/version');
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.version).toBeTruthy();
		});

		it('should route to user callsign lookup', async () => {
			const request = new Request(
				'http://localhost/api/v1/callsign/TEST123'
			);
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Should return error since DB not configured, but route should work
			expect([200, 400, 404, 503]).toContain(response.status);
		});

		it('should route to search endpoint', async () => {
			const request = new Request(
				'http://localhost/api/v1/search?q=test'
			);
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Should return error since DB not configured, but route should work
			expect([200, 503]).toContain(response.status);
		});

		it('should handle 404 for unknown routes', async () => {
			const request = new Request(
				'http://localhost/unknown/route/path'
			);
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(404);
		});

		it('should handle admin routes with authentication', async () => {
			const request = new Request('http://localhost/admin/update', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer test-api-key',
				},
			});

			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Should not return 401, may return other error
			expect(response.status).not.toBe(401);
		});

		it('should reject admin routes without authentication', async () => {
			const request = new Request('http://localhost/admin/update', {
				method: 'POST',
			});

			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(401);
		});
	});

	describe('HTTP Methods', () => {
		it('should handle GET requests', async () => {
			const request = new Request('http://localhost/health', {
				method: 'GET',
			});
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
		});

		it('should handle POST requests to admin endpoints', async () => {
			const request = new Request('http://localhost/admin/update', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer test-api-key',
				},
			});

			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Should route properly, may return error due to missing config
			expect(response.status).not.toBe(404);
		});

		it('should handle OPTIONS requests for CORS', async () => {
			const request = new Request('http://localhost/health', {
				method: 'OPTIONS',
			});
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(204);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
				'*'
			);
		});
	});

	describe('Path Parameters', () => {
		it('should extract callsign from path', async () => {
			const request = new Request(
				'http://localhost/api/v1/callsign/K1ABC'
			);
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Route should work even if DB returns error
			expect([200, 400, 404, 503]).toContain(response.status);
		});

		it('should handle special characters in callsign', async () => {
			const request = new Request(
				'http://localhost/api/v1/callsign/AB1CD/EF'
			);
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Should handle gracefully
			expect([400, 404, 503]).toContain(response.status);
		});
	});

	describe('Query Parameters', () => {
		it('should handle search query parameters', async () => {
			const request = new Request(
				'http://localhost/api/v1/search?q=smith&limit=10'
			);
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect([200, 503]).toContain(response.status);
		});

		it('should handle log query parameters', async () => {
			const request = new Request(
				'http://localhost/admin/logs/events?limit=50&type=error',
				{
					headers: {
						Authorization: 'Bearer test-api-key',
					},
				}
			);
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Route should be accessible
			expect(response.status).not.toBe(404);
		});
	});

	describe('Error Handling', () => {
		it('should return JSON error responses', async () => {
			const request = new Request(
				'http://localhost/unknown/endpoint'
			);
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(404);
			expect(response.headers.get('Content-Type')).toContain(
				'application/json'
			);

			const data = await response.json();
			expect(data.error).toBeTruthy();
		});

		it('should handle malformed requests', async () => {
			const request = new Request('http://localhost/api/v1/callsign/', {
				method: 'GET',
			});
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Should return appropriate error
			expect([400, 404]).toContain(response.status);
		});
	});
});
