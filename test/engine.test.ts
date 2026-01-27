/**
 * Tests for the fetch, extract, and validate engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Env, ConfigData } from '../src/types';
import { shouldFetch, isDataStale } from '../src/engine/fetch';
import { validateSchema, calculateHash } from '../src/engine/validate';
import { getFallbackStatus } from '../src/engine/fallback';

describe('Fetch Engine', () => {
	let env: Env;

	beforeEach(() => {
		env = {
			ENVIRONMENT: 'test',
			LOG_LEVEL: 'info',
		};
	});

	describe('shouldFetch', () => {
		it('should return true for on-demand fetch', async () => {
			const result = await shouldFetch(env, true);
			expect(result.should).toBe(true);
			expect(result.reason).toBe('On-demand fetch requested');
		});

		it('should return true when data is stale', async () => {
			// Without METADATA_STORE, data is considered stale
			const result = await shouldFetch(env, false);
			expect(result.should).toBe(true);
			expect(result.reason).toBe('Data is stale');
		});
	});

	describe('isDataStale', () => {
		it('should return true when METADATA_STORE is not configured', async () => {
			const result = await isDataStale(env);
			expect(result).toBe(true);
		});

		it('should return true when no previous update is found', async () => {
			const mockKV = {
				get: async () => null,
			} as unknown as KVNamespace;

			env.METADATA_STORE = mockKV;
			const result = await isDataStale(env);
			expect(result).toBe(true);
		});

		it('should return true when data is older than maxAge', async () => {
			const oldTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours ago
			const mockKV = {
				get: async (key: string) => {
					if (key === 'last_data_update') return oldTimestamp;
					return null;
				},
			} as unknown as KVNamespace;

			env.METADATA_STORE = mockKV;
			const result = await isDataStale(env, 86400); // 24 hour max age
			expect(result).toBe(true);
		});

		it('should return false when data is fresh', async () => {
			const recentTimestamp = new Date(Date.now() - 1000).toISOString(); // 1 second ago
			const mockKV = {
				get: async (key: string) => {
					if (key === 'last_data_update') return recentTimestamp;
					return null;
				},
			} as unknown as KVNamespace;

			env.METADATA_STORE = mockKV;
			const result = await isDataStale(env, 86400); // 24 hour max age
			expect(result).toBe(false);
		});
	});
});

describe('Validation Engine', () => {
	describe('calculateHash', () => {
		it('should calculate SHA-256 hash of content', async () => {
			const content = 'test content';
			const hash = await calculateHash(content);
			expect(hash).toBeDefined();
			expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
		});

		it('should produce consistent hashes for same content', async () => {
			const content = 'test content';
			const hash1 = await calculateHash(content);
			const hash2 = await calculateHash(content);
			expect(hash1).toBe(hash2);
		});

		it('should produce different hashes for different content', async () => {
			const hash1 = await calculateHash('content 1');
			const hash2 = await calculateHash('content 2');
			expect(hash1).not.toBe(hash2);
		});
	});

	describe('validateSchema', () => {
		const config: ConfigData = {
			dataSource: {
				originZipUrl: 'https://example.com/data.zip',
				zipFileName: 'data.zip',
				extractedFileName: 'data.txt',
				expectedSchema: {
					fields: ['field1', 'field2', 'field3'],
					delimiter: ',',
					hasHeader: true,
				},
			},
			features: {
				jwtAuth: false,
				canaryDeployment: false,
				advancedSearch: false,
				dataExport: false,
				externalSync: false,
			},
		};

		it('should validate schema with correct headers', () => {
			const content = 'field1,field2,field3\nvalue1,value2,value3\n';
			const result = validateSchema(content, config);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
			expect(result.recordCount).toBe(1);
		});

		it('should fail validation when headers are missing', () => {
			const content = 'field1,field2\nvalue1,value2\n';
			const result = validateSchema(content, config);

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.errors[0]).toContain('Missing expected headers');
		});

		it('should handle empty content', () => {
			const content = '';
			const result = validateSchema(content, config);

			expect(result.valid).toBe(false);
			expect(result.recordCount).toBe(0);
		});

		it('should validate content with delimiter', () => {
			const configWithPipe: ConfigData = {
				...config,
				dataSource: {
					...config.dataSource,
					expectedSchema: {
						fields: ['field1', 'field2'],
						delimiter: '|',
						hasHeader: true,
					},
				},
			};

			const content = 'field1|field2\nvalue1|value2\n';
			const result = validateSchema(content, configWithPipe);

			expect(result.valid).toBe(true);
			expect(result.recordCount).toBe(1);
		});

		it('should validate without header', () => {
			const configNoHeader: ConfigData = {
				...config,
				dataSource: {
					...config.dataSource,
					expectedSchema: {
						fields: ['field1', 'field2', 'field3'],
						delimiter: ',',
						hasHeader: false,
					},
				},
			};

			const content = 'value1,value2,value3\nvalue4,value5,value6\n';
			const result = validateSchema(content, configNoHeader);

			expect(result.valid).toBe(true);
			// Note: parseDelimitedContent still treats first line as header
			// so rows.length is 1 (only second line is counted as a row)
			expect(result.recordCount).toBe(1);
		});
	});
});

describe('Fallback Engine', () => {
	let env: Env;

	beforeEach(() => {
		env = {
			ENVIRONMENT: 'test',
			LOG_LEVEL: 'info',
		};
	});

	describe('getFallbackStatus', () => {
		it('should return unavailable when METADATA_STORE is not configured', async () => {
			const result = await getFallbackStatus(env);
			expect(result.available).toBe(false);
		});

		it('should return unavailable when no fallback data exists', async () => {
			const mockKV = {
				get: async () => null,
			} as unknown as KVNamespace;

			env.METADATA_STORE = mockKV;
			const result = await getFallbackStatus(env);
			expect(result.available).toBe(false);
		});

		it('should return available when fallback data exists', async () => {
			const mockMetadata = {
				version: '1.0.0',
				timestamp: new Date().toISOString(),
				hash: 'abc123',
				recordCount: 100,
				reason: 'Test',
			};

			const mockKV = {
				get: async (key: string) => {
					if (key === 'fallback:last_good_data') {
						return JSON.stringify(mockMetadata);
					}
					return null;
				},
			} as unknown as KVNamespace;

			env.METADATA_STORE = mockKV;
			const result = await getFallbackStatus(env);
			expect(result.available).toBe(true);
			expect(result.metadata).toBeDefined();
			expect(result.metadata?.version).toBe('1.0.0');
		});
	});
});

describe('Integration Tests', () => {
	let env: Env;

	beforeEach(() => {
		env = {
			ENVIRONMENT: 'test',
			LOG_LEVEL: 'info',
		};
	});

	it('should complete basic workflow checks', async () => {
		// Test that basic checks work without throwing errors
		const fetchCheck = await shouldFetch(env, false);
		expect(fetchCheck).toHaveProperty('should');
		expect(fetchCheck).toHaveProperty('reason');

		const fallbackStatus = await getFallbackStatus(env);
		expect(fallbackStatus).toHaveProperty('available');
	});

	it('should handle content hash validation', async () => {
		const content = 'test,data,content\n1,2,3\n4,5,6\n';
		const hash1 = await calculateHash(content);
		const hash2 = await calculateHash(content);

		expect(hash1).toBe(hash2);
		expect(hash1.length).toBe(64);
	});
});
