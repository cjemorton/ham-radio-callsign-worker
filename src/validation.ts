/**
 * Configuration validation module
 * 
 * Provides comprehensive validation for configuration objects with detailed
 * error messages and actionable diagnostics.
 */

import type { ConfigData, Config } from './types';

export interface ValidationError {
	field: string;
	message: string;
	severity: 'error' | 'warning';
	suggestion?: string;
}

export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
	warnings: ValidationError[];
}

/**
 * Validate a complete configuration object
 */
export function validateConfig(config: Config): ValidationResult {
	return validateConfigData(config.data);
}

/**
 * Validate configuration data structure with detailed error reporting
 */
export function validateConfigData(data: ConfigData): ValidationResult {
	const errors: ValidationError[] = [];
	const warnings: ValidationError[] = [];

	// Validate data source
	if (!data.dataSource) {
		errors.push({
			field: 'dataSource',
			message: 'Missing dataSource configuration',
			severity: 'error',
			suggestion: 'Add a dataSource object with originZipUrl, zipFileName, extractedFileName, and expectedSchema',
		});
	} else {
		if (!data.dataSource.originZipUrl) {
			errors.push({
				field: 'dataSource.originZipUrl',
				message: 'Missing originZipUrl',
				severity: 'error',
				suggestion: 'Provide the URL to the FCC amateur radio database ZIP file (e.g., "https://data.fcc.gov/download/pub/uls/complete/l_amat.zip")',
			});
		} else if (typeof data.dataSource.originZipUrl !== 'string') {
			errors.push({
				field: 'dataSource.originZipUrl',
				message: 'originZipUrl must be a string',
				severity: 'error',
				suggestion: 'Ensure originZipUrl is a valid URL string',
			});
		} else if (!isValidUrl(data.dataSource.originZipUrl)) {
			errors.push({
				field: 'dataSource.originZipUrl',
				message: 'originZipUrl is not a valid URL',
				severity: 'error',
				suggestion: 'Provide a valid HTTP or HTTPS URL',
			});
		}

		if (!data.dataSource.zipFileName) {
			errors.push({
				field: 'dataSource.zipFileName',
				message: 'Missing zipFileName',
				severity: 'error',
				suggestion: 'Provide the name of the ZIP file (e.g., "l_amat.zip")',
			});
		} else if (typeof data.dataSource.zipFileName !== 'string') {
			errors.push({
				field: 'dataSource.zipFileName',
				message: 'zipFileName must be a string',
				severity: 'error',
			});
		}

		if (!data.dataSource.extractedFileName) {
			errors.push({
				field: 'dataSource.extractedFileName',
				message: 'Missing extractedFileName',
				severity: 'error',
				suggestion: 'Provide the name of the file to extract from the ZIP (e.g., "AM.dat")',
			});
		} else if (typeof data.dataSource.extractedFileName !== 'string') {
			errors.push({
				field: 'dataSource.extractedFileName',
				message: 'extractedFileName must be a string',
				severity: 'error',
			});
		}

		if (!data.dataSource.expectedSchema) {
			errors.push({
				field: 'dataSource.expectedSchema',
				message: 'Missing expectedSchema',
				severity: 'error',
				suggestion: 'Add expectedSchema with fields array, delimiter, and hasHeader properties',
			});
		} else {
			if (!Array.isArray(data.dataSource.expectedSchema.fields)) {
				errors.push({
					field: 'dataSource.expectedSchema.fields',
					message: 'expectedSchema.fields must be an array',
					severity: 'error',
					suggestion: 'Provide an array of field names (e.g., ["record_type", "callsign", ...])',
				});
			} else if (data.dataSource.expectedSchema.fields.length === 0) {
				errors.push({
					field: 'dataSource.expectedSchema.fields',
					message: 'expectedSchema.fields must not be empty',
					severity: 'error',
					suggestion: 'Add at least one field name to the array',
				});
			} else {
				// Check if all fields are strings
				data.dataSource.expectedSchema.fields.forEach((field, index) => {
					if (typeof field !== 'string') {
						errors.push({
							field: `dataSource.expectedSchema.fields[${index}]`,
							message: `Field at index ${index} must be a string`,
							severity: 'error',
						});
					}
				});
			}

			if (data.dataSource.expectedSchema.delimiter !== undefined && typeof data.dataSource.expectedSchema.delimiter !== 'string') {
				errors.push({
					field: 'dataSource.expectedSchema.delimiter',
					message: 'delimiter must be a string',
					severity: 'error',
					suggestion: 'Use a single character like "|" or ","',
				});
			}

			if (data.dataSource.expectedSchema.hasHeader !== undefined && typeof data.dataSource.expectedSchema.hasHeader !== 'boolean') {
				errors.push({
					field: 'dataSource.expectedSchema.hasHeader',
					message: 'hasHeader must be a boolean',
					severity: 'error',
				});
			}
		}
	}

	// Validate backup endpoints (optional but validate if present)
	if (data.backupEndpoints) {
		['primary', 'secondary', 'tertiary'].forEach((endpoint) => {
			const url = data.backupEndpoints?.[endpoint as keyof typeof data.backupEndpoints];
			if (url !== undefined) {
				if (typeof url !== 'string') {
					errors.push({
						field: `backupEndpoints.${endpoint}`,
						message: `${endpoint} backup endpoint must be a string`,
						severity: 'error',
					});
				} else if (!isValidUrl(url)) {
					errors.push({
						field: `backupEndpoints.${endpoint}`,
						message: `${endpoint} backup endpoint is not a valid URL`,
						severity: 'error',
						suggestion: 'Provide a valid HTTP or HTTPS URL',
					});
				}
			}
		});
	}

	// Validate external sync configuration
	if (data.externalSync) {
		if (data.externalSync.sql) {
			if (typeof data.externalSync.sql.enabled !== 'boolean') {
				errors.push({
					field: 'externalSync.sql.enabled',
					message: 'sql.enabled must be a boolean',
					severity: 'error',
				});
			}

			if (data.externalSync.sql.endpoints !== undefined) {
				if (!Array.isArray(data.externalSync.sql.endpoints)) {
					errors.push({
						field: 'externalSync.sql.endpoints',
						message: 'sql.endpoints must be an array',
						severity: 'error',
					});
				} else {
					data.externalSync.sql.endpoints.forEach((endpoint, index) => {
						if (!endpoint.id) {
							errors.push({
								field: `externalSync.sql.endpoints[${index}].id`,
								message: 'Endpoint id is required',
								severity: 'error',
							});
						}
						if (!endpoint.type) {
							errors.push({
								field: `externalSync.sql.endpoints[${index}].type`,
								message: 'Endpoint type is required',
								severity: 'error',
								suggestion: 'Use one of: postgresql, mysql, mariadb, sqlite, mssql',
							});
						} else if (!['postgresql', 'mysql', 'mariadb', 'sqlite', 'mssql'].includes(endpoint.type)) {
							errors.push({
								field: `externalSync.sql.endpoints[${index}].type`,
								message: `Invalid database type: ${endpoint.type}`,
								severity: 'error',
								suggestion: 'Use one of: postgresql, mysql, mariadb, sqlite, mssql',
							});
						}
						if (!endpoint.endpoint) {
							errors.push({
								field: `externalSync.sql.endpoints[${index}].endpoint`,
								message: 'Endpoint URL/connection string is required',
								severity: 'error',
							});
						}
						if (typeof endpoint.enabled !== 'boolean') {
							errors.push({
								field: `externalSync.sql.endpoints[${index}].enabled`,
								message: 'Endpoint enabled must be a boolean',
								severity: 'error',
							});
						}
					});
				}
			}
		}

		if (data.externalSync.redis) {
			if (typeof data.externalSync.redis.enabled !== 'boolean') {
				errors.push({
					field: 'externalSync.redis.enabled',
					message: 'redis.enabled must be a boolean',
					severity: 'error',
				});
			}

			if (data.externalSync.redis.endpoints !== undefined) {
				if (!Array.isArray(data.externalSync.redis.endpoints)) {
					errors.push({
						field: 'externalSync.redis.endpoints',
						message: 'redis.endpoints must be an array',
						severity: 'error',
					});
				} else {
					data.externalSync.redis.endpoints.forEach((endpoint, index) => {
						if (!endpoint.id) {
							errors.push({
								field: `externalSync.redis.endpoints[${index}].id`,
								message: 'Endpoint id is required',
								severity: 'error',
							});
						}
						if (!endpoint.endpoint) {
							errors.push({
								field: `externalSync.redis.endpoints[${index}].endpoint`,
								message: 'Endpoint URL is required',
								severity: 'error',
							});
						}
						if (typeof endpoint.enabled !== 'boolean') {
							errors.push({
								field: `externalSync.redis.endpoints[${index}].enabled`,
								message: 'Endpoint enabled must be a boolean',
								severity: 'error',
							});
						}
						if (endpoint.ttl !== undefined && (typeof endpoint.ttl !== 'number' || endpoint.ttl <= 0)) {
							warnings.push({
								field: `externalSync.redis.endpoints[${index}].ttl`,
								message: 'TTL should be a positive number',
								severity: 'warning',
								suggestion: 'Use a reasonable TTL value (e.g., 3600 for 1 hour)',
							});
						}
					});
				}
			}
		}
	}

	// Validate features
	if (!data.features) {
		errors.push({
			field: 'features',
			message: 'Missing features configuration',
			severity: 'error',
			suggestion: 'Add a features object with jwtAuth, canaryDeployment, advancedSearch, dataExport, and externalSync boolean flags',
		});
	} else {
		const requiredFeatures = ['jwtAuth', 'canaryDeployment', 'advancedSearch', 'dataExport', 'externalSync'];
		requiredFeatures.forEach((feature) => {
			const value = data.features[feature as keyof typeof data.features];
			if (typeof value !== 'boolean') {
				errors.push({
					field: `features.${feature}`,
					message: `${feature} must be a boolean`,
					severity: 'error',
					suggestion: 'Set to true or false',
				});
			}
		});
	}

	// Validate rate limits (optional but validate if present)
	if (data.rateLimits) {
		if (data.rateLimits.user) {
			if (typeof data.rateLimits.user.requestsPerMinute !== 'number' || data.rateLimits.user.requestsPerMinute <= 0) {
				errors.push({
					field: 'rateLimits.user.requestsPerMinute',
					message: 'requestsPerMinute must be a positive number',
					severity: 'error',
					suggestion: 'Set a reasonable limit like 100',
				});
			}
			if (data.rateLimits.user.burstSize !== undefined && (typeof data.rateLimits.user.burstSize !== 'number' || data.rateLimits.user.burstSize < 0)) {
				warnings.push({
					field: 'rateLimits.user.burstSize',
					message: 'burstSize should be a non-negative number',
					severity: 'warning',
					suggestion: 'Set to 0 to disable burst or use a value like 10',
				});
			}
		} else {
			warnings.push({
				field: 'rateLimits.user',
				message: 'User rate limits not configured',
				severity: 'warning',
				suggestion: 'Add user rate limits to prevent abuse',
			});
		}

		if (data.rateLimits.admin) {
			if (typeof data.rateLimits.admin.requestsPerMinute !== 'number' || data.rateLimits.admin.requestsPerMinute <= 0) {
				errors.push({
					field: 'rateLimits.admin.requestsPerMinute',
					message: 'requestsPerMinute must be a positive number',
					severity: 'error',
					suggestion: 'Set a reasonable limit like 1000',
				});
			}
		}
	} else {
		warnings.push({
			field: 'rateLimits',
			message: 'Rate limits not configured',
			severity: 'warning',
			suggestion: 'Add rate limits to prevent abuse',
		});
	}

	// Validate cache configuration (optional but validate if present)
	if (data.cache) {
		if (typeof data.cache.ttl !== 'number' || data.cache.ttl <= 0) {
			errors.push({
				field: 'cache.ttl',
				message: 'TTL must be a positive number',
				severity: 'error',
				suggestion: 'Set a reasonable TTL like 3600 (1 hour)',
			});
		}
		if (data.cache.maxEntries !== undefined && (typeof data.cache.maxEntries !== 'number' || data.cache.maxEntries <= 0)) {
			warnings.push({
				field: 'cache.maxEntries',
				message: 'maxEntries should be a positive number',
				severity: 'warning',
				suggestion: 'Set a reasonable limit like 10000',
			});
		}
	} else {
		warnings.push({
			field: 'cache',
			message: 'Cache configuration not set',
			severity: 'warning',
			suggestion: 'Add cache configuration for better performance',
		});
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
	};
}

