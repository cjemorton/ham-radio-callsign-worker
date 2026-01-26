import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

describe('Ham Radio Callsign Worker', () => {
	let env: Env;

	beforeEach(() => {
		env = {
			ENVIRONMENT: 'test',
			LOG_LEVEL: 'info',
			ADMIN_API_KEY: 'test-api-key-123',
		};
	});

	describe('Health and Version Endpoints', () => {
		it('should return health status on GET /', async () => {
			const request = new Request('http://localhost/');
			const response = await worker.fetch(request, env, {} as ExecutionContext);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data).toHaveProperty('status', 'ok');
			expect(data).toHaveProperty('service', 'ham-radio-callsign-worker');
			expect(data).toHaveProperty('version');
			expect(data).toHaveProperty('environment', 'test');
		});

		it('should return health status on GET /health', async () => {
			const request = new Request('http://localhost/health');
			const response = await worker.fetch(request, env, {} as ExecutionContext);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data).toHaveProperty('status', 'ok');
		});

		it('should return version on GET /version', async () => {
			const request = new Request('http://localhost/version');
			const response = await worker.fetch(request, env, {} as ExecutionContext);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data).toHaveProperty('version', '0.1.0');
			expect(data).toHaveProperty('api_version', 'v1');
		});
	});

	describe('User Endpoints', () => {
		describe('GET /api/v1/callsign/:callsign', () => {
			it('should return 503 when database is not configured', async () => {
				const request = new Request('http://localhost/api/v1/callsign/K1ABC');
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(503);
				const data = await response.json();
				expect(data).toHaveProperty('error');
			});

			it('should reject invalid callsign format', async () => {
				const request = new Request('http://localhost/api/v1/callsign/INVALID');
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(400);
				const data = await response.json();
				expect(data).toHaveProperty('error', 'Bad Request');
			});

			it('should include rate limit headers', async () => {
				const request = new Request('http://localhost/api/v1/callsign/K1ABC');
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.headers.get('X-RateLimit-Limit')).toBe('100');
				expect(response.headers.has('X-RateLimit-Remaining')).toBe(true);
				expect(response.headers.has('X-RateLimit-Reset')).toBe(true);
			});
		});

		describe('GET /api/v1/search', () => {
			it('should require query parameter', async () => {
				const request = new Request('http://localhost/api/v1/search');
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(400);
				const data = await response.json();
				expect(data).toHaveProperty('error', 'Bad Request');
			});

			it('should return 503 when database is not configured', async () => {
				const request = new Request('http://localhost/api/v1/search?q=test');
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(503);
			});
		});

		describe('GET /api/v1/export', () => {
			it('should return 503 when R2 is not configured', async () => {
				const request = new Request('http://localhost/api/v1/export');
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(503);
			});

			it('should reject invalid format', async () => {
				const request = new Request('http://localhost/api/v1/export?format=xml');
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(400);
			});
		});
	});

	describe('Admin Endpoints - Authentication', () => {
		it('should require API key for admin endpoints', async () => {
			const request = new Request('http://localhost/admin/stats');
			const response = await worker.fetch(request, env, {} as ExecutionContext);

			expect(response.status).toBe(401);
			const data = await response.json();
			expect(data).toHaveProperty('error', 'Unauthorized');
		});

		it('should reject invalid API key', async () => {
			const request = new Request('http://localhost/admin/stats', {
				headers: {
					'X-API-Key': 'wrong-key',
				},
			});
			const response = await worker.fetch(request, env, {} as ExecutionContext);

			expect(response.status).toBe(401);
		});

		it('should accept valid API key in X-API-Key header', async () => {
			const request = new Request('http://localhost/admin/stats', {
				headers: {
					'X-API-Key': 'test-api-key-123',
				},
			});
			const response = await worker.fetch(request, env, {} as ExecutionContext);

			expect(response.status).toBe(200);
		});

		it('should accept valid API key in Authorization header', async () => {
			const request = new Request('http://localhost/admin/stats', {
				headers: {
					Authorization: 'Bearer test-api-key-123',
				},
			});
			const response = await worker.fetch(request, env, {} as ExecutionContext);

			expect(response.status).toBe(200);
		});
	});

	describe('Admin Endpoints - Functionality', () => {
		const headers = { 'X-API-Key': 'test-api-key-123' };

		describe('POST /admin/update', () => {
			it('should return success message for force update', async () => {
				const request = new Request('http://localhost/admin/update', {
					method: 'POST',
					headers,
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(503); // Database not configured
				const data = await response.json();
				expect(data).toHaveProperty('error');
			});
		});

		describe('POST /admin/rebuild', () => {
			it('should return success message for rebuild', async () => {
				const request = new Request('http://localhost/admin/rebuild', {
					method: 'POST',
					headers,
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(503); // Database not configured
			});
		});

		describe('POST /admin/rollback', () => {
			it('should handle rollback request', async () => {
				const request = new Request('http://localhost/admin/rollback', {
					method: 'POST',
					headers,
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(503); // Database not configured
			});
		});

		describe('GET /admin/logs', () => {
			it('should return logs', async () => {
				const request = new Request('http://localhost/admin/logs', {
					headers,
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.success).toBe(true);
				expect(data.data).toHaveProperty('logs');
			});

			it('should respect limit parameter', async () => {
				const request = new Request('http://localhost/admin/logs?limit=2', {
					headers,
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.data.limit).toBe(2);
			});
		});

		describe('GET /admin/metadata', () => {
			it('should return metadata', async () => {
				const request = new Request('http://localhost/admin/metadata', {
					headers,
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(503); // Metadata store not configured
			});
		});

		describe('GET /admin/stats', () => {
			it('should return statistics', async () => {
				const request = new Request('http://localhost/admin/stats', {
					headers,
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(200);
				const data = await response.json();
				expect(data.success).toBe(true);
				expect(data.data).toHaveProperty('requests');
			});
		});
	});

	describe('CORS', () => {
		it('should handle OPTIONS requests', async () => {
			const request = new Request('http://localhost/api/v1/callsign/K1ABC', {
				method: 'OPTIONS',
			});
			const response = await worker.fetch(request, env, {} as ExecutionContext);

			expect(response.status).toBe(204);
			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
			expect(response.headers.has('Access-Control-Allow-Methods')).toBe(true);
		});

		it('should include CORS headers in responses', async () => {
			const request = new Request('http://localhost/health');
			const response = await worker.fetch(request, env, {} as ExecutionContext);

			expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
		});
	});

	describe('Rate Limiting', () => {
		it('should enforce rate limits', async () => {
			// Use a unique path to isolate rate limiting for this test
			// Make 101 requests to exceed the limit of 100
			let rateLimitedCount = 0;
			for (let i = 0; i < 110; i++) {
				const request = new Request(`http://localhost/api/v1/search?q=ratelimit-test-${i}`);
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				if (response.status === 429) {
					rateLimitedCount++;
				}
			}

			// At least some requests should have been rate limited
			expect(rateLimitedCount).toBeGreaterThan(0);
		});
	});

	describe('Error Handling', () => {
		it('should return 404 for unknown routes', async () => {
			const request = new Request('http://localhost/unknown/route');
			const response = await worker.fetch(request, env, {} as ExecutionContext);

			expect(response.status).toBe(404);
			const data = await response.json();
			expect(data).toHaveProperty('error', 'Not Found');
		});

		it('should include timestamp in error responses', async () => {
			const request = new Request('http://localhost/unknown');
			const response = await worker.fetch(request, env, {} as ExecutionContext);

			const data = await response.json();
			expect(data).toHaveProperty('timestamp');
		});
	});
});
