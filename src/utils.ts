/**
 * Utility functions for the Ham Radio Callsign Worker
 */

import type { ErrorResponse, SuccessResponse } from './types';

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse<T>(
	data: T,
	status = 200,
	headers: Record<string, string> = {}
): Response {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
			...headers,
		},
	});
}

/**
 * Create a success response
 */
export function successResponse<T>(data: T, status = 200): Response {
	const response: SuccessResponse<T> = {
		success: true,
		data,
		timestamp: new Date().toISOString(),
	};
	return jsonResponse(response, status);
}

/**
 * Create an error response
 */
export function errorResponse(
	error: string,
	message: string,
	status = 400,
	details?: unknown
): Response {
	const response: ErrorResponse = {
		error,
		message,
		timestamp: new Date().toISOString(),
	};
	if (details) {
		response.details = details;
	}
	return jsonResponse(response, status);
}

/**
 * Handle CORS preflight requests
 */
export function handleOptions(): Response {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
			'Access-Control-Max-Age': '86400',
		},
	});
}

/**
 * Extract API key from request headers
 */
export function extractApiKey(request: Request): string | null {
	// Check Authorization header (Bearer token)
	const authHeader = request.headers.get('Authorization');
	if (authHeader && authHeader.startsWith('Bearer ')) {
		return authHeader.substring(7);
	}

	// Check X-API-Key header
	const apiKeyHeader = request.headers.get('X-API-Key');
	if (apiKeyHeader) {
		return apiKeyHeader;
	}

	return null;
}

/**
 * Get client IP address from request
 */
export function getClientIp(request: Request): string {
	// Cloudflare adds the CF-Connecting-IP header
	return request.headers.get('CF-Connecting-IP') || 'unknown';
}

/**
 * Parse query parameters from URL
 */
export function getQueryParams(url: URL): Record<string, string> {
	const params: Record<string, string> = {};
	url.searchParams.forEach((value, key) => {
		params[key] = value;
	});
	return params;
}

/**
 * Validate callsign format (basic validation)
 */
export function isValidCallsign(callsign: string): boolean {
	// Basic regex for ham radio callsigns
	// Matches formats like: K1ABC, W2XYZ, N3MH, etc.
	const callsignRegex = /^[A-Z0-9]{1,3}[0-9][A-Z0-9]{0,3}[A-Z]$/i;
	return callsignRegex.test(callsign);
}

/**
 * Log message with timestamp and level
 */
export function log(level: string, message: string, details?: unknown): void {
	const timestamp = new Date().toISOString();
	const logEntry: Record<string, unknown> = {
		timestamp,
		level,
		message,
	};
	if (details) {
		logEntry.details = details;
	}
	// eslint-disable-next-line no-console
	console.log(JSON.stringify(logEntry));
}
