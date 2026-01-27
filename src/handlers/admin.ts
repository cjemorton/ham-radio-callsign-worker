/**
 * Admin API endpoints (authentication required)
 */

import type { Env, LogEntry } from '../types';
import { successResponse, errorResponse, log } from '../utils';
import { executeDataPipeline } from '../engine';

/**
 * POST /admin/update
 * Force a database update from source
 */
export async function forceUpdate(
	_request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	log('info', 'Force update requested');

	try {
		// Execute the data pipeline with on-demand flag
		const result = await executeDataPipeline(env, {
			onDemand: true,
			skipValidation: false,
		});

		if (!result.success) {
			return errorResponse(
				'Update Failed',
				'Failed to update database from source',
				500,
				{
					errors: result.metadata.errors,
					warnings: result.metadata.warnings,
				}
			);
		}

		return successResponse({
			message: 'Database update completed successfully',
			status: result.status,
			metadata: result.metadata,
			data: result.data
				? {
						version: result.data.version,
						recordCount: result.data.recordCount,
						hash: result.data.hash.substring(0, 16) + '...',
				  }
				: undefined,
		});
	} catch (error) {
		log('error', 'Force update failed', {
			error: error instanceof Error ? error.message : String(error),
		});
		return errorResponse(
			'Internal Server Error',
			'An unexpected error occurred during update',
			500,
			{
				error: error instanceof Error ? error.message : String(error),
			}
		);
	}
}

/**
 * POST /admin/rebuild
 * Full database rebuild
 */
export async function rebuildDatabase(
	_request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	log('info', 'Database rebuild requested');

	// TODO: Implement database rebuild logic
	if (!env.CALLSIGN_DB) {
		return errorResponse(
			'Service Unavailable',
			'Database is not configured.',
			503
		);
	}

	// Placeholder response
	return successResponse({
		message: 'Database rebuild initiated',
		status: 'pending',
		timestamp: new Date().toISOString(),
		note: 'This is a placeholder. Full implementation requires database rebuild logic.',
	});
}

/**
 * POST /admin/rollback
 * Rollback database to previous version
 */
export async function rollbackDatabase(
	request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	log('info', 'Database rollback requested');

	// Parse request body for version info if needed
	let targetVersion: string | undefined;
	try {
		const contentType = request.headers.get('Content-Type');
		if (contentType?.includes('application/json')) {
			const body = await request.json() as { version?: string };
			targetVersion = body.version;
		}
	} catch (error) {
		// Ignore JSON parse errors, proceed with default rollback
	}

	// TODO: Implement database rollback logic
	if (!env.CALLSIGN_DB) {
		return errorResponse(
			'Service Unavailable',
			'Database is not configured.',
			503
		);
	}

	// Placeholder response
	return successResponse({
		message: 'Database rollback initiated',
		targetVersion: targetVersion || 'previous',
		status: 'pending',
		timestamp: new Date().toISOString(),
		note: 'This is a placeholder. Full implementation requires database versioning logic.',
	});
}

/**
 * GET /admin/logs
 * View system logs
 */
export async function getLogs(
	request: Request,
	_env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	const url = new URL(request.url);
	const limit = parseInt(url.searchParams.get('limit') || '100', 10);
	const level = url.searchParams.get('level');

	log('info', 'Logs requested', { limit, level });

	// TODO: Implement actual log retrieval from KV or other storage
	// For now, return mock data
	const mockLogs: LogEntry[] = [
		{
			timestamp: new Date().toISOString(),
			level: 'info',
			message: 'Service started',
			details: { version: '0.1.0' },
		},
		{
			timestamp: new Date(Date.now() - 60000).toISOString(),
			level: 'info',
			message: 'Health check passed',
		},
		{
			timestamp: new Date(Date.now() - 120000).toISOString(),
			level: 'warn',
			message: 'Rate limit warning',
			details: { clientIp: '192.168.1.1' },
		},
	];

	const filteredLogs = level
		? mockLogs.filter((log) => log.level === level)
		: mockLogs;

	return successResponse({
		count: filteredLogs.length,
		limit,
		logs: filteredLogs.slice(0, limit),
		note: 'This is placeholder data. Full implementation requires log storage.',
	});
}

/**
 * GET /admin/metadata
 * View database metadata
 */
export async function getMetadata(
	_request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	log('info', 'Metadata requested');

	// TODO: Implement actual metadata retrieval
	if (!env.METADATA_STORE) {
		return errorResponse(
			'Service Unavailable',
			'Metadata store is not configured.',
			503
		);
	}

	// Placeholder response
	return successResponse({
		database: {
			version: '1.0.0',
			recordCount: 1000000,
			lastUpdated: new Date(Date.now() - 86400000).toISOString(),
			size: '250MB',
		},
		cache: {
			hitRate: 0.85,
			entryCount: 50000,
		},
		note: 'This is placeholder data. Full implementation requires metadata storage.',
	});
}

/**
 * GET /admin/stats
 * View system statistics
 */
export async function getStats(
	_request: Request,
	_env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	log('info', 'Stats requested');

	// TODO: Implement actual statistics gathering
	const stats = {
		requests: {
			total: 150000,
			last24h: 5000,
			avgResponseTime: 45,
		},
		endpoints: {
			'/api/v1/callsign': 120000,
			'/api/v1/search': 25000,
			'/api/v1/export': 500,
			'/health': 4500,
		},
		rateLimit: {
			blocked: 250,
			allowed: 149750,
		},
		uptime: '15d 6h 32m',
		note: 'This is placeholder data. Full implementation requires analytics storage.',
	};

	return successResponse(stats);
}

/**
 * POST /admin/fetch
 * Trigger on-demand fetch, extraction, and validation
 */
export async function triggerFetch(
	request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	log('info', 'On-demand fetch triggered');

	try {
		// Parse optional parameters
		let skipValidation = false;
		let stagingMode = false;

		try {
			const contentType = request.headers.get('Content-Type');
			if (contentType?.includes('application/json')) {
				const body = (await request.json()) as {
					skipValidation?: boolean;
					stagingMode?: boolean;
				};
				skipValidation = body.skipValidation || false;
				stagingMode = body.stagingMode || false;
			}
		} catch (error) {
			// Ignore JSON parse errors, use defaults
		}

		// Execute the data pipeline with on-demand flag
		const result = await executeDataPipeline(env, {
			onDemand: true,
			skipValidation,
			stagingMode,
		});

		if (!result.success) {
			return errorResponse(
				'Fetch Failed',
				'Failed to complete fetch-extract-validate workflow',
				500,
				{
					status: result.status,
					errors: result.metadata.errors,
					warnings: result.metadata.warnings,
					duration: result.metadata.duration,
				}
			);
		}

		return successResponse({
			message: 'Fetch-extract-validate workflow completed successfully',
			status: result.status,
			metadata: {
				timestamp: result.metadata.timestamp,
				duration: result.metadata.duration,
				fetchTriggered: result.metadata.fetchTriggered,
				validationPassed: result.metadata.validationPassed,
				fallbackUsed: result.metadata.fallbackUsed,
				warnings: result.metadata.warnings,
			},
			data: result.data
				? {
						version: result.data.version,
						recordCount: result.data.recordCount,
						hash: result.data.hash.substring(0, 16) + '...',
				  }
				: undefined,
		});
	} catch (error) {
		log('error', 'Fetch trigger failed', {
			error: error instanceof Error ? error.message : String(error),
		});
		return errorResponse(
			'Internal Server Error',
			'An unexpected error occurred during fetch',
			500,
			{
				error: error instanceof Error ? error.message : String(error),
			}
		);
	}
}
