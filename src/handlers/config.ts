/**
 * Configuration API endpoints
 */

import type { Env } from '../types';
import { successResponse, errorResponse, log } from '../utils';
import {
	loadConfig,
	refreshConfig,
	getConfigVersion,
	getConfigHealth,
	listConfigVersions,
	rollbackConfig,
	saveConfig,
} from '../config';

/**
 * GET /api/v1/config/health
 * Public endpoint to check configuration health
 */
export async function getHealth(
	_request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	try {
		const health = await getConfigHealth(env);
		const status = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
		return successResponse(health, status);
	} catch (error) {
		log('error', 'Failed to get config health', { error });
		return errorResponse(
			'Internal Server Error',
			'Failed to retrieve configuration health status',
			500,
			{ error: (error as Error).message }
		);
	}
}

/**
 * GET /api/v1/config/version
 * Public endpoint to get current configuration version
 */
export async function getVersion(
	_request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	try {
		const version = await getConfigVersion(env);
		
		if (!version) {
			return errorResponse(
				'Not Found',
				'Configuration version information not available',
				404
			);
		}

		return successResponse({
			version: version.version,
			hash: version.hash,
			timestamp: version.timestamp,
			description: version.description,
		});
	} catch (error) {
		log('error', 'Failed to get config version', { error });
		return errorResponse(
			'Internal Server Error',
			'Failed to retrieve configuration version',
			500,
			{ error: (error as Error).message }
		);
	}
}

/**
 * POST /admin/config/refresh
 * Admin endpoint to force reload configuration from KV
 */
export async function refresh(
	_request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	try {
		log('info', 'Configuration refresh requested');
		const config = await refreshConfig(env);
		
		return successResponse({
			message: 'Configuration refreshed successfully',
			version: config.version.version,
			hash: config.version.hash,
			timestamp: config.version.timestamp,
		});
	} catch (error) {
		log('error', 'Failed to refresh config', { error });
		return errorResponse(
			'Internal Server Error',
			'Failed to refresh configuration',
			500,
			{ error: (error as Error).message }
		);
	}
}

/**
 * POST /admin/config/update
 * Admin endpoint to update configuration
 */
export async function updateConfig(
	request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	try {
		// Parse request body
		const contentType = request.headers.get('Content-Type');
		if (!contentType?.includes('application/json')) {
			return errorResponse(
				'Bad Request',
				'Content-Type must be application/json',
				400
			);
		}

		const body = await request.json() as {
			data?: unknown;
			description?: string;
			updatedBy?: string;
		};

		if (!body.data) {
			return errorResponse(
				'Bad Request',
				'Request body must include "data" field with configuration',
				400
			);
		}

		log('info', 'Configuration update requested', {
			updatedBy: body.updatedBy,
			description: body.description,
		});

		const config = await saveConfig(
			env,
			body.data as ConfigData,
			body.updatedBy,
			body.description
		);

		return successResponse({
			message: 'Configuration updated successfully',
			version: config.version.version,
			hash: config.version.hash,
			timestamp: config.version.timestamp,
		});
	} catch (error) {
		log('error', 'Failed to update config', { error });
		return errorResponse(
			'Bad Request',
			'Failed to update configuration',
			400,
			{ error: (error as Error).message }
		);
	}
}

/**
 * GET /admin/config/versions
 * Admin endpoint to list all available configuration versions
 */
export async function getVersions(
	_request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	try {
		const versions = await listConfigVersions(env);
		
		return successResponse({
			count: versions.length,
			versions,
		});
	} catch (error) {
		log('error', 'Failed to list config versions', { error });
		return errorResponse(
			'Internal Server Error',
			'Failed to list configuration versions',
			500,
			{ error: (error as Error).message }
		);
	}
}

/**
 * POST /admin/config/rollback
 * Admin endpoint to rollback configuration to a previous version
 */
export async function rollback(
	request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	try {
		// Parse request body
		const contentType = request.headers.get('Content-Type');
		if (!contentType?.includes('application/json')) {
			return errorResponse(
				'Bad Request',
				'Content-Type must be application/json',
				400
			);
		}

		const body = await request.json() as { version?: string };

		if (!body.version) {
			return errorResponse(
				'Bad Request',
				'Request body must include "version" field',
				400
			);
		}

		log('info', 'Configuration rollback requested', {
			targetVersion: body.version,
		});

		const config = await rollbackConfig(env, body.version);

		return successResponse({
			message: 'Configuration rolled back successfully',
			version: config.version.version,
			hash: config.version.hash,
			timestamp: config.version.timestamp,
		});
	} catch (error) {
		log('error', 'Failed to rollback config', { error });
		return errorResponse(
			'Bad Request',
			'Failed to rollback configuration',
			400,
			{ error: (error as Error).message }
		);
	}
}

/**
 * GET /admin/config/current
 * Admin endpoint to get the full current configuration
 */
export async function getCurrent(
	_request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	try {
		const config = await loadConfig(env);
		
		return successResponse({
			data: config.data,
			version: config.version,
		});
	} catch (error) {
		log('error', 'Failed to get current config', { error });
		return errorResponse(
			'Internal Server Error',
			'Failed to retrieve current configuration',
			500,
			{ error: (error as Error).message }
		);
	}
}
