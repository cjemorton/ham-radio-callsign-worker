/**
 * Configuration management module for Cloudflare KV
 * 
 * This module handles loading, refreshing, versioning, and rollback of configuration
 * stored in Cloudflare KV as a single namespaced JSON object.
 */

import type { Env, Config, ConfigData, ConfigVersion, ConfigHealth } from './types';
import { log } from './utils';
import { validateConfigData } from './validation';

// Configuration keys in KV
const CONFIG_KEY = 'config:current';
const CONFIG_HISTORY_PREFIX = 'config:history:';
const MAX_HISTORY_VERSIONS = 10;

/**
 * Calculate SHA-256 hash of configuration data
 */
async function calculateHash(data: ConfigData): Promise<string> {
	const encoder = new TextEncoder();
	const dataString = JSON.stringify(data);
	const dataBuffer = encoder.encode(dataString);
	const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}

/**
 * Validate configuration data structure
 * 
 * This is a legacy function that returns an array of error strings.
 * For new code, use validateConfigData from validation.ts which provides
 * more detailed error information with suggestions.
 */
function validateConfig(data: ConfigData): string[] {
	const result = validateConfigData(data);
	// Convert ValidationError[] to string[] for backward compatibility
	return result.errors.map(e => 
		e.suggestion 
			? `${e.message} (${e.suggestion})` 
			: e.message
	);
}

/**
 * Get default configuration
 */
function getDefaultConfig(): ConfigData {
	return {
		dataSource: {
			originZipUrl: 'https://data.fcc.gov/download/pub/uls/complete/l_amat.zip',
			zipFileName: 'l_amat.zip',
			extractedFileName: 'AM.dat',
			expectedSchema: {
				fields: [
					'record_type', 'unique_system_identifier', 'uls_file_number',
					'ebf_number', 'callsign', 'operator_class', 'group_code',
					'region_code', 'trustee_callsign', 'trustee_indicator',
					'physician_certification', 've_signature', 'systematic_callsign_change',
					'vanity_callsign_change', 'vanity_relationship', 'previous_callsign',
					'previous_operator_class', 'trustee_name'
				],
				delimiter: '|',
				hasHeader: false,
			},
		},
		backupEndpoints: {
			primary: 'https://data.fcc.gov/download/pub/uls/complete/l_amat.zip',
		},
		externalSync: {
			sql: {
				enabled: false,
				endpoints: [],
			},
			redis: {
				enabled: false,
				endpoints: [],
			},
		},
		features: {
			jwtAuth: false,
			canaryDeployment: false,
			advancedSearch: true,
			dataExport: true,
			externalSync: false,
		},
		rateLimits: {
			user: {
				requestsPerMinute: 100,
				burstSize: 10,
			},
			admin: {
				requestsPerMinute: 20,
				burstSize: 5,
			},
		},
		cache: {
			ttl: 3600,
			maxEntries: 10000,
		},
	};
}

/**
 * Load configuration from KV
 * Returns default config if not found or on error
 */
export async function loadConfig(env: Env): Promise<Config> {
	if (!env.CONFIG_KV) {
		log('warn', 'CONFIG_KV namespace not available, using default configuration');
		const defaultData = getDefaultConfig();
		return {
			data: defaultData,
			version: {
				version: '0.0.0',
				hash: await calculateHash(defaultData),
				timestamp: new Date().toISOString(),
				description: 'Default configuration (KV not available)',
			},
		};
	}

	try {
		// Try to load current config from KV
		const configJson = await env.CONFIG_KV.get(CONFIG_KEY);
		
		if (!configJson) {
			log('info', 'No configuration found in KV, using default configuration');
			const defaultData = getDefaultConfig();
			return {
				data: defaultData,
				version: {
					version: '0.0.0',
					hash: await calculateHash(defaultData),
					timestamp: new Date().toISOString(),
					description: 'Default configuration (not found in KV)',
				},
			};
		}

		const config = JSON.parse(configJson) as Config;
		
		// Validate the loaded configuration
		const errors = validateConfig(config.data);
		if (errors.length > 0) {
			log('error', 'Configuration validation failed', { errors });
			throw new Error(`Invalid configuration: ${errors.join(', ')}`);
		}

		log('info', 'Configuration loaded successfully', {
			version: config.version.version,
			hash: config.version.hash,
		});

		return config;
	} catch (error) {
		log('error', 'Failed to load configuration from KV, using default', { error });
		const defaultData = getDefaultConfig();
		return {
			data: defaultData,
			version: {
				version: '0.0.0',
				hash: await calculateHash(defaultData),
				timestamp: new Date().toISOString(),
				description: 'Default configuration (error loading from KV)',
			},
		};
	}
}

/**
 * Save configuration to KV with versioning
 */
