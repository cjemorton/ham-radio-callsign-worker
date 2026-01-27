/**
 * Data diffing engine for comparing versions of callsign data
 */

import type { Env, DiffResult, ConfigData } from '../types';
import { log } from '../utils';
import { calculateHash } from './validate';

/**
 * Parse delimited content into records keyed by first field (callsign)
 */
function parseRecords(
	content: string,
	delimiter: string = ',',
	hasHeader: boolean = true
): Map<string, string> {
	const lines = content.split('\n').filter((line) => line.trim().length > 0);

	if (lines.length === 0) {
		return new Map();
	}

	const records = new Map<string, string>();
	const startIndex = hasHeader ? 1 : 0;

	for (let i = startIndex; i < lines.length; i++) {
		const line = lines[i];
		const firstDelimiterIndex = line.indexOf(delimiter);

		if (firstDelimiterIndex === -1) {
			// No delimiter found, use entire line as key
			const key = line.trim();
			if (key) {
				records.set(key, line);
			}
		} else {
			// Use first field as key
			const key = line.substring(0, firstDelimiterIndex).trim();
			if (key) {
				records.set(key, line);
			}
		}
	}

	return records;
}

/**
 * Calculate diff between old and new data
 */
export async function calculateDiff(
	newContent: string,
	oldContent: string | null,
	config: ConfigData,
	oldVersion?: string,
	newVersion?: string
): Promise<DiffResult> {
	const startTime = Date.now();
	const delimiter = config.dataSource.expectedSchema.delimiter || ',';
	const hasHeader = config.dataSource.expectedSchema.hasHeader !== false;

	log('info', 'Starting diff calculation', {
		hasOldContent: !!oldContent,
		oldVersion,
		newVersion,
	});

	try {
		// Parse records from both versions
		const newRecords = parseRecords(newContent, delimiter, hasHeader);
		const oldRecords = oldContent
			? parseRecords(oldContent, delimiter, hasHeader)
			: new Map<string, string>();

		// Calculate hashes
		const newHash = await calculateHash(newContent);
		const oldHash = oldContent ? await calculateHash(oldContent) : undefined;

		// If hashes match, no changes
		if (oldHash && newHash === oldHash) {
			log('info', 'No changes detected (hash match)', {
				hash: newHash.substring(0, 16) + '...',
			});

			return {
				hasChanges: false,
				added: [],
				modified: [],
				deleted: [],
				unchanged: newRecords.size,
				summary: {
					addedCount: 0,
					modifiedCount: 0,
					deletedCount: 0,
					unchangedCount: newRecords.size,
					totalOldRecords: oldRecords.size,
					totalNewRecords: newRecords.size,
				},
				metadata: {
					oldVersion,
					newVersion: newVersion || new Date().toISOString(),
					oldHash,
					newHash,
					timestamp: new Date().toISOString(),
				},
			};
		}

		// Find added and modified records
		const added: string[] = [];
		const modified: string[] = [];
		let unchanged = 0;

		for (const [key, newRecord] of newRecords.entries()) {
			const oldRecord = oldRecords.get(key);

			if (!oldRecord) {
				// New record
				added.push(key);
			} else if (oldRecord !== newRecord) {
				// Modified record
				modified.push(key);
			} else {
				// Unchanged record
				unchanged++;
			}
		}

		// Find deleted records
		const deleted: string[] = [];
		for (const key of oldRecords.keys()) {
			if (!newRecords.has(key)) {
				deleted.push(key);
			}
		}

		const duration = Date.now() - startTime;

		const result: DiffResult = {
			hasChanges: added.length > 0 || modified.length > 0 || deleted.length > 0,
			added,
			modified,
			deleted,
			unchanged,
			summary: {
				addedCount: added.length,
				modifiedCount: modified.length,
				deletedCount: deleted.length,
				unchangedCount: unchanged,
				totalOldRecords: oldRecords.size,
				totalNewRecords: newRecords.size,
			},
			metadata: {
				oldVersion,
				newVersion: newVersion || new Date().toISOString(),
				oldHash,
				newHash,
				timestamp: new Date().toISOString(),
			},
		};

		log('info', 'Diff calculation completed', {
			hasChanges: result.hasChanges,
			added: added.length,
			modified: modified.length,
			deleted: deleted.length,
			unchanged,
			duration,
		});

		return result;
	} catch (error) {
		log('error', 'Diff calculation failed', {
			error: error instanceof Error ? error.message : String(error),
		});

		throw new Error(
			`Diff calculation failed: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

/**
 * Store diff report in R2
 */
export async function storeDiffReport(
	env: Env,
	diff: DiffResult
): Promise<boolean> {
	if (!env.DATA_EXPORTS) {
		log('warn', 'R2 bucket not configured, cannot store diff report');
		return false;
	}

	try {
		const reportPath = `diffs/diff-${diff.metadata.newVersion}.json`;
		const reportData = JSON.stringify(diff, null, 2);

		await env.DATA_EXPORTS.put(reportPath, reportData, {
			httpMetadata: {
				contentType: 'application/json',
			},
			customMetadata: {
				version: diff.metadata.newVersion,
				oldVersion: diff.metadata.oldVersion || 'none',
				hasChanges: String(diff.hasChanges),
				addedCount: String(diff.summary.addedCount),
				modifiedCount: String(diff.summary.modifiedCount),
				deletedCount: String(diff.summary.deletedCount),
				timestamp: diff.metadata.timestamp,
			},
		});

		log('info', 'Stored diff report in R2', {
			path: reportPath,
			version: diff.metadata.newVersion,
		});

		return true;
	} catch (error) {
		log('error', 'Failed to store diff report', {
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

/**
 * Retrieve the last stored data content
 */
export async function getLastDataContent(env: Env): Promise<{
	content: string;
	version: string;
} | null> {
	if (!env.METADATA_STORE || !env.DATA_EXPORTS) {
		log('warn', 'Required storage not configured for retrieving last data');
		return null;
	}

	try {
		// Get metadata from KV
		const metadataJson = await env.METADATA_STORE.get('fallback:last_good_data');
		if (!metadataJson) {
			log('info', 'No previous data found');
			return null;
		}

		const metadata = JSON.parse(metadataJson) as {
			version: string;
			timestamp: string;
			hash: string;
			recordCount: number;
		};

		// Get actual data from R2
		const dataPath = `fallback/last-good-data-${metadata.version}.txt`;
		const dataObject = await env.DATA_EXPORTS.get(dataPath);

		if (!dataObject) {
			log('error', 'Metadata exists but data file not found', {
				version: metadata.version,
				dataPath,
			});
			return null;
		}

		const content = await dataObject.text();

		log('info', 'Retrieved last data content', {
			version: metadata.version,
			size: content.length,
		});

		return { content, version: metadata.version };
	} catch (error) {
		log('error', 'Failed to retrieve last data content', {
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}
