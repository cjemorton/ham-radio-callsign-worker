/**
 * Main orchestrator for fetch, extract, and validate workflow
 */

import type { Env, FallbackMetadata, ValidationResult, DiffResult, AggregateSyncResult } from '../types';
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
import {
	calculateDiff,
	storeDiffReport,
	getLastDataContent,
} from './diff';
import {
	initializeDatabase,
	createPatchOperations,
	applyPatchOperations,
	createDatabaseSnapshot,
} from './database';
import { syncToSlaves } from './slave-sync';

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
	diff?: DiffResult;
	slaveSyncResult?: AggregateSyncResult;
	metadata: {
		timestamp: string;
		duration: number;
		fetchTriggered: boolean;
		validationPassed: boolean;
		fallbackUsed: boolean;
		databasePatched: boolean;
		slavesSynced: boolean;
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
					databasePatched: false,
					slavesSynced: false,
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
							databasePatched: false,
							slavesSynced: false,
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

		// Step 7: Calculate diff with previous data
		const hash = await calculateHash(extractResult.content);
		const version = new Date().toISOString().replace(/[:.]/g, '-');
		
		// Use record count from validation if available, otherwise calculate
		const recordCount = validationResult?.metadata.recordCount ?? 
			extractResult.content.split('\n').filter(l => l.trim()).length - 1;

		log('info', 'Calculating diff with previous data');
		const lastData = await getLastDataContent(env);
		const diff = await calculateDiff(
			extractResult.content,
			lastData?.content || null,
			config.data,
			lastData?.version,
			version
		);

		// Store diff report in R2
		await storeDiffReport(env, diff);

		// Step 8: Apply database patches if D1 is available and there are changes
		let databasePatched = false;
		let slavesSynced = false;
		let slaveSyncResult: AggregateSyncResult | undefined;
		
		if (env.CALLSIGN_DB && diff.hasChanges) {
			log('info', 'Applying database patches', {
				added: diff.summary.addedCount,
				modified: diff.summary.modifiedCount,
				deleted: diff.summary.deletedCount,
			});

			// Initialize database if needed
			await initializeDatabase(env);

			// Create patch operations
			const operations = createPatchOperations(
				extractResult.content,
				lastData?.content || null,
				diff,
				config.data
			);

			// Apply patches
			const patchResult = await applyPatchOperations(env, operations);

			if (patchResult.success) {
				databasePatched = true;
				log('info', 'Database patches applied successfully', {
					operationsApplied: patchResult.appliedCount,
				});
				
				// Step 8a: Sync to slave endpoints after successful master update
				log('info', 'Propagating updates to slave endpoints');
				slaveSyncResult = await syncToSlaves(env, operations, config.data);
				slavesSynced = slaveSyncResult.totalSlaves > 0;
				
				if (slaveSyncResult.failureCount > 0) {
					warnings.push(
						`Some slave syncs failed: ${slaveSyncResult.failureCount} of ${slaveSyncResult.totalSlaves}`
					);
				}
			} else {
				warnings.push(
					`Failed to apply database patches: ${patchResult.error}`
				);
			}
		} else if (env.CALLSIGN_DB && !diff.hasChanges) {
			log('info', 'No database changes detected, skipping patching');
			databasePatched = false;
		}

		// Step 9: Store as new last good data
		const fallbackMetadata: FallbackMetadata = {
			version,
			timestamp: new Date().toISOString(),
			hash,
			recordCount,
			reason: 'Successful validation',
		};

		await storeLastGoodData(env, extractResult.content, fallbackMetadata);

		// Create database snapshot for rollback
		if (env.CALLSIGN_DB && databasePatched) {
			const dataPath = `fallback/last-good-data-${version}.txt`;
			await createDatabaseSnapshot(env, version, recordCount, hash, dataPath);
		}

		// Store processing metadata
		await storeMetadata(env, `processing-${version}`, {
			version,
			timestamp: new Date().toISOString(),
			duration: Date.now() - startTime,
			fetchSize: fetchResult.metadata.size,
			recordCount,
			hash,
			diff: {
				added: diff.summary.addedCount,
				modified: diff.summary.modifiedCount,
				deleted: diff.summary.deletedCount,
			},
		});

		// Update last fetch timestamp
		await updateLastFetchTimestamp(env);

		log('info', 'Data pipeline completed successfully', {
			version,
			recordCount,
			databasePatched,
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
			diff,
			slaveSyncResult,
			metadata: {
				timestamp: new Date().toISOString(),
				duration: Date.now() - startTime,
				fetchTriggered: true,
				validationPassed: true,
				fallbackUsed: false,
				databasePatched,
				slavesSynced,
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
			databasePatched: false,
			slavesSynced: false,
			errors,
			warnings,
		},
	};
}