/**
 * Validate a URL string
 */
function isValidUrl(urlString: string): boolean {
	try {
		const url = new URL(urlString);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

/**
 * Format validation result as a human-readable string
 */
export function formatValidationResult(result: ValidationResult): string {
	const lines: string[] = [];

	if (result.valid && result.warnings.length === 0) {
		lines.push('✓ Configuration is valid with no warnings');
		return lines.join('\n');
	}

	if (result.errors.length > 0) {
		lines.push(`✗ Configuration validation failed with ${result.errors.length} error(s):\n`);
		result.errors.forEach((error, index) => {
			lines.push(`${index + 1}. [${error.field}]`);
			lines.push(`   Error: ${error.message}`);
			if (error.suggestion) {
				lines.push(`   Suggestion: ${error.suggestion}`);
			}
			lines.push('');
		});
	}

	if (result.warnings.length > 0) {
		lines.push(`⚠ Found ${result.warnings.length} warning(s):\n`);
		result.warnings.forEach((warning, index) => {
			lines.push(`${index + 1}. [${warning.field}]`);
			lines.push(`   Warning: ${warning.message}`);
			if (warning.suggestion) {
				lines.push(`   Suggestion: ${warning.suggestion}`);
			}
			lines.push('');
		});
	}

	if (result.valid) {
		lines.push('✓ Configuration is valid (but has warnings)');
	}

	return lines.join('\n');
}

/**
 * Format validation result as JSON
 */
export function formatValidationResultJSON(result: ValidationResult): string {
	return JSON.stringify(result, null, 2);
}