export async function saveConfig(
	env: Env,
	data: ConfigData,
	updatedBy?: string,
	description?: string
): Promise<Config> {
	if (!env.CONFIG_KV) {
		throw new Error('CONFIG_KV namespace not available');
	}

	// Validate configuration
	const errors = validateConfig(data);
	if (errors.length > 0) {
		throw new Error(`Invalid configuration: ${errors.join(', ')}`);
	}

	// Calculate hash and create version
	const hash = await calculateHash(data);
	const version: ConfigVersion = {
		version: new Date().toISOString(),
		hash,
		timestamp: new Date().toISOString(),
		updatedBy,
		description,
	};

	const config: Config = {
		data,
		version,
	};

	// Save current config
	await env.CONFIG_KV.put(CONFIG_KEY, JSON.stringify(config));

	// Save to history
	const historyKey = `${CONFIG_HISTORY_PREFIX}${version.version}`;
	await env.CONFIG_KV.put(historyKey, JSON.stringify(config));

	// Clean up old history versions
	await cleanupOldVersions(env);

	log('info', 'Configuration saved successfully', {
		version: version.version,
		hash,
		updatedBy,
	});

	return config;
}

/**
 * Clean up old configuration versions, keeping only MAX_HISTORY_VERSIONS
 */
async function cleanupOldVersions(env: Env): Promise<void> {
	if (!env.CONFIG_KV) {
		return;
	}

	try {
		// List all history keys
		const list = await env.CONFIG_KV.list({ prefix: CONFIG_HISTORY_PREFIX });
		
		if (list.keys.length > MAX_HISTORY_VERSIONS) {
			// Sort by name (which includes timestamp) and keep only the newest
			const sortedKeys = list.keys
				.sort((a, b) => b.name.localeCompare(a.name))
				.slice(MAX_HISTORY_VERSIONS);

			// Delete old versions
			for (const key of sortedKeys) {
				await env.CONFIG_KV.delete(key.name);
			}

			log('info', 'Cleaned up old configuration versions', {
				deleted: sortedKeys.length,
			});
		}
	} catch (error) {
		log('error', 'Failed to clean up old configuration versions', { error });
	}
}

/**
 * Refresh configuration from KV
 * This is useful when config has been updated externally
 */
export async function refreshConfig(env: Env): Promise<Config> {
	log('info', 'Refreshing configuration from KV');
	return loadConfig(env);
}

/**
 * Get configuration version information
 */
export async function getConfigVersion(env: Env): Promise<ConfigVersion | null> {
	if (!env.CONFIG_KV) {
		return null;
	}

	try {
		const configJson = await env.CONFIG_KV.get(CONFIG_KEY);
		if (!configJson) {
			return null;
		}

		const config = JSON.parse(configJson) as Config;
		return config.version;
	} catch (error) {
		log('error', 'Failed to get configuration version', { error });
		return null;
	}
}

/**
 * List available configuration versions from history
 */
export async function listConfigVersions(env: Env): Promise<ConfigVersion[]> {
	if (!env.CONFIG_KV) {
		return [];
	}

	try {
		const list = await env.CONFIG_KV.list({ prefix: CONFIG_HISTORY_PREFIX });
		const versions: ConfigVersion[] = [];

		for (const key of list.keys) {
			const configJson = await env.CONFIG_KV.get(key.name);
			if (configJson) {
				const config = JSON.parse(configJson) as Config;
				versions.push(config.version);
			}
		}

		// Sort by timestamp, newest first
		versions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

		return versions;
	} catch (error) {
		log('error', 'Failed to list configuration versions', { error });
		return [];
	}
}

/**
 * Rollback configuration to a specific version
 */
export async function rollbackConfig(env: Env, targetVersion: string): Promise<Config> {
	if (!env.CONFIG_KV) {
		throw new Error('CONFIG_KV namespace not available');
	}

	try {
		// Load the target version from history
		const historyKey = `${CONFIG_HISTORY_PREFIX}${targetVersion}`;
		const configJson = await env.CONFIG_KV.get(historyKey);

		if (!configJson) {
			throw new Error(`Configuration version ${targetVersion} not found in history`);
		}

		const targetConfig = JSON.parse(configJson) as Config;

		// Validate the configuration
		const errors = validateConfig(targetConfig.data);
		if (errors.length > 0) {
			throw new Error(`Invalid configuration in history: ${errors.join(', ')}`);
		}

		// Save as current config
		await env.CONFIG_KV.put(CONFIG_KEY, configJson);

		log('info', 'Configuration rolled back successfully', {
			targetVersion,
			hash: targetConfig.version.hash,
		});

		return targetConfig;
	} catch (error) {
		log('error', 'Failed to rollback configuration', { error, targetVersion });
		throw error;
	}
}

/**
 * Get configuration health status
 */
export async function getConfigHealth(env: Env): Promise<ConfigHealth> {
	const kvAvailable = !!env.CONFIG_KV;

	if (!kvAvailable) {
		return {
			status: 'degraded',
			version: '0.0.0',
			hash: '',
			lastUpdated: new Date().toISOString(),
			kvAvailable: false,
			validationErrors: ['CONFIG_KV namespace not available'],
		};
	}

	try {
		const config = await loadConfig(env);
		const errors = validateConfig(config.data);

		return {
			status: errors.length > 0 ? 'degraded' : 'healthy',
			version: config.version.version,
			hash: config.version.hash,
			lastUpdated: config.version.timestamp,
			kvAvailable: true,
			validationErrors: errors.length > 0 ? errors : undefined,
		};
	} catch (error) {
		log('error', 'Failed to get configuration health', { error });
		return {
			status: 'unavailable',
			version: 'unknown',
			hash: '',
			lastUpdated: new Date().toISOString(),
			kvAvailable: true,
			validationErrors: [(error as Error).message],
		};
	}
}
