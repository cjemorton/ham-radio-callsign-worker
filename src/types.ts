/**
 * Type definitions for the Ham Radio Callsign Worker
 */

export interface Env {
	// KV Namespace bindings
	CALLSIGN_CACHE?: KVNamespace;
	METADATA_STORE?: KVNamespace;
	CONFIG_KV?: KVNamespace;

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

/**
 * Configuration data structure stored in KV
 */
export interface ConfigData {
	// Data source configuration
	dataSource: {
		originZipUrl: string;
		zipFileName: string;
		extractedFileName: string;
		expectedSchema: {
			fields: string[];
			delimiter?: string;
			hasHeader?: boolean;
		};
	};

	// Backup endpoints
	backupEndpoints?: {
		primary?: string;
		secondary?: string;
		tertiary?: string;
	};

	// External database synchronization
	externalSync?: {
		sql?: {
			enabled: boolean;
			connectionString?: string;
			tableName?: string;
		};
		redis?: {
			enabled: boolean;
			host?: string;
			port?: number;
			password?: string;
			database?: number;
		};
	};

	// Feature flags
	features: {
		jwtAuth: boolean;
		canaryDeployment: boolean;
		advancedSearch: boolean;
		dataExport: boolean;
		externalSync: boolean;
	};

	// Rate limiting configuration
	rateLimits?: {
		user: {
			requestsPerMinute: number;
			burstSize?: number;
		};
		admin: {
			requestsPerMinute: number;
			burstSize?: number;
		};
	};

	// Caching configuration
	cache?: {
		ttl: number;
		maxEntries?: number;
	};
}

/**
 * Configuration version metadata
 */
export interface ConfigVersion {
	version: string;
	hash: string;
	timestamp: string;
	updatedBy?: string;
	description?: string;
}

/**
 * Complete configuration object with versioning
 */
export interface Config {
	data: ConfigData;
	version: ConfigVersion;
}

/**
 * Configuration health status
 */
export interface ConfigHealth {
	status: 'healthy' | 'degraded' | 'unavailable';
	version: string;
	hash: string;
	lastUpdated: string;
	kvAvailable: boolean;
	validationErrors?: string[];
}
