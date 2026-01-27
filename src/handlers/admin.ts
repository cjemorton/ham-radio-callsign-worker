/**
 * Admin API endpoints (authentication required)
 */

import type { Env } from '../types';
import { successResponse, errorResponse, log, HASH_DISPLAY_LENGTH } from '../utils';
import { executeDataPipeline } from '../engine';
import {
	rollbackToSnapshot,
	getLatestSnapshot,
	getDatabaseRecordCount,
} from '../engine/database';
import {
	getLogStatistics,
	deleteExpiredLogs,
	archiveOldLogs,
	getExpiredLogFiles,
} from '../engine/log-rotation';

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
					hash: result.data.hash.substring(0, HASH_DISPLAY_LENGTH) + '...',
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

	if (!env.CALLSIGN_DB) {
		return errorResponse(
			'Service Unavailable',
			'Database is not configured.',
			503
		);
	}

	try {
		log('info', 'Executing rollback', { targetVersion });

		const result = await rollbackToSnapshot(env, targetVersion);

		if (!result.success) {
			return errorResponse(
				'Rollback Failed',
				result.error || 'Failed to rollback database',
				500,
				{
					timestamp: result.timestamp,
				}
			);
		}

		return successResponse({
			message: 'Database rollback completed successfully',
			rolledBackTo: result.rolledBackTo,
			recordsRestored: result.recordsRestored,
			timestamp: result.timestamp,
		});
	} catch (error) {
		log('error', 'Rollback failed with exception', {
			error: error instanceof Error ? error.message : String(error),
		});
		return errorResponse(
			'Internal Server Error',
			'An unexpected error occurred during rollback',
			500,
			{
				error: error instanceof Error ? error.message : String(error),
			}
		);
	}
}

/**
 * GET /admin/logs
 * View system logs (legacy endpoint - redirects to /admin/logs/events)
 */
export async function getLogs(
	request: Request,
	env: Env,
	ctx: ExecutionContext
): Promise<Response> {
	// Redirect to the new event logs endpoint
	return getEventLogs(request, env, ctx);
}

/**
 * GET /admin/logs/events
 * View event logs from R2 storage
 */
export async function getEventLogs(
	request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	const url = new URL(request.url);
	const limit = parseInt(url.searchParams.get('limit') || '100', 10);
	const date = url.searchParams.get('date'); // Format: YYYY-MM-DD
	const level = url.searchParams.get('level'); // Filter by log level
	const type = url.searchParams.get('type'); // Filter by event type

	log('info', 'Event logs requested', { limit, date, level, type });

	if (!env.DATA_EXPORTS) {
		return errorResponse(
			'Service Unavailable',
			'R2 bucket is not configured.',
			503
		);
	}

	try {
		// Determine which log file to read
		const logFileName = date
			? `logs-${date}.jsonl`
			: `logs-${new Date().toISOString().split('T')[0]}.jsonl`;
		const logPath = `events/${logFileName}`;

		// Read log file from R2
		const logFile = await env.DATA_EXPORTS.get(logPath);
		if (!logFile) {
			return successResponse({
				count: 0,
				limit,
				date: date || new Date().toISOString().split('T')[0],
				logs: [],
				message: `No log file found for ${logFileName}`,
			});
		}

		// Parse JSONL content
		const content = await logFile.text();
		const lines = content.split('\n').filter((line) => line.trim());
		let logs = lines.map((line) => JSON.parse(line));

		// Apply filters
		if (level) {
			logs = logs.filter((log) => log.details?.level === level);
		}
		if (type) {
			logs = logs.filter((log) => log.type === type);
		}

		// Sort by timestamp descending (most recent first)
		logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

		// Apply limit
		const limitedLogs = logs.slice(0, Math.min(limit, 1000));

		return successResponse({
			count: limitedLogs.length,
			total: logs.length,
			limit,
			date: date || new Date().toISOString().split('T')[0],
			logs: limitedLogs,
			metadata: {
				logFile: logFileName,
				size: content.length,
				lastModified: logFile.uploaded?.toISOString(),
			},
		});
	} catch (error) {
		log('error', 'Failed to retrieve event logs', {
			error: error instanceof Error ? error.message : String(error),
		});
		return errorResponse(
			'Internal Server Error',
			'Failed to retrieve event logs from R2',
			500,
			{
				error: error instanceof Error ? error.message : String(error),
			}
		);
	}
}

/**
 * GET /admin/logs/files
 * List available log files in R2
 */
