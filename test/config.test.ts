import { describe, it, expect, beforeEach } from 'vitest';
import type { Env, Config, ConfigData } from '../src/types';
import {
	loadConfig,
	saveConfig,
	refreshConfig,
	getConfigVersion,
	getConfigHealth,
	listConfigVersions,
	rollbackConfig,
} from '../src/config';

describe('Configuration Module', () => {
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
				return { keys, list_complete: true, curosr: '' };
			},
		} as unknown as KVNamespace;

		env = {
			ENVIRONMENT: 'test',
			LOG_LEVEL: 'info',
			CONFIG_KV: mockKVNamespace,
		};
	});

	describe('loadConfig', () => {
		it('should return default config when KV is not available', async () => {
			const envNoKV: Env = {
				ENVIRONMENT: 'test',
			};

			const config = await loadConfig(envNoKV);

			expect(config).toBeDefined();
			expect(config.data).toBeDefined();
			expect(config.version.version).toBe('0.0.0');
			expect(config.data.features).toBeDefined();
			expect(config.data.dataSource).toBeDefined();
		});

		it('should return default config when no config exists in KV', async () => {
			const config = await loadConfig(env);

			expect(config).toBeDefined();
			expect(config.data).toBeDefined();
			expect(config.version.version).toBe('0.0.0');
			expect(config.data.features.jwtAuth).toBe(false);
			expect(config.data.features.dataExport).toBe(true);
		});

		it('should load config from KV when it exists', async () => {
			// Setup a valid config in mock KV
			const testConfig: Config = {
				data: {
					dataSource: {
						originZipUrl: 'https://example.com/data.zip',
						zipFileName: 'data.zip',
						extractedFileName: 'data.dat',
						expectedSchema: {
							fields: ['field1', 'field2'],
							delimiter: ',',
							hasHeader: true,
						},
					},
					features: {
						jwtAuth: true,
						canaryDeployment: false,
						advancedSearch: true,
						dataExport: true,
						externalSync: false,
					},
					rateLimits: {
						user: { requestsPerMinute: 200 },
						admin: { requestsPerMinute: 50 },
					},
				},
				version: {
					version: '1.0.0',
					hash: 'abcd1234',
					timestamp: new Date().toISOString(),
					description: 'Test config',
				},
			};

			mockKV.set('config:current', JSON.stringify(testConfig));

			const config = await loadConfig(env);

			expect(config.version.version).toBe('1.0.0');
			expect(config.data.features.jwtAuth).toBe(true);
			expect(config.data.dataSource.originZipUrl).toBe('https://example.com/data.zip');
		});

		it('should return default config when validation fails', async () => {
			// Setup an invalid config
			const invalidConfig = {
				data: {
					// Missing required fields
					features: {},
				},
				version: {
					version: '1.0.0',
					hash: 'test',
					timestamp: new Date().toISOString(),
				},
			};

			mockKV.set('config:current', JSON.stringify(invalidConfig));

			const config = await loadConfig(env);

			// Should fall back to default
			expect(config.version.version).toBe('0.0.0');
		});
	});

	describe('saveConfig', () => {
		it('should save valid config to KV', async () => {
			const configData: ConfigData = {
				dataSource: {
					originZipUrl: 'https://example.com/data.zip',
					zipFileName: 'data.zip',
					extractedFileName: 'data.dat',
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

			const config = await saveConfig(env, configData, 'test-user', 'Test save');

			expect(config).toBeDefined();
			expect(config.version.updatedBy).toBe('test-user');
			expect(config.version.description).toBe('Test save');

			// Verify it was saved to KV
			const saved = mockKV.get('config:current');
			expect(saved).toBeDefined();

			const parsed = JSON.parse(saved!) as Config;
			expect(parsed.data.features.jwtAuth).toBe(true);
		});

		it('should throw error when KV is not available', async () => {
			const envNoKV: Env = { ENVIRONMENT: 'test' };
			const configData: ConfigData = {
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
			};

			await expect(saveConfig(envNoKV, configData)).rejects.toThrow('CONFIG_KV namespace not available');
		});

		it('should throw error for invalid config', async () => {
			const invalidData = {
				// Missing required dataSource field
				features: {
					jwtAuth: false,
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: false,
				},
			} as ConfigData;

			await expect(saveConfig(env, invalidData)).rejects.toThrow('Invalid configuration');
		});

		it('should save config to history', async () => {
			const configData: ConfigData = {
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
			};

			const config = await saveConfig(env, configData);

			// Check that history entry was created
			const historyKey = `config:history:${config.version.version}`;
			const historyEntry = mockKV.get(historyKey);
			expect(historyEntry).toBeDefined();
		});
	});

	describe('getConfigVersion', () => {
		it('should return null when KV is not available', async () => {
			const envNoKV: Env = { ENVIRONMENT: 'test' };
			const version = await getConfigVersion(envNoKV);
			expect(version).toBeNull();
		});

		it('should return null when no config exists', async () => {
			const version = await getConfigVersion(env);
			expect(version).toBeNull();
		});

		it('should return version when config exists', async () => {
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
					version: '2.0.0',
					hash: 'xyz789',
					timestamp: new Date().toISOString(),
				},
			};

			mockKV.set('config:current', JSON.stringify(testConfig));

			const version = await getConfigVersion(env);

			expect(version).toBeDefined();
			expect(version!.version).toBe('2.0.0');
			expect(version!.hash).toBe('xyz789');
		});
	});

	describe('refreshConfig', () => {
		it('should reload config from KV', async () => {
			const testConfig: Config = {
				data: {
					dataSource: {
						originZipUrl: 'https://example.com/updated.zip',
						zipFileName: 'updated.zip',
						extractedFileName: 'updated.dat',
						expectedSchema: {
							fields: ['field1'],
						},
					},
					features: {
						jwtAuth: true,
						canaryDeployment: true,
						advancedSearch: true,
						dataExport: true,
						externalSync: false,
					},
				},
				version: {
					version: '3.0.0',
					hash: 'refresh123',
					timestamp: new Date().toISOString(),
				},
			};

			mockKV.set('config:current', JSON.stringify(testConfig));

			const config = await refreshConfig(env);

			expect(config.version.version).toBe('3.0.0');
			expect(config.data.features.jwtAuth).toBe(true);
			expect(config.data.dataSource.originZipUrl).toBe('https://example.com/updated.zip');
		});
	});

	describe('getConfigHealth', () => {
		it('should return degraded status when KV is not available', async () => {
			const envNoKV: Env = { ENVIRONMENT: 'test' };
			const health = await getConfigHealth(envNoKV);

			expect(health.status).toBe('degraded');
			expect(health.kvAvailable).toBe(false);
			expect(health.validationErrors).toContain('CONFIG_KV namespace not available');
		});

		it('should return healthy status for valid config', async () => {
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
					version: '1.0.0',
					hash: 'abc123',
					timestamp: new Date().toISOString(),
				},
			};

			mockKV.set('config:current', JSON.stringify(testConfig));

			const health = await getConfigHealth(env);

			expect(health.status).toBe('healthy');
			expect(health.kvAvailable).toBe(true);
			expect(health.version).toBe('1.0.0');
			expect(health.validationErrors).toBeUndefined();
		});
	});

	describe('listConfigVersions', () => {
		it('should return empty array when KV is not available', async () => {
			const envNoKV: Env = { ENVIRONMENT: 'test' };
			const versions = await listConfigVersions(envNoKV);
			expect(versions).toEqual([]);
		});

		it('should return list of versions from history', async () => {
			// Create multiple history entries
			const timestamps = [
				'2024-01-01T00:00:00.000Z',
				'2024-01-02T00:00:00.000Z',
				'2024-01-03T00:00:00.000Z',
			];

			for (const ts of timestamps) {
				const config: Config = {
					data: {
						dataSource: {
							originZipUrl: 'https://example.com/data.zip',
							zipFileName: 'data.zip',
							extractedFileName: 'data.dat',
							expectedSchema: { fields: ['field1'] },
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
						version: ts,
						hash: `hash-${ts}`,
						timestamp: ts,
					},
				};
				mockKV.set(`config:history:${ts}`, JSON.stringify(config));
			}

			const versions = await listConfigVersions(env);

			expect(versions.length).toBe(3);
			// Should be sorted newest first
			expect(versions[0].timestamp).toBe('2024-01-03T00:00:00.000Z');
			expect(versions[2].timestamp).toBe('2024-01-01T00:00:00.000Z');
		});
	});

	describe('rollbackConfig', () => {
		it('should throw error when KV is not available', async () => {
			const envNoKV: Env = { ENVIRONMENT: 'test' };
			await expect(rollbackConfig(envNoKV, '1.0.0')).rejects.toThrow('CONFIG_KV namespace not available');
		});

		it('should throw error when version not found', async () => {
			await expect(rollbackConfig(env, 'nonexistent')).rejects.toThrow('not found in history');
		});

		it('should rollback to specified version', async () => {
			// Create a history entry
			const targetTimestamp = '2024-01-01T00:00:00.000Z';
			const targetConfig: Config = {
				data: {
					dataSource: {
						originZipUrl: 'https://example.com/old.zip',
						zipFileName: 'old.zip',
						extractedFileName: 'old.dat',
						expectedSchema: { fields: ['field1'] },
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
					version: targetTimestamp,
					hash: 'old-hash',
					timestamp: targetTimestamp,
				},
			};

			mockKV.set(`config:history:${targetTimestamp}`, JSON.stringify(targetConfig));

			// Set a different current config
			const currentConfig: Config = {
				data: {
					dataSource: {
						originZipUrl: 'https://example.com/new.zip',
						zipFileName: 'new.zip',
						extractedFileName: 'new.dat',
						expectedSchema: { fields: ['field1'] },
					},
					features: {
						jwtAuth: true,
						canaryDeployment: true,
						advancedSearch: true,
						dataExport: true,
						externalSync: false,
					},
				},
				version: {
					version: '2024-01-02T00:00:00.000Z',
					hash: 'new-hash',
					timestamp: '2024-01-02T00:00:00.000Z',
				},
			};
			mockKV.set('config:current', JSON.stringify(currentConfig));

			// Rollback
			const rolledBack = await rollbackConfig(env, targetTimestamp);

			expect(rolledBack.version.version).toBe(targetTimestamp);
			expect(rolledBack.data.dataSource.originZipUrl).toBe('https://example.com/old.zip');

			// Verify current config was updated
			const current = mockKV.get('config:current');
			const parsed = JSON.parse(current!) as Config;
			expect(parsed.data.dataSource.originZipUrl).toBe('https://example.com/old.zip');
		});
	});
});
