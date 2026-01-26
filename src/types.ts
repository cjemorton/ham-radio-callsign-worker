/**
 * Type definitions for the Ham Radio Callsign Worker
 */

export interface Env {
	// KV Namespace bindings
	CALLSIGN_CACHE?: KVNamespace;
	METADATA_STORE?: KVNamespace;

	// D1 Database binding
	CALLSIGN_DB?: D1Database;

	// R2 Bucket binding
	DATA_EXPORTS?: R2Bucket;

	// Environment variables
	ENVIRONMENT?: string;
	LOG_LEVEL?: string;

	// Admin API key (set via wrangler secret put ADMIN_API_KEY)
	ADMIN_API_KEY?: string;
}

export interface RouteHandler {
	(request: Request, env: Env, ctx: ExecutionContext, params?: Record<string, string>): Promise<Response>;
}

export interface Route {
	method: string;
	pattern: RegExp;
	handler: RouteHandler;
	paramNames?: string[];
}

export interface CallsignData {
	callsign: string;
	name?: string;
	license_class?: string;
	address?: string;
	city?: string;
	state?: string;
	zip?: string;
	country?: string;
	grid_square?: string;
	expiration_date?: string;
	[key: string]: string | undefined;
}

export interface ErrorResponse {
	error: string;
	message: string;
	details?: unknown;
	timestamp: string;
}

export interface SuccessResponse<T = unknown> {
	success: boolean;
	data: T;
	timestamp: string;
}

export interface RateLimitInfo {
	limit: number;
	remaining: number;
	reset: number;
}

export interface LogEntry {
	timestamp: string;
	level: string;
	message: string;
	details?: unknown;
}
