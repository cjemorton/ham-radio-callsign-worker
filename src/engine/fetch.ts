/**
 * Fetch engine for downloading ZIP files from configured origin
 */

import type { Env, FetchResult, ConfigData } from '../types';
import { log } from '../utils';
import { logFetchEvent } from './logger';

/**
 * Check if data is stale based on last update timestamp
 */
export async function isDataStale(
	env: Env,
	maxAgeSeconds: number = 86400 // Default: 24 hours
): Promise<boolean> {
	if (!env.METADATA_STORE) {
		log('warn', 'Metadata store not configured, assuming data is stale');
		return true;
	}

	try {
		const lastUpdate = await env.METADATA_STORE.get('last_data_update');
		if (!lastUpdate) {
			log('info', 'No previous update found, data is stale');
			return true;
		}

		const lastUpdateTime = new Date(lastUpdate).getTime();
		const now = Date.now();
		const ageSeconds = (now - lastUpdateTime) / 1000;

		const stale = ageSeconds > maxAgeSeconds;
		log('info', 'Checked data staleness', { ageSeconds, maxAgeSeconds, stale });

		return stale;
	} catch (error) {
		log('error', 'Failed to check data staleness', {
			error: error instanceof Error ? error.message : String(error),
		});
		// Assume stale on error
		return true;
	}
}

/**
 * Fetch ZIP file from origin URL
 */
export async function fetchZipFromOrigin(
	env: Env,
	config: ConfigData,
	options: {
		timeout?: number;
		maxRetries?: number;
		retryDelay?: number;
	} = {}
): Promise<FetchResult> {
	const { timeout = 30000, maxRetries = 3, retryDelay = 1000 } = options;
	const originUrl = config.dataSource.originZipUrl;
	const startTime = Date.now();

	log('info', 'Starting ZIP fetch from origin', { originUrl, timeout, maxRetries });

	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			log('info', `Fetch attempt ${attempt}/${maxRetries}`, { originUrl });

			// Create abort controller for timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			try {
				const response = await fetch(originUrl, {
					signal: controller.signal,
					headers: {
						'User-Agent': 'Ham-Radio-Callsign-Worker/0.1.0',
					},
				});

				clearTimeout(timeoutId);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const data = await response.arrayBuffer();
				const duration = Date.now() - startTime;

				const result: FetchResult = {
					success: true,
					data,
					metadata: {
						url: originUrl,
						timestamp: new Date().toISOString(),
						size: data.byteLength,
						duration,
					},
				};

				log('info', 'Successfully fetched ZIP from origin', {
					size: data.byteLength,
					duration,
					attempt,
				});

				// Log success event to R2
				await logFetchEvent(env, 'success', {
					message: 'ZIP file fetched successfully',
					duration,
					dataSize: data.byteLength,
					metadata: { attempt, url: originUrl },
				});

				return result;
			} catch (fetchError) {
				clearTimeout(timeoutId);
				throw fetchError;
			}
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			log('warn', `Fetch attempt ${attempt} failed`, {
				error: lastError.message,
				attempt,
			});

			// Wait before retry (except on last attempt)
			if (attempt < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
			}
		}
	}

	// All retries failed
	const duration = Date.now() - startTime;
	const errorMessage = lastError?.message || 'Unknown error';

	const result: FetchResult = {
		success: false,
		error: `Failed to fetch ZIP after ${maxRetries} attempts: ${errorMessage}`,
		metadata: {
			url: originUrl,
			timestamp: new Date().toISOString(),
			duration,
		},
	};

	log('error', 'Failed to fetch ZIP from origin', {
		error: errorMessage,
		attempts: maxRetries,
		duration,
	});

	// Log failure event to R2
	await logFetchEvent(env, 'failure', {
		message: 'Failed to fetch ZIP file',
		duration,
		error: errorMessage,
		metadata: { attempts: maxRetries, url: originUrl },
	});

	return result;
}

/**
 * Check if fetch should be triggered (stale or on-demand)
 */
export async function shouldFetch(
	env: Env,
	onDemand: boolean = false,
	maxAgeSeconds?: number
): Promise<{ should: boolean; reason: string }> {
	if (onDemand) {
		return { should: true, reason: 'On-demand fetch requested' };
	}

	const stale = await isDataStale(env, maxAgeSeconds);
	if (stale) {
		return { should: true, reason: 'Data is stale' };
	}

	return { should: false, reason: 'Data is fresh' };
}

/**
 * Update last fetch timestamp
 */
export async function updateLastFetchTimestamp(env: Env): Promise<void> {
	if (!env.METADATA_STORE) {
		log('warn', 'Metadata store not configured, cannot update last fetch timestamp');
		return;
	}

	try {
		const timestamp = new Date().toISOString();
		await env.METADATA_STORE.put('last_data_update', timestamp);
		log('info', 'Updated last fetch timestamp', { timestamp });
	} catch (error) {
		log('error', 'Failed to update last fetch timestamp', {
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
