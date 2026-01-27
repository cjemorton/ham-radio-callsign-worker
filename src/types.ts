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

/**
 * Fetch engine result
 */
export interface FetchResult {
	success: boolean;
	data?: ArrayBuffer;
	error?: string;
	metadata: {
		url: string;
		timestamp: string;
		size?: number;
		duration: number;
	};
}

/**
 * Extraction result
 */
export interface ExtractionResult {
	success: boolean;
	content?: string;
	error?: string;
	metadata: {
		fileName: string;
		timestamp: string;
		size?: number;
		encoding?: string;
	};
}

/**
 * Validation result
 */
export interface ValidationResult {
	success: boolean;
	errors: string[];
	warnings: string[];
	metadata: {
		timestamp: string;
		hashMatch?: boolean;
		schemaMatch?: boolean;
		headerMatch?: boolean;
		recordCount?: number;
	};
}

/**
 * Data processing event for R2 logging
 */
export interface DataProcessingEvent {
	eventId: string;
	timestamp: string;
	type: 'fetch' | 'extract' | 'validate' | 'fallback' | 'error';
	status: 'success' | 'failure' | 'warning';
	details: {
		message: string;
		duration?: number;
		dataSize?: number;
		recordCount?: number;
		diff?: {
			added: number;
			modified: number;
			deleted: number;
		};
		error?: string;
		stackTrace?: string;
		metadata?: Record<string, unknown>;
	};
}

/**
 * Fallback data metadata
 */
export interface FallbackMetadata {
	version: string;
	timestamp: string;
	hash: string;
	recordCount: number;
	reason: string;
}

/**
 * Data diff result
 */
export interface DiffResult {
	hasChanges: boolean;
	added: string[];
	modified: string[];
	deleted: string[];
	unchanged: number;
	summary: {
		addedCount: number;
		modifiedCount: number;
		deletedCount: number;
		unchangedCount: number;
		totalOldRecords: number;
		totalNewRecords: number;
	};
	metadata: {
		oldVersion?: string;
		newVersion: string;
		oldHash?: string;
		newHash: string;
		timestamp: string;
	};
}

/**
 * Database patch operation
 */
export interface PatchOperation {
	type: 'insert' | 'update' | 'delete';
	record: Record<string, string | undefined>;
	key: string;
}

/**
 * Database version snapshot
 */
export interface DatabaseSnapshot {
	version: string;
	timestamp: string;
	recordCount: number;
	hash: string;
	dataPath: string;
}

/**
 * Rollback result
 */
export interface RollbackResult {
	success: boolean;
	rolledBackTo?: string;
	recordsRestored?: number;
	error?: string;
	timestamp: string;
}
