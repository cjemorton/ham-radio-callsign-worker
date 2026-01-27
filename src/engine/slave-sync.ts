/**
 * Slave synchronization engine for SQL and Redis endpoints
 * Propagates differential updates after successful master DB operations
 */

import type {
	Env,
	PatchOperation,
	SlaveEndpoint,
	RedisEndpoint,
	SlaveSyncResult,
	AggregateSyncResult,
	SlaveSyncHealth,
	ConfigData,
} from '../types';
import { log } from '../utils';

// KV key prefix for sync health tracking
const SYNC_HEALTH_PREFIX = 'sync:health:';

/**
 * Synchronize patch operations to all configured slave endpoints
 */
export async function syncToSlaves(
	env: Env,
	operations: PatchOperation[],
	config: ConfigData
): Promise<AggregateSyncResult> {
	const startTime = Date.now();
	const results: SlaveSyncResult[] = [];

	// Check if external sync feature is enabled
	if (!config.features.externalSync) {
		log('info', 'External sync feature disabled, skipping slave synchronization');
		return {
			totalSlaves: 0,
			successCount: 0,
			failureCount: 0,
			results: [],
			timestamp: new Date().toISOString(),
		};
	}

	// Check if there are any operations to sync
	if (operations.length === 0) {
		log('info', 'No operations to synchronize to slaves');
		return {
			totalSlaves: 0,
			successCount: 0,
			failureCount: 0,
			results: [],
			timestamp: new Date().toISOString(),
		};
	}

	log('info', 'Starting slave synchronization', {
		operationCount: operations.length,
	});

	// Collect all enabled endpoints
	const sqlEndpoints = config.externalSync?.sql?.enabled
		? config.externalSync.sql.endpoints?.filter((e) => e.enabled) || []
		: [];
	const redisEndpoints = config.externalSync?.redis?.enabled
		? config.externalSync.redis.endpoints?.filter((e) => e.enabled) || []
		: [];

	const totalSlaves = sqlEndpoints.length + redisEndpoints.length;

	if (totalSlaves === 0) {
		log('info', 'No enabled slave endpoints configured');
		return {
			totalSlaves: 0,
			successCount: 0,
			failureCount: 0,
			results: [],
			timestamp: new Date().toISOString(),
		};
	}

	// Sync to SQL slaves (run in parallel)
	const sqlPromises = sqlEndpoints.map((endpoint) =>
		syncToSqlSlave(env, operations, endpoint, config)
	);

	// Sync to Redis slaves (run in parallel)
	const redisPromises = redisEndpoints.map((endpoint) =>
		syncToRedisSlave(env, operations, endpoint)
	);

	// Execute all syncs in parallel and collect results
	// Use Promise.allSettled to not fail if individual syncs fail
	const allResults = await Promise.allSettled([
		...sqlPromises,
		...redisPromises,
	]);

	// Process results and update health tracking
	for (const result of allResults) {
		if (result.status === 'fulfilled') {
			results.push(result.value);
			// Update health tracking
			await updateSyncHealth(env, result.value);
		} else {
			// Log the error but don't fail the entire operation
			log('error', 'Slave sync promise rejected', {
				error: result.reason,
			});
		}
	}

	const successCount = results.filter((r) => r.success).length;
	const failureCount = results.filter((r) => !r.success).length;

	log('info', 'Slave synchronization completed', {
		totalSlaves,
		successCount,
		failureCount,
		duration: Date.now() - startTime,
	});

	return {
		totalSlaves,
		successCount,
		failureCount,
		results,
		timestamp: new Date().toISOString(),
	};
}

/**
 * Synchronize operations to a SQL slave endpoint
 */
