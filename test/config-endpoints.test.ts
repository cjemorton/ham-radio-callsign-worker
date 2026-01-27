import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';
import type { Env, Config } from '../src/types';

describe('Configuration Endpoints', () => {
	let env: Env;
	let mockKV: Map<string, string>;

	beforeEach(() => {
		// Create a mock KV namespace
		mockKV = new Map<string, string>();

		const mockKVNamespace = {
			get: async (key: string) => mockKV.get(key) || null,
			put: async (key: string, value: string) => {
				mockKV.set(key, value);
			},
			delete: async (key: string) => {
				mockKV.delete(key);
			},
			list: async (options?: { prefix?: string }) => {
				const keys = Array.from(mockKV.keys())
					.filter((k) => !options?.prefix || k.startsWith(options.prefix))
					.map((name) => ({ name }));
				return { keys, list_complete: true, cursor: '' };
			},
		} as unknown as KVNamespace;

		env = {
			ENVIRONMENT: 'test',
			LOG_LEVEL: 'info',
			ADMIN_API_KEY: 'test-api-key-123',
			CONFIG_KV: mockKVNamespace,
		};
	});

	describe('Public Endpoints', () => {
		describe('GET /api/v1/config/health', () => {
			it('should return config health status', async () => {
				const request = new Request('http://localhost/api/v1/config/health');
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(200);
				const data = await response.json() as { success: boolean; data: { status: string; kvAvailable: boolean } };
				expect(data.success).toBe(true);
				expect(data.data).toHaveProperty('status');
				expect(data.data).toHaveProperty('kvAvailable', true);
			});

			it('should return degraded status when KV is not available', async () => {
				const envNoKV: Env = {
					ENVIRONMENT: 'test',
					ADMIN_API_KEY: 'test-api-key-123',
				};

				const request = new Request('http://localhost/api/v1/config/health');
				const response = await worker.fetch(request, envNoKV, {} as ExecutionContext);

				expect(response.status).toBe(200);
				const data = await response.json() as { success: boolean; data: { status: string; kvAvailable: boolean } };
				expect(data.success).toBe(true);
				expect(data.data.status).toBe('degraded');
				expect(data.data.kvAvailable).toBe(false);
			});
		});

		describe('GET /api/v1/config/version', () => {
			it('should return 404 when no config exists', async () => {
				const request = new Request('http://localhost/api/v1/config/version');
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(404);
			});

			it('should return version info when config exists', async () => {
				// Setup a config in KV
				const testConfig: Config = {
					data: {
						dataSource: {
							originZipUrl: 'https://example.com/data.zip',
							zipFileName: 'data.zip',
							extractedFileName: 'data.dat',
							expectedSchema: {
								fields: ['field1'],
							},
						},
						features: {
							jwtAuth: false,
							canaryDeployment: false,
							advancedSearch: true,
							dataExport: true,
							externalSync: false,
						},
					},
					version: {
						version: '1.2.3',
						hash: 'abc123',
						timestamp: '2024-01-01T00:00:00.000Z',
						description: 'Test version',
					},
				};

				mockKV.set('config:current', JSON.stringify(testConfig));

				const request = new Request('http://localhost/api/v1/config/version');
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(200);
				const data = await response.json() as { success: boolean; data: { version: string; hash: string } };
				expect(data.success).toBe(true);
				expect(data.data.version).toBe('1.2.3');
				expect(data.data.hash).toBe('abc123');
			});
		});
	});

	describe('Admin Endpoints', () => {
		const headers = { 'X-API-Key': 'test-api-key-123' };

		describe('POST /admin/config/refresh', () => {
			it('should require authentication', async () => {
				const request = new Request('http://localhost/admin/config/refresh', {
					method: 'POST',
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(401);
			});

			it('should refresh configuration', async () => {
				const request = new Request('http://localhost/admin/config/refresh', {
					method: 'POST',
					headers,
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(200);
				const data = await response.json() as { success: boolean; data: { message: string } };
				expect(data.success).toBe(true);
				expect(data.data.message).toContain('refreshed');
			});
		});

		describe('POST /admin/config/update', () => {
			it('should require authentication', async () => {
				const request = new Request('http://localhost/admin/config/update', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						data: {},
					}),
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(401);
			});

			it('should require Content-Type application/json', async () => {
				const request = new Request('http://localhost/admin/config/update', {
					method: 'POST',
					headers,
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(400);
				const data = await response.json() as { error: string };
				expect(data.error).toContain('Bad Request');
			});

			it('should require data field in body', async () => {
				const request = new Request('http://localhost/admin/config/update', {
					method: 'POST',
					headers: {
						...headers,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({}),
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(400);
			});

			it('should update configuration with valid data', async () => {
				const configData = {
					dataSource: {
						originZipUrl: 'https://example.com/new.zip',
						zipFileName: 'new.zip',
						extractedFileName: 'new.dat',
						expectedSchema: {
							fields: ['field1', 'field2'],
						},
					},
					features: {
						jwtAuth: true,
						canaryDeployment: false,
						advancedSearch: true,
						dataExport: true,
						externalSync: false,
					},
				};

				const request = new Request('http://localhost/admin/config/update', {
					method: 'POST',
					headers: {
						...headers,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						data: configData,
						updatedBy: 'test-admin',
						description: 'Test update',
					}),
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(200);
				const data = await response.json() as { success: boolean; data: { message: string; hash: string } };
				expect(data.success).toBe(true);
				expect(data.data.message).toContain('updated');
				expect(data.data).toHaveProperty('hash');
			});

			it('should reject invalid configuration', async () => {
				const invalidData = {
					// Missing required fields
					features: {},
				};

				const request = new Request('http://localhost/admin/config/update', {
					method: 'POST',
					headers: {
						...headers,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						data: invalidData,
					}),
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(400);
			});
		});

		describe('GET /admin/config/versions', () => {
			it('should require authentication', async () => {
				const request = new Request('http://localhost/admin/config/versions');
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(401);
			});

			it('should return list of versions', async () => {
				const request = new Request('http://localhost/admin/config/versions', {
					headers,
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(200);
				const data = await response.json() as { success: boolean; data: { count: number; versions: unknown[] } };
				expect(data.success).toBe(true);
				expect(data.data).toHaveProperty('count');
				expect(data.data).toHaveProperty('versions');
				expect(Array.isArray(data.data.versions)).toBe(true);
			});
		});

		describe('POST /admin/config/rollback', () => {
			it('should require authentication', async () => {
				const request = new Request('http://localhost/admin/config/rollback', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						version: '1.0.0',
					}),
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(401);
			});

			it('should require version in body', async () => {
				const request = new Request('http://localhost/admin/config/rollback', {
					method: 'POST',
					headers: {
						...headers,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({}),
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(400);
			});

			it('should return error for non-existent version', async () => {
				const request = new Request('http://localhost/admin/config/rollback', {
					method: 'POST',
					headers: {
						...headers,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						version: 'nonexistent',
					}),
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(400);
			});

			it('should rollback to existing version', async () => {
				// First, create a config version
				const testConfig: Config = {
					data: {
						dataSource: {
							originZipUrl: 'https://example.com/old.zip',
							zipFileName: 'old.zip',
							extractedFileName: 'old.dat',
							expectedSchema: {
								fields: ['field1'],
							},
						},
						features: {
							jwtAuth: false,
							canaryDeployment: false,
							advancedSearch: true,
							dataExport: true,
							externalSync: false,
						},
					},
					version: {
						version: '2024-01-01T00:00:00.000Z',
						hash: 'old-hash',
						timestamp: '2024-01-01T00:00:00.000Z',
					},
				};

				mockKV.set('config:history:2024-01-01T00:00:00.000Z', JSON.stringify(testConfig));

				const request = new Request('http://localhost/admin/config/rollback', {
					method: 'POST',
					headers: {
						...headers,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						version: '2024-01-01T00:00:00.000Z',
					}),
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(200);
				const data = await response.json() as { success: boolean; data: { message: string } };
				expect(data.success).toBe(true);
				expect(data.data.message).toContain('rolled back');
			});
		});

		describe('GET /admin/config/current', () => {
			it('should require authentication', async () => {
				const request = new Request('http://localhost/admin/config/current');
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(401);
			});

			it('should return current configuration', async () => {
				const request = new Request('http://localhost/admin/config/current', {
					headers,
				});
				const response = await worker.fetch(request, env, {} as ExecutionContext);

				expect(response.status).toBe(200);
				const data = await response.json() as { success: boolean; data: { data: unknown; version: unknown } };
				expect(data.success).toBe(true);
				expect(data.data).toHaveProperty('data');
				expect(data.data).toHaveProperty('version');
			});
		});
	});
});
