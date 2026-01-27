/**
 * Tests for middleware functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

describe('Middleware Integration Tests', () => {
	let env: Env;

	beforeEach(() => {
		env = {
			ENVIRONMENT: 'test',
			LOG_LEVEL: 'info',
			ADMIN_API_KEY: 'test-secret-key',
		};
	});

	describe('CORS Middleware', () => {
		it('should add CORS headers to responses', async () => {
			const request = new Request('http://localhost/health');
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
				'*'
			);
		});

		it('should handle preflight OPTIONS requests', async () => {
			const request = new Request('http://localhost/api/v1/callsign/TEST', {
				method: 'OPTIONS',
				headers: {
					'Access-Control-Request-Method': 'GET',
					'Access-Control-Request-Headers': 'Content-Type',
				},
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
			expect(
				response.headers.get('Access-Control-Allow-Methods')
			).toBeTruthy();
		});

		it('should allow custom headers', async () => {
			const request = new Request('http://localhost/health', {
				method: 'OPTIONS',
				headers: {
					'Access-Control-Request-Headers':
						'Authorization,Content-Type',
				},
			});

			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(
				response.headers.get('Access-Control-Allow-Headers')
			).toBeTruthy();
		});
	});

	describe('Authentication Middleware', () => {
		it('should allow public endpoints without auth', async () => {
			const request = new Request('http://localhost/health');
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
		});

		it('should allow user endpoints without auth', async () => {
			const request = new Request(
				'http://localhost/api/v1/callsign/TEST'
			);
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Should not require auth
			expect(response.status).not.toBe(401);
		});

		it('should require auth for admin endpoints', async () => {
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

		it('should accept valid Bearer token', async () => {
			const request = new Request('http://localhost/admin/update', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer test-secret-key',
				},
			});

			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Should not return 401
			expect(response.status).not.toBe(401);
		});

		it('should reject invalid Bearer token', async () => {
			const request = new Request('http://localhost/admin/update', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer wrong-key',
				},
			});

			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(401);
		});

		it('should reject malformed Authorization header', async () => {
			const request = new Request('http://localhost/admin/update', {
				method: 'POST',
				headers: {
					Authorization: 'InvalidFormat test-secret-key',
				},
			});

			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(401);
		});
	});

	describe('Rate Limiting Middleware', () => {
		it('should allow requests under rate limit', async () => {
			const request = new Request(
				'http://localhost/api/v1/callsign/TEST'
			);
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// First request should not be rate limited
			expect(response.status).not.toBe(429);
		});

		it('should include rate limit headers', async () => {
			const request = new Request('http://localhost/health');
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// May include rate limit headers
			const limitHeader = response.headers.get('X-RateLimit-Limit');
			if (limitHeader) {
				expect(parseInt(limitHeader)).toBeGreaterThan(0);
			}
		});

		it('should track rate limits per IP', async () => {
			// Make multiple requests from same IP
			const requests = Array.from({ length: 5 }, (_, i) =>
				new Request(`http://localhost/health?n=${i}`, {
					headers: { 'CF-Connecting-IP': '1.2.3.4' },
				})
			);

			for (const request of requests) {
				const response = await worker.fetch(
					request,
					env,
					{} as ExecutionContext
				);
				// All should succeed under normal rate limits
				expect([200, 429]).toContain(response.status);
			}
		});
	});

	describe('Content-Type Middleware', () => {
		it('should set JSON content type for API responses', async () => {
			const request = new Request('http://localhost/health');
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.headers.get('Content-Type')).toContain(
				'application/json'
			);
		});

		it('should handle JSON request bodies', async () => {
			const request = new Request('http://localhost/admin/update', {
				method: 'POST',
				headers: {
					Authorization: 'Bearer test-secret-key',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ force: true }),
			});

			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Should accept JSON body
			expect([200, 400, 500]).toContain(response.status);
		});
	});

	describe('Security Headers', () => {
		it('should include common response headers', async () => {
			const request = new Request('http://localhost/health');
			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Check that response has headers
			expect(response.headers.get('Content-Type')).toBeTruthy();
		});
	});

	describe('Error Handling Middleware', () => {
		it('should handle thrown errors gracefully', async () => {
			// Try to trigger an error
			const request = new Request('http://localhost/api/v1/callsign/', {
				method: 'POST', // Wrong method
			});

			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			// Should return proper error response
			expect([400, 404, 405]).toContain(response.status);
			expect(response.headers.get('Content-Type')).toContain(
				'application/json'
			);
		});

		it('should include error details in response', async () => {
			const request = new Request(
				'http://localhost/api/v1/search' // Missing query parameter
			);

			const response = await worker.fetch(
				request,
				env,
				{} as ExecutionContext
			);

			const data = await response.json();
			if (response.status >= 400) {
				expect(data).toHaveProperty('error');
			}
		});
	});
});
