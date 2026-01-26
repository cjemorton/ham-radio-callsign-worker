/**
 * User-facing API endpoints
 */

import type { Env, CallsignData } from '../types';
import { successResponse, errorResponse, getQueryParams, isValidCallsign, log } from '../utils';

/**
 * GET /api/v1/callsign/:callsign
 * Look up a specific callsign
 */
export async function getCallsign(
	_request: Request,
	env: Env,
	_ctx: ExecutionContext,
	params?: Record<string, string>
): Promise<Response> {
	const callsign = params?.callsign?.toUpperCase();

	if (!callsign) {
		return errorResponse('Bad Request', 'Callsign parameter is required', 400);
	}

	if (!isValidCallsign(callsign)) {
		return errorResponse('Bad Request', 'Invalid callsign format', 400);
	}

	// TODO: Query from D1 database when available
	// For now, return mock data
	log('info', 'Callsign lookup', { callsign });

	// Check if database is available
	if (!env.CALLSIGN_DB) {
		return errorResponse(
			'Service Unavailable',
			'Database is not configured. This is a placeholder response.',
			503,
			{
				note: 'The D1 database binding needs to be configured in wrangler.toml',
			}
		);
	}

	// Placeholder response - will be replaced with actual database query
	const mockData: CallsignData = {
		callsign: callsign,
		name: 'John Doe',
		license_class: 'Extra',
		state: 'CA',
		country: 'USA',
		grid_square: 'CM97',
	};

	return successResponse(mockData);
}

/**
 * GET /api/v1/search
 * Search for callsigns by various criteria
 */
export async function searchCallsigns(
	request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	const url = new URL(request.url);
	const params = getQueryParams(url);
	const query = params.q;

	if (!query || query.trim().length === 0) {
		return errorResponse('Bad Request', 'Search query parameter "q" is required', 400);
	}

	// TODO: Implement search logic with D1 database
	log('info', 'Search query', { query, params });

	if (!env.CALLSIGN_DB) {
		return errorResponse(
			'Service Unavailable',
			'Database is not configured. This is a placeholder response.',
			503,
			{
				note: 'The D1 database binding needs to be configured in wrangler.toml',
			}
		);
	}

	// Placeholder response
	const results: CallsignData[] = [
		{
			callsign: 'K1ABC',
			name: 'Alice Smith',
			license_class: 'General',
			state: 'MA',
		},
		{
			callsign: 'W2XYZ',
			name: 'Bob Johnson',
			license_class: 'Extra',
			state: 'NY',
		},
	];

	return successResponse({
		query,
		count: results.length,
		results,
	});
}

/**
 * GET /api/v1/export
 * Export database in various formats
 */
export async function exportDatabase(
	request: Request,
	env: Env,
	_ctx: ExecutionContext
): Promise<Response> {
	const url = new URL(request.url);
	const format = url.searchParams.get('format') || 'json';

	// Validate format
	if (!['json', 'csv'].includes(format)) {
		return errorResponse('Bad Request', 'Invalid format. Supported formats: json, csv', 400);
	}

	log('info', 'Database export requested', { format });

	// TODO: Implement actual export with R2 storage
	if (!env.DATA_EXPORTS) {
		return errorResponse(
			'Service Unavailable',
			'Export storage is not configured. This is a placeholder response.',
			503,
			{
				note: 'The R2 bucket binding needs to be configured in wrangler.toml',
			}
		);
	}

	// Placeholder response
	return successResponse({
		message: 'Export functionality will generate a downloadable file',
		format,
		status: 'pending',
		note: 'This is a placeholder. Full implementation requires R2 bucket configuration.',
	});
}
