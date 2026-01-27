/**
 * Fallback logic for handling validation failures
 */

import type { Env, FallbackMetadata, ValidationResult } from '../types';
import { log } from '../utils';
import { logFallbackEvent } from './logger';

/**
 * Store current data as fallback
 */
export async function storeLastGoodData(
	env: Env,
	content: string,
	metadata: FallbackMetadata
): Promise<boolean> {
	if (!env.METADATA_STORE || !env.DATA_EXPORTS) {
		log('warn', 'Required storage not configured for fallback data');
		return false;
	}

	try {
		// Store the actual data in R2
		const dataPath = `fallback/last-good-data-${metadata.version}.txt`;
		await env.DATA_EXPORTS.put(dataPath, content, {
			httpMetadata: {
				contentType: 'text/plain',
			},
			customMetadata: {
				version: metadata.version,
				timestamp: metadata.timestamp,
				hash: metadata.hash,
				recordCount: String(metadata.recordCount),
			},
		});

		// Store metadata reference in KV for quick access
		await env.METADATA_STORE.put(
			'fallback:last_good_data',
			JSON.stringify(metadata),
			{
				expirationTtl: 7776000, // 90 days
			}
		);

		log('info', 'Stored last good data for fallback', {
			version: metadata.version,
			recordCount: metadata.recordCount,
		});

		await logFallbackEvent(env, 'success', {
			message: 'Last good data stored successfully',
			recordCount: metadata.recordCount,
			metadata: { version: metadata.version },
		});

		return true;
	} catch (error) {
		log('error', 'Failed to store last good data', {
			error: error instanceof Error ? error.message : String(error),
		});

		await logFallbackEvent(env, 'failure', {
			message: 'Failed to store last good data',
			error: error instanceof Error ? error.message : String(error),
		});

		return false;
	}
}

/**
 * Retrieve last good data
 */
export async function retrieveLastGoodData(
	env: Env
): Promise<{ content: string; metadata: FallbackMetadata } | null> {
	if (!env.METADATA_STORE || !env.DATA_EXPORTS) {
		log('warn', 'Required storage not configured for fallback retrieval');
		return null;
	}

	try {
		// Get metadata from KV
		const metadataJson = await env.METADATA_STORE.get('fallback:last_good_data');
		if (!metadataJson) {
			log('info', 'No last good data found');
			return null;
		}

		const metadata = JSON.parse(metadataJson) as FallbackMetadata;

		// Get actual data from R2
		const dataPath = `fallback/last-good-data-${metadata.version}.txt`;
		const dataObject = await env.DATA_EXPORTS.get(dataPath);

		if (!dataObject) {
			log('error', 'Fallback metadata exists but data file not found', {
				version: metadata.version,
				dataPath,
			});
			return null;
		}

		const content = await dataObject.text();

		log('info', 'Retrieved last good data', {
			version: metadata.version,
			recordCount: metadata.recordCount,
		});

		return { content, metadata };
	} catch (error) {
		log('error', 'Failed to retrieve last good data', {
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

/**
 * Handle validation failure with fallback
 */
export async function handleValidationFailure(
	env: Env,
	validationResult: ValidationResult,
	newDataVersion: string
): Promise<{
	useFallback: boolean;
	fallbackContent?: string;
	fallbackMetadata?: FallbackMetadata;
	reason: string;
}> {
	log('warn', 'Handling validation failure', {
		errors: validationResult.errors,
		version: newDataVersion,
	});

	await logFallbackEvent(env, 'warning', {
		message: 'Validation failed, attempting fallback',
		metadata: {
			version: newDataVersion,
			errors: validationResult.errors,
		},
	});

	// Try to retrieve last good data
	const fallbackData = await retrieveLastGoodData(env);

	if (!fallbackData) {
		log('error', 'No fallback data available', { version: newDataVersion });

		await logFallbackEvent(env, 'failure', {
			message: 'No fallback data available',
			metadata: { version: newDataVersion },
		});

		return {
			useFallback: false,
			reason: 'No fallback data available',
		};
	}

	log('info', 'Using fallback data', {
		fallbackVersion: fallbackData.metadata.version,
		newVersion: newDataVersion,
	});

	await logFallbackEvent(env, 'success', {
		message: 'Successfully fell back to last good data',
		metadata: {
			newVersion: newDataVersion,
			fallbackVersion: fallbackData.metadata.version,
			fallbackTimestamp: fallbackData.metadata.timestamp,
		},
	});

	return {
		useFallback: true,
		fallbackContent: fallbackData.content,
		fallbackMetadata: fallbackData.metadata,
		reason: `Using fallback data from ${fallbackData.metadata.version}`,
	};
}

/**
 * Check if fallback is needed based on validation result
 */
export function shouldUseFallback(validationResult: ValidationResult): boolean {
	// Use fallback if validation failed
	return !validationResult.success;
}

/**
 * Get fallback status
 */
export async function getFallbackStatus(env: Env): Promise<{
	available: boolean;
	metadata?: FallbackMetadata;
}> {
	if (!env.METADATA_STORE) {
		return { available: false };
	}

	try {
		const metadataJson = await env.METADATA_STORE.get('fallback:last_good_data');
		if (!metadataJson) {
			return { available: false };
		}

		const metadata = JSON.parse(metadataJson) as FallbackMetadata;
		return { available: true, metadata };
	} catch (error) {
		log('error', 'Failed to check fallback status', {
			error: error instanceof Error ? error.message : String(error),
		});
		return { available: false };
	}
}

/**
 * Clear fallback data (admin operation)
 */
export async function clearFallbackData(env: Env): Promise<boolean> {
	if (!env.METADATA_STORE || !env.DATA_EXPORTS) {
		log('warn', 'Required storage not configured');
		return false;
	}

	try {
		// Get metadata to find data file
		const metadataJson = await env.METADATA_STORE.get('fallback:last_good_data');
		if (metadataJson) {
			const metadata = JSON.parse(metadataJson) as FallbackMetadata;
			const dataPath = `fallback/last-good-data-${metadata.version}.txt`;

			// Delete data file from R2
			await env.DATA_EXPORTS.delete(dataPath);
		}

		// Delete metadata from KV
		await env.METADATA_STORE.delete('fallback:last_good_data');

		log('info', 'Cleared fallback data');
		return true;
	} catch (error) {
		log('error', 'Failed to clear fallback data', {
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}