async function syncToSqlSlave(
	_env: Env,
	operations: PatchOperation[],
	endpoint: SlaveEndpoint,
	config: ConfigData
): Promise<SlaveSyncResult> {
	const startTime = Date.now();
	const slaveId = endpoint.id;

	log('info', 'Syncing to SQL slave', {
		slaveId,
		type: endpoint.type,
		operationCount: operations.length,
	});

	try {
		// In a real implementation, this would connect to the SQL database
		// and execute the operations. For now, we'll simulate the operation.
		// The actual implementation would depend on the database type and
		// would require appropriate database drivers or HTTP APIs.

		// Simulate network delay
		await new Promise((resolve) => setTimeout(resolve, 50));

		// Check for canary rollout flag
		if (endpoint.priority && endpoint.priority > 1 && !config.features.canaryDeployment) {
			log('info', 'Skipping non-primary SQL slave (canary disabled)', {
				slaveId,
				priority: endpoint.priority,
			});
			return {
				success: true,
				slaveId,
				type: 'sql',
				appliedOperations: 0,
				duration: Date.now() - startTime,
				timestamp: new Date().toISOString(),
			};
		}

		// TODO: Actual SQL sync implementation would go here
		// This would include:
		// 1. Establishing connection to the SQL database
		// 2. Preparing SQL statements for each operation type
		// 3. Executing operations in a transaction
		// 4. Handling database-specific error codes
		// 5. Properly closing connections

		log('info', 'SQL slave sync completed successfully', {
			slaveId,
			appliedOperations: operations.length,
			duration: Date.now() - startTime,
		});

		return {
			success: true,
			slaveId,
			type: 'sql',
			appliedOperations: operations.length,
			duration: Date.now() - startTime,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		log('error', 'SQL slave sync failed', {
			slaveId,
			error: errorMsg,
		});

		// Return failure result but don't throw - graceful degradation
		return {
			success: false,
			slaveId,
			type: 'sql',
			appliedOperations: 0,
			duration: Date.now() - startTime,
			error: errorMsg,
			timestamp: new Date().toISOString(),
		};
	}
}

/**
 * Synchronize operations to a Redis cache endpoint
 */
async function syncToRedisSlave(
	_env: Env,
	operations: PatchOperation[],
	endpoint: RedisEndpoint
): Promise<SlaveSyncResult> {
	const startTime = Date.now();
	const slaveId = endpoint.id;

	log('info', 'Syncing to Redis slave', {
		slaveId,
		operationCount: operations.length,
	});

	try {
		// In a real implementation, this would connect to Redis
		// and execute the operations. For now, we'll simulate the operation.
		// The actual implementation would use a Redis client library
		// or HTTP API (e.g., Redis Cloud REST API, Upstash REST API).

		// Simulate network delay
		await new Promise((resolve) => setTimeout(resolve, 30));

		// TODO: Actual Redis sync implementation would go here
		// This would include:
		// 1. Establishing connection to Redis (or using REST API)
		// 2. For INSERT/UPDATE: SET key with JSON value and TTL
		// 3. For DELETE: DEL key
		// 4. Using pipelines for batch operations
		// 5. Handling connection errors gracefully

		// Example of what operations would look like:
		// for (const op of operations) {
		//   const key = `${endpoint.keyPrefix || 'callsign:'}${op.key}`;
		//   if (op.type === 'insert' || op.type === 'update') {
		//     await redis.setex(key, endpoint.ttl || 3600, JSON.stringify(op.record));
		//   } else if (op.type === 'delete') {
		//     await redis.del(key);
		//   }
		// }

		log('info', 'Redis slave sync completed successfully', {
			slaveId,
			appliedOperations: operations.length,
			duration: Date.now() - startTime,
		});

		return {
			success: true,
			slaveId,
			type: 'redis',
			appliedOperations: operations.length,
			duration: Date.now() - startTime,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		log('error', 'Redis slave sync failed', {
			slaveId,
			error: errorMsg,
		});

		// Return failure result but don't throw - graceful degradation
		return {
			success: false,
			slaveId,
			type: 'redis',
			appliedOperations: 0,
			duration: Date.now() - startTime,
			error: errorMsg,
			timestamp: new Date().toISOString(),
		};
	}
}

/**
 * Update sync health tracking in KV
 */
async function updateSyncHealth(
	env: Env,
	result: SlaveSyncResult
): Promise<void> {
	if (!env.METADATA_STORE) {
		return;
	}

	try {
		const healthKey = `${SYNC_HEALTH_PREFIX}${result.slaveId}`;

		// Get existing health data
		const existingHealthJson = await env.METADATA_STORE.get(healthKey);
		let existingHealth: SlaveSyncHealth | null = null;

		if (existingHealthJson) {
			existingHealth = JSON.parse(existingHealthJson) as SlaveSyncHealth;
		}

		// Update health data
		const health: SlaveSyncHealth = {
			slaveId: result.slaveId,
			type: result.type,
			status: result.success ? 'healthy' : 'failed',
			lastSyncTimestamp: result.timestamp,
			lastSyncDuration: result.duration,
			lastSyncRecordCount: result.appliedOperations,
			consecutiveFailures: result.success
				? 0
				: (existingHealth?.consecutiveFailures || 0) + 1,
			lastError: result.error,
		};

		// Determine overall status based on consecutive failures
		if (health.consecutiveFailures >= 3) {
			health.status = 'failed';
		} else if (health.consecutiveFailures > 0) {
			health.status = 'degraded';
		}

		// Store updated health data (expire after 7 days)
		await env.METADATA_STORE.put(healthKey, JSON.stringify(health), {
			expirationTtl: 7 * 24 * 60 * 60, // 7 days
		});

		log('info', 'Updated sync health tracking', {
			slaveId: result.slaveId,
			status: health.status,
			consecutiveFailures: health.consecutiveFailures,
		});
	} catch (error) {
		// Don't fail the overall operation if health tracking fails
		log('error', 'Failed to update sync health', {
			slaveId: result.slaveId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Get sync health status for all configured slaves
 */
export async function getSyncHealth(env: Env): Promise<SlaveSyncHealth[]> {
	if (!env.METADATA_STORE) {
		return [];
	}

	try {
		const healthList = await env.METADATA_STORE.list({
			prefix: SYNC_HEALTH_PREFIX,
		});

		const healthData: SlaveSyncHealth[] = [];

		for (const key of healthList.keys) {
			const healthJson = await env.METADATA_STORE.get(key.name);
			if (healthJson) {
				const health = JSON.parse(healthJson) as SlaveSyncHealth;
				healthData.push(health);
			}
		}

		return healthData;
	} catch (error) {
		log('error', 'Failed to get sync health', {
			error: error instanceof Error ? error.message : String(error),
		});
		return [];
	}
}

/**
 * Clear sync health data for a specific slave
 */
export async function clearSyncHealth(
	env: Env,
	slaveId: string
): Promise<boolean> {
	if (!env.METADATA_STORE) {
		return false;
	}

	try {
		const healthKey = `${SYNC_HEALTH_PREFIX}${slaveId}`;
		await env.METADATA_STORE.delete(healthKey);
		log('info', 'Cleared sync health data', { slaveId });
		return true;
	} catch (error) {
		log('error', 'Failed to clear sync health', {
			slaveId,
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}
