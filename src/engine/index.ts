/**
 * Main orchestrator for fetch, extract, and validate workflow
 */

import type { Env, FallbackMetadata, ValidationResult } from '../types';
import { log } from '../utils';
import { loadConfig } from '../config';
import {
	shouldFetch,
	fetchZipFromOrigin,
	updateLastFetchTimestamp,
} from './fetch';
import { extractFromZip, validateFilePresence } from './extract';
import { validateData, calculateHash, storeValidationMetadata } from './validate';
import {
	storeLastGoodData,
	handleValidationFailure,
} from './fallback';
import { storeMetadata, logErrorEvent } from './logger';

/**
 * Result of the full processing workflow
 */
export interface ProcessingResult {
	success: boolean;
	status:
		| 'completed'
		| 'failed'
		| 'skipped'
		| 'validation_failed'
		| 'fallback_used';
	data?: {
		content: string;
		version: string;
		recordCount: number;
		hash: string;
	};
	metadata: {
		timestamp: string;
		duration: number;
		fetchTriggered: boolean;
		validationPassed: boolean;
		fallbackUsed: boolean;
		errors: string[];
		warnings: string[];
	};
}

/**
 * Execute the complete fetch-extract-validate workflow
 */
export async function executeDataPipeline(
	env: Env,
	options: {
		onDemand?: boolean;
		maxAgeSeconds?: number;
		skipValidation?: boolean;
		stagingMode?: boolean;
	} = {}
): Promise<ProcessingResult> {
	const startTime = Date.now();
	const errors: string[] = [];
	const warnings: string[] = [];

	log('info', 'Starting data pipeline execution', options);

	try {
		// Step 1: Check if we need to fetch
		const fetchCheck = await shouldFetch(
			env,
			options.onDemand,
			options.maxAgeSeconds
		);

		if (!fetchCheck.should) {
			log('info', 'Fetch not needed', { reason: fetchCheck.reason });
			return {
				success: true,
				status: 'skipped',
				metadata: {
					timestamp: new Date().toISOString(),
					duration: Date.now() - startTime,
					fetchTriggered: false,
					validationPassed: true,
					fallbackUsed: false,
					errors: [],
					warnings: [fetchCheck.reason],
				},
			};
		}

		// Step 2: Get configuration
		const config = await loadConfig(env);
		if (!config) {
			errors.push('Configuration not available');
			return createFailureResult(startTime, errors, warnings);
		}

		// Step 3: Fetch ZIP from origin
		log('info', 'Fetching ZIP from origin', {
			url: config.data.dataSource.originZipUrl,
		});

		const fetchResult = await fetchZipFromOrigin(env, config.data);

		if (!fetchResult.success || !fetchResult.data) {
			errors.push(fetchResult.error || 'Failed to fetch ZIP');
			return createFailureResult(startTime, errors, warnings);
		}

		// Step 4: Validate file presence in ZIP
		log('info', 'Validating file presence in ZIP');
		const targetFile = config.data.dataSource.extractedFileName;
		const filePresent = validateFilePresence(fetchResult.data, targetFile);

		if (!filePresent) {
			errors.push(`Target file '${targetFile}' not found in ZIP`);
			return createFailureResult(startTime, errors, warnings);
		}

		// Step 5: Extract file from ZIP
		log('info', 'Extracting file from ZIP', { targetFile });
		const extractResult = await extractFromZip(env, fetchResult.data, config.data);

		if (!extractResult.success || !extractResult.content) {
			errors.push(extractResult.error || 'Failed to extract file');
			return createFailureResult(startTime, errors, warnings);
		}

		// Step 6: Validate data
		let validationResult: ValidationResult | undefined;
		if (!options.skipValidation) {
			log('info', 'Validating extracted data');
			validationResult = await validateData(
				env,
				extractResult.content,
				config.data
			);

			// Store validation metadata
			const version = new Date().toISOString().replace(/[:.]/g, '-');
			await storeValidationMetadata(env, validationResult, version);

			if (!validationResult.success) {
				// Validation failed - attempt fallback
				log('warn', 'Validation failed, attempting fallback', {
					errors: validationResult.errors,
				});

				const fallbackResult = await handleValidationFailure(
					env,
					validationResult,
					version
				);

				if (fallbackResult.useFallback && fallbackResult.fallbackContent) {
					// Use fallback data
					warnings.push(...validationResult.warnings);
					warnings.push(fallbackResult.reason);

					return {
						success: true,
						status: 'fallback_used',
						data: {
							content: fallbackResult.fallbackContent,
							version: fallbackResult.fallbackMetadata!.version,
							recordCount: fallbackResult.fallbackMetadata!.recordCount,
							hash: fallbackResult.fallbackMetadata!.hash,
						},
						metadata: {
							timestamp: new Date().toISOString(),
							duration: Date.now() - startTime,
							fetchTriggered: true,
							validationPassed: false,
							fallbackUsed: true,
							errors: validationResult.errors,
							warnings,
						},
					};
				} else {
					// No fallback available
					errors.push(...validationResult.errors);
					errors.push('Validation failed and no fallback data available');
					return createFailureResult(startTime, errors, warnings);
				}
			}

			warnings.push(...validationResult.warnings);
		}

		// Step 7: Success - store as new last good data
		const hash = await calculateHash(extractResult.content);
		const version = new Date().toISOString().replace(/[:.]/g, '-');
		
		// Use record count from validation if available, otherwise calculate
		const recordCount = validationResult?.metadata.recordCount ?? 
			extractResult.content.split('\n').filter(l => l.trim()).length - 1;

		const fallbackMetadata: FallbackMetadata = {
			version,
			timestamp: new Date().toISOString(),
			hash,
			recordCount,
			reason: 'Successful validation',
		};

		await storeLastGoodData(env, extractResult.content, fallbackMetadata);

		// Store processing metadata
		await storeMetadata(env, `processing-${version}`, {
			version,
			timestamp: new Date().toISOString(),
			duration: Date.now() - startTime,
			fetchSize: fetchResult.metadata.size,
			recordCount,
			hash,
		});

		// Update last fetch timestamp
		await updateLastFetchTimestamp(env);

		log('info', 'Data pipeline completed successfully', {
			version,
			recordCount,
			duration: Date.now() - startTime,
		});

		return {
			success: true,
			status: 'completed',
			data: {
				content: extractResult.content,
				version,
				recordCount,
				hash,
			},
			metadata: {
				timestamp: new Date().toISOString(),
				duration: Date.now() - startTime,
				fetchTriggered: true,
				validationPassed: true,
				fallbackUsed: false,
				errors: [],
				warnings,
			},
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		errors.push(`Pipeline execution error: ${errorMessage}`);

		log('error', 'Data pipeline failed with exception', {
			error: errorMessage,
			stack: error instanceof Error ? error.stack : undefined,
		});

		// Log error event to R2
		if (error instanceof Error) {
			await logErrorEvent(env, error, 'data-pipeline', options);
		}

		return createFailureResult(startTime, errors, warnings);
	}
}

/**
 * Create a failure result
 */
function createFailureResult(
	startTime: number,
	errors: string[],
	warnings: string[]
): ProcessingResult {
	return {
		success: false,
		status: 'failed',
		metadata: {
			timestamp: new Date().toISOString(),
			duration: Date.now() - startTime,
			fetchTriggered: true,
			validationPassed: false,
			fallbackUsed: false,
			errors,
			warnings,
		},
	};
}