export async function getLogFiles(
	request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	log('info', 'Log files list requested');

	if (!env.DATA_EXPORTS) {
		return errorResponse(
			'Service Unavailable',
			'R2 bucket is not configured.',
			503
		);
	}

	try {
		const url = new URL(request.url);
		const limit = parseInt(url.searchParams.get('limit') || '100', 10);

		// List log files from R2
		const listed = await env.DATA_EXPORTS.list({
			prefix: 'events/',
			limit: Math.min(limit, 1000),
		});

		const logFiles = listed.objects.map((obj) => ({
			name: obj.key.replace('events/', ''),
			path: obj.key,
			size: obj.size,
			uploaded: obj.uploaded?.toISOString(),
			etag: obj.etag,
		}));

		// Sort by date descending
		logFiles.sort((a, b) => {
			const dateA = a.uploaded ? new Date(a.uploaded).getTime() : 0;
			const dateB = b.uploaded ? new Date(b.uploaded).getTime() : 0;
			return dateB - dateA;
		});

		return successResponse({
			count: logFiles.length,
			truncated: listed.truncated,
			files: logFiles,
		});
	} catch (error) {
		log('error', 'Failed to list log files', {
			error: error instanceof Error ? error.message : String(error),
		});
		return errorResponse(
			'Internal Server Error',
			'Failed to list log files from R2',
			500,
			{
				error: error instanceof Error ? error.message : String(error),
			}
		);
	}
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

	if (!env.METADATA_STORE) {
		return errorResponse(
			'Service Unavailable',
			'Metadata store is not configured.',
			503
		);
	}

	try {
		// Get latest snapshot info
		const snapshot = env.CALLSIGN_DB ? await getLatestSnapshot(env) : null;
		const recordCount = env.CALLSIGN_DB
			? await getDatabaseRecordCount(env)
			: 0;

		return successResponse({
			database: {
				version: snapshot?.version || 'unknown',
				recordCount,
				lastUpdated: snapshot?.timestamp || 'unknown',
				hash: snapshot?.hash
					? snapshot.hash.substring(0, HASH_DISPLAY_LENGTH) + '...'
					: 'unknown',
			},
			snapshot: snapshot
				? {
					version: snapshot.version,
					timestamp: snapshot.timestamp,
					recordCount: snapshot.recordCount,
					available: true,
				}
				: { available: false },
		});
	} catch (error) {
		log('error', 'Failed to get metadata', {
			error: error instanceof Error ? error.message : String(error),
		});
		return errorResponse(
			'Internal Server Error',
			'Failed to retrieve metadata',
			500,
			{
				error: error instanceof Error ? error.message : String(error),
			}
		);
	}
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
					hash: result.data.hash.substring(0, HASH_DISPLAY_LENGTH) + '...',
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

/**
 * GET /admin/diffs
 * View diff history
 */
export async function getDiffHistory(
	request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	log('info', 'Diff history requested');

	if (!env.DATA_EXPORTS) {
		return errorResponse(
			'Service Unavailable',
			'R2 bucket is not configured.',
			503
		);
	}

	try {
		const url = new URL(request.url);
		const limit = parseInt(url.searchParams.get('limit') || '10', 10);

		// List diff reports from R2
		const listed = await env.DATA_EXPORTS.list({
			prefix: 'diffs/',
			limit: Math.min(limit, 100),
		});

		const diffs = await Promise.all(
			listed.objects.map(async (obj) => {
				const diffObject = await env.DATA_EXPORTS!.get(obj.key);
				if (!diffObject) return null;

				const diffData = await diffObject.text();
				return JSON.parse(diffData);
			})
		);

		const validDiffs = diffs.filter((d) => d !== null);

		return successResponse({
			count: validDiffs.length,
			limit,
			diffs: validDiffs,
		});
	} catch (error) {
		log('error', 'Failed to get diff history', {
			error: error instanceof Error ? error.message : String(error),
		});
		return errorResponse(
			'Internal Server Error',
			'Failed to retrieve diff history',
			500,
			{
				error: error instanceof Error ? error.message : String(error),
			}
		);
	}
}

/**
 * GET /admin/status
 * System status and health monitoring
 */
export async function getStatus(
	_request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	log('info', 'System status requested');

	try {
		// Check service availability
		const status: {
			status: 'healthy' | 'degraded' | 'unavailable';
			timestamp: string;
			services: Record<string, boolean | string>;
			database?: {
				available: boolean;
				version?: string;
				recordCount?: number;
				lastUpdated?: string;
			};
			storage?: {
				r2Available: boolean;
				kvAvailable: boolean;
			};
			logs?: {
				eventsLogged: boolean;
				lastLogFile?: string;
			};
		} = {
			status: 'healthy',
			timestamp: new Date().toISOString(),
			services: {},
			storage: {
				r2Available: !!env.DATA_EXPORTS,
				kvAvailable: !!(env.METADATA_STORE || env.CONFIG_KV || env.CALLSIGN_CACHE),
			},
		};

		// Check D1 database
		if (env.CALLSIGN_DB) {
			try {
				const snapshot = await getLatestSnapshot(env);
				const recordCount = await getDatabaseRecordCount(env);
				status.database = {
					available: true,
					version: snapshot?.version || 'unknown',
					recordCount,
					lastUpdated: snapshot?.timestamp || 'unknown',
				};
				status.services.database = true;
			} catch (error) {
				status.database = { available: false };
				status.services.database = `Error: ${error instanceof Error ? error.message : String(error)}`;
				status.status = 'degraded';
			}
		} else {
			status.database = { available: false };
			status.services.database = false;
		}

		// Check if logging is operational
		if (env.DATA_EXPORTS) {
			try {
				const logFileName = `logs-${new Date().toISOString().split('T')[0]}.jsonl`;
				const logPath = `events/${logFileName}`;
				const logFile = await env.DATA_EXPORTS.get(logPath);
				status.logs = {
					eventsLogged: !!logFile,
					lastLogFile: logFile ? logFileName : undefined,
				};
			} catch (error) {
				status.logs = { eventsLogged: false };
			}
		}

		return successResponse(status);
	} catch (error) {
		log('error', 'Failed to get system status', {
			error: error instanceof Error ? error.message : String(error),
		});
		return errorResponse(
			'Internal Server Error',
			'Failed to retrieve system status',
			500,
			{
				error: error instanceof Error ? error.message : String(error),
			}
		);
	}
}

/**
 * GET /admin/logs/stats
 * Get log file statistics
 */
export async function getLogStats(
	_request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	log('info', 'Log statistics requested');

	if (!env.DATA_EXPORTS) {
		return errorResponse(
			'Service Unavailable',
			'R2 bucket is not configured.',
			503
		);
	}

	try {
		const stats = await getLogStatistics(env);
		return successResponse(stats);
	} catch (error) {
		log('error', 'Failed to get log statistics', {
			error: error instanceof Error ? error.message : String(error),
		});
		return errorResponse(
			'Internal Server Error',
			'Failed to retrieve log statistics',
			500,
			{
				error: error instanceof Error ? error.message : String(error),
			}
		);
	}
}

/**
 * POST /admin/logs/rotate
 * Manually trigger log rotation and cleanup
 */
export async function rotateAndCleanupLogs(
	request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	log('info', 'Log rotation triggered');

	if (!env.DATA_EXPORTS) {
		return errorResponse(
			'Service Unavailable',
			'R2 bucket is not configured.',
			503
		);
	}

	try {
		// Parse request body for configuration
		let retentionDays = 30;
		let archiveDays = 7;
		let performArchive = false;

		try {
			const contentType = request.headers.get('Content-Type');
			if (contentType?.includes('application/json')) {
				const body = (await request.json()) as {
					retentionDays?: number;
					archiveDays?: number;
					performArchive?: boolean;
				};
				retentionDays = body.retentionDays || retentionDays;
				archiveDays = body.archiveDays || archiveDays;
				performArchive = body.performArchive || false;
			}
		} catch (error) {
			// Ignore JSON parse errors, use defaults
		}

		// Get expired files first
		const expiredFiles = await getExpiredLogFiles(env, { retentionDays });

		// Perform archive if requested
		let archiveResult: { archived: number; errors: string[] } = { archived: 0, errors: [] };
		if (performArchive) {
			archiveResult = await archiveOldLogs(env, archiveDays);
		}

		// Delete expired logs
		const deleteResult = await deleteExpiredLogs(env, { retentionDays });

		return successResponse({
			message: 'Log rotation completed',
			retentionDays,
			expiredFilesFound: expiredFiles.length,
			deleted: deleteResult.deleted,
			archived: archiveResult.archived,
			errors: [...deleteResult.errors, ...archiveResult.errors],
		});
	} catch (error) {
		log('error', 'Failed to rotate logs', {
			error: error instanceof Error ? error.message : String(error),
		});
		return errorResponse(
			'Internal Server Error',
			'Failed to rotate logs',
			500,
			{
				error: error instanceof Error ? error.message : String(error),
			}
		);
	}
}
