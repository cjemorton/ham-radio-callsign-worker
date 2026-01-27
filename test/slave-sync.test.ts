/**
 * Tests for the slave synchronization engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
	ConfigData,
	PatchOperation,
	SlaveEndpoint,
	RedisEndpoint,
} from '../src/types';
import { syncToSlaves, getSyncHealth } from '../src/engine/slave-sync';

describe('Slave Synchronization Engine', () => {
	let config: ConfigData;
	let operations: PatchOperation[];
	let mockEnv: any;

	beforeEach(() => {
		config = {
			dataSource: {
				originZipUrl: 'https://example.com/data.zip',
				zipFileName: 'data.zip',
				extractedFileName: 'data.txt',
				expectedSchema: {
					fields: ['callsign', 'name', 'class'],
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

		operations = [
			{
				type: 'insert',
				key: 'AA1AA',
				record: { callsign: 'AA1AA', name: 'John Doe', class: 'Extra' },
			},
			{
				type: 'update',
				key: 'BB2BB',
				record: { callsign: 'BB2BB', name: 'Jane Smith', class: 'General' },
			},
		];

		mockEnv = {
			METADATA_STORE: {
				get: async () => null,
				put: async () => {},
				delete: async () => {},
				list: async () => ({ keys: [] }),
			},
		};
	});

	describe('syncToSlaves', () => {
		it('should skip sync when externalSync feature is disabled', async () => {
			const result = await syncToSlaves(mockEnv, operations, config);

			expect(result.totalSlaves).toBe(0);
			expect(result.successCount).toBe(0);
			expect(result.failureCount).toBe(0);
			expect(result.results).toHaveLength(0);
		});

		it('should skip sync when no operations are provided', async () => {
			config.features.externalSync = true;
			const result = await syncToSlaves(mockEnv, [], config);

			expect(result.totalSlaves).toBe(0);
			expect(result.successCount).toBe(0);
			expect(result.results).toHaveLength(0);
		});

		it('should skip sync when no endpoints are configured', async () => {
			config.features.externalSync = true;
			config.externalSync = {
				sql: { enabled: true, endpoints: [] },
				redis: { enabled: true, endpoints: [] },
			};

			const result = await syncToSlaves(mockEnv, operations, config);

			expect(result.totalSlaves).toBe(0);
			expect(result.successCount).toBe(0);
			expect(result.results).toHaveLength(0);
		});

		it('should sync to SQL slave endpoints when configured', async () => {
			const sqlEndpoint: SlaveEndpoint = {
				id: 'sql-slave-1',
				type: 'postgresql',
				endpoint: 'postgres://localhost:5432/db',
				enabled: true,
				priority: 1,
			};

			config.features.externalSync = true;
			config.externalSync = {
				sql: { enabled: true, endpoints: [sqlEndpoint] },
				redis: { enabled: false, endpoints: [] },
			};

			const result = await syncToSlaves(mockEnv, operations, config);

			expect(result.totalSlaves).toBe(1);
			expect(result.successCount).toBe(1);
			expect(result.failureCount).toBe(0);
			expect(result.results).toHaveLength(1);
			expect(result.results[0].slaveId).toBe('sql-slave-1');
			expect(result.results[0].type).toBe('sql');
			expect(result.results[0].success).toBe(true);
		});

		it('should sync to Redis slave endpoints when configured', async () => {
			const redisEndpoint: RedisEndpoint = {
				id: 'redis-cache-1',
				endpoint: 'redis://localhost:6379',
				enabled: true,
				ttl: 3600,
			};

			config.features.externalSync = true;
			config.externalSync = {
				sql: { enabled: false, endpoints: [] },
				redis: { enabled: true, endpoints: [redisEndpoint] },
			};

			const result = await syncToSlaves(mockEnv, operations, config);

			expect(result.totalSlaves).toBe(1);
			expect(result.successCount).toBe(1);
			expect(result.failureCount).toBe(0);
			expect(result.results).toHaveLength(1);
			expect(result.results[0].slaveId).toBe('redis-cache-1');
			expect(result.results[0].type).toBe('redis');
			expect(result.results[0].success).toBe(true);
		});

		it('should sync to both SQL and Redis slaves when configured', async () => {
			const sqlEndpoint: SlaveEndpoint = {
				id: 'sql-slave-1',
				type: 'mysql',
				endpoint: 'mysql://localhost:3306/db',
				enabled: true,
			};

			const redisEndpoint: RedisEndpoint = {
				id: 'redis-cache-1',
				endpoint: 'redis://localhost:6379',
				enabled: true,
			};

			config.features.externalSync = true;
			config.externalSync = {
				sql: { enabled: true, endpoints: [sqlEndpoint] },
				redis: { enabled: true, endpoints: [redisEndpoint] },
			};

			const result = await syncToSlaves(mockEnv, operations, config);

			expect(result.totalSlaves).toBe(2);
			expect(result.successCount).toBe(2);
			expect(result.failureCount).toBe(0);
			expect(result.results).toHaveLength(2);
		});

		it('should skip disabled endpoints', async () => {
			const enabledEndpoint: SlaveEndpoint = {
				id: 'sql-enabled',
				type: 'postgresql',
				endpoint: 'postgres://localhost:5432/db',
				enabled: true,
			};

			const disabledEndpoint: SlaveEndpoint = {
				id: 'sql-disabled',
				type: 'postgresql',
				endpoint: 'postgres://localhost:5433/db',
				enabled: false,
			};

			config.features.externalSync = true;
			config.externalSync = {
				sql: { enabled: true, endpoints: [enabledEndpoint, disabledEndpoint] },
				redis: { enabled: false, endpoints: [] },
			};

			const result = await syncToSlaves(mockEnv, operations, config);

			expect(result.totalSlaves).toBe(1);
			expect(result.successCount).toBe(1);
			expect(result.results).toHaveLength(1);
			expect(result.results[0].slaveId).toBe('sql-enabled');
		});

		it('should sync to non-primary slaves with 0 operations when canary is disabled', async () => {
			const primaryEndpoint: SlaveEndpoint = {
				id: 'sql-primary',
				type: 'postgresql',
				endpoint: 'postgres://localhost:5432/db',
				enabled: true,
				priority: 1,
			};

			const secondaryEndpoint: SlaveEndpoint = {
				id: 'sql-secondary',
				type: 'postgresql',
				endpoint: 'postgres://localhost:5433/db',
				enabled: true,
				priority: 2,
			};

			config.features.externalSync = true;
			config.features.canaryDeployment = false;
			config.externalSync = {
				sql: { enabled: true, endpoints: [primaryEndpoint, secondaryEndpoint] },
				redis: { enabled: false, endpoints: [] },
			};

			const result = await syncToSlaves(mockEnv, operations, config);

			expect(result.totalSlaves).toBe(2);
			expect(result.successCount).toBe(2);
			// Primary should have applied operations, secondary should have 0
			const primaryResult = result.results.find((r) => r.slaveId === 'sql-primary');
			const secondaryResult = result.results.find((r) => r.slaveId === 'sql-secondary');

			expect(primaryResult?.appliedOperations).toBe(2);
			expect(secondaryResult?.appliedOperations).toBe(0);
		});

		it('should sync to all slaves when canary is enabled', async () => {
			const primaryEndpoint: SlaveEndpoint = {
				id: 'sql-primary',
				type: 'postgresql',
				endpoint: 'postgres://localhost:5432/db',
				enabled: true,
				priority: 1,
			};

			const secondaryEndpoint: SlaveEndpoint = {
				id: 'sql-secondary',
				type: 'postgresql',
				endpoint: 'postgres://localhost:5433/db',
				enabled: true,
				priority: 2,
			};

			config.features.externalSync = true;
			config.features.canaryDeployment = true;
			config.externalSync = {
				sql: { enabled: true, endpoints: [primaryEndpoint, secondaryEndpoint] },
				redis: { enabled: false, endpoints: [] },
			};

			const result = await syncToSlaves(mockEnv, operations, config);

			expect(result.totalSlaves).toBe(2);
			expect(result.successCount).toBe(2);
			// Both should have applied operations
			const primaryResult = result.results.find((r) => r.slaveId === 'sql-primary');
			const secondaryResult = result.results.find((r) => r.slaveId === 'sql-secondary');

			expect(primaryResult?.appliedOperations).toBe(2);
			expect(secondaryResult?.appliedOperations).toBe(2);
		});
	});

	describe('getSyncHealth', () => {
		it('should return empty array when METADATA_STORE is not available', async () => {
			const envWithoutKV = {};
			const health = await getSyncHealth(envWithoutKV as any);

			expect(health).toEqual([]);
		});

		it('should return empty array when no health data exists', async () => {
			const health = await getSyncHealth(mockEnv);

			expect(health).toEqual([]);
		});
	});
});
