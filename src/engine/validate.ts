/**
 * Validation engine for data integrity and schema validation
 */

import type { Env, ValidationResult, ConfigData } from '../types';
import { log, HASH_DISPLAY_LENGTH } from '../utils';
import { logValidationEvent } from './logger';

/**
 * Calculate SHA-256 hash of content
 */
export async function calculateHash(content: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(content);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}

/**
 * Validate hash integrity
 */
export async function validateHashIntegrity(
	content: string,
	expectedHash?: string
): Promise<{ valid: boolean; actualHash: string; expectedHash?: string }> {
	const actualHash = await calculateHash(content);

	if (!expectedHash) {
		// No expected hash provided, just return calculated hash
		return { valid: true, actualHash };
	}

	const valid = actualHash === expectedHash;

	log('info', 'Hash integrity check', {
		valid,
		actualHash: actualHash.substring(0, HASH_DISPLAY_LENGTH) + '...',
		expectedHash: expectedHash.substring(0, HASH_DISPLAY_LENGTH) + '...',
	});

	return { valid, actualHash, expectedHash };
}

/**
 * Parse CSV/delimited file content
 */
function parseDelimitedContent(
	content: string,
	delimiter: string = ','
): { headers: string[]; rows: string[][] } {
	const lines = content.split('\n').filter((line) => line.trim().length > 0);

	if (lines.length === 0) {
		return { headers: [], rows: [] };
	}

	// Parse headers
	const headers = lines[0].split(delimiter).map((h) => h.trim());

	// Parse rows
	const rows = lines.slice(1).map((line) => {
		return line.split(delimiter).map((cell) => cell.trim());
	});

	return { headers, rows };
}

/**
 * Validate header/schema match
 */
export function validateSchema(
	content: string,
	config: ConfigData
): {
	valid: boolean;
	errors: string[];
	actualHeaders?: string[];
	expectedHeaders: string[];
	recordCount: number;
} {
	const errors: string[] = [];
	const expectedSchema = config.dataSource.expectedSchema;
	const delimiter = expectedSchema.delimiter || ',';
	const hasHeader = expectedSchema.hasHeader !== false; // Default to true

	try {
		const { headers, rows } = parseDelimitedContent(content, delimiter);

		if (hasHeader) {
			// Validate headers match expected fields
			const expectedHeaders = expectedSchema.fields;
			const actualHeaders = headers;

			// Check if all expected headers are present
			const missingHeaders = expectedHeaders.filter(
				(expected) => !actualHeaders.includes(expected)
			);

			if (missingHeaders.length > 0) {
				errors.push(`Missing expected headers: ${missingHeaders.join(', ')}`);
			}

			// Check for extra headers (warning, not error)
			const extraHeaders = actualHeaders.filter(
				(actual) => !expectedHeaders.includes(actual)
			);

			if (extraHeaders.length > 0) {
				log('warn', 'Extra headers found in data', { extraHeaders });
			}

			return {
				valid: errors.length === 0,
				errors,
				actualHeaders,
				expectedHeaders,
				recordCount: rows.length,
			};
		} else {
			// No header row, validate column count
			const expectedColumnCount = expectedSchema.fields.length;
			const invalidRows = rows.filter(
				(row) => row.length !== expectedColumnCount
			);

			if (invalidRows.length > 0) {
				errors.push(
					`${invalidRows.length} rows have incorrect column count (expected ${expectedColumnCount})`
				);
			}

			return {
				valid: errors.length === 0,
				errors,
				expectedHeaders: expectedSchema.fields,
				recordCount: rows.length,
			};
		}
	} catch (error) {
		errors.push(`Schema validation error: ${error instanceof Error ? error.message : String(error)}`);
		return {
			valid: false,
			errors,
			expectedHeaders: expectedSchema.fields,
			recordCount: 0,
		};
	}
}

/**
 * Perform comprehensive validation
 */
export async function validateData(
	env: Env,
	content: string,
	config: ConfigData,
	expectedHash?: string
): Promise<ValidationResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	const warnings: string[] = [];

	log('info', 'Starting data validation', {
		contentSize: content.length,
		hasExpectedHash: !!expectedHash,
	});

	try {
		// 1. Validate hash integrity
		const hashResult = await validateHashIntegrity(content, expectedHash);
		const hashMatch = hashResult.valid;

		if (!hashMatch) {
			errors.push(
				`Hash mismatch: expected ${hashResult.expectedHash}, got ${hashResult.actualHash}`
			);
		}

		// 2. Validate schema
		const schemaResult = validateSchema(content, config);
		const schemaMatch = schemaResult.valid;

		if (!schemaMatch) {
			errors.push(...schemaResult.errors);
		}

		// 3. Additional validations
		if (schemaResult.recordCount === 0) {
			warnings.push('No data records found in file');
		}

		const duration = Date.now() - startTime;
		const success = errors.length === 0;

		const result: ValidationResult = {
			success,
			errors,
			warnings,
			metadata: {
				timestamp: new Date().toISOString(),
				hashMatch,
				schemaMatch,
				headerMatch: schemaMatch,
				recordCount: schemaResult.recordCount,
			},
		};

		log('info', 'Data validation completed', {
			success,
			errors: errors.length,
			warnings: warnings.length,
			duration,
		});

		await logValidationEvent(env, success ? 'success' : 'failure', {
			message: success ? 'Data validation passed' : 'Data validation failed',
			duration,
			recordCount: schemaResult.recordCount,
			metadata: {
				hashMatch,
				schemaMatch,
				errors,
				warnings,
			},
		});

		return result;
	} catch (error) {
		const duration = Date.now() - startTime;
		const errorMessage = error instanceof Error ? error.message : String(error);

		errors.push(`Validation error: ${errorMessage}`);

		const result: ValidationResult = {
			success: false,
			errors,
			warnings,
			metadata: {
				timestamp: new Date().toISOString(),
			},
		};

		log('error', 'Data validation failed with exception', {
			error: errorMessage,
			duration,
		});

		await logValidationEvent(env, 'failure', {
			message: 'Validation failed with exception',
			duration,
			error: errorMessage,
		});

		return result;
	}
}

/**
 * Store validation result metadata
 */
export async function storeValidationMetadata(
	env: Env,
	result: ValidationResult,
	version: string
): Promise<void> {
	if (!env.METADATA_STORE) {
		log('warn', 'Metadata store not configured, cannot store validation metadata');
		return;
	}

	try {
		const metadata = {
			version,
			timestamp: result.metadata.timestamp,
			success: result.success,
			errors: result.errors,
			warnings: result.warnings,
			hashMatch: result.metadata.hashMatch,
			schemaMatch: result.metadata.schemaMatch,
			recordCount: result.metadata.recordCount,
		};

		await env.METADATA_STORE.put(
			`validation:${version}`,
			JSON.stringify(metadata),
			{
				expirationTtl: 2592000, // 30 days
			}
		);

		log('info', 'Stored validation metadata', { version });
	} catch (error) {
		log('error', 'Failed to store validation metadata', {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
