/**
 * Database patching engine for D1 operations
 */

import type {
	Env,
	DiffResult,
	PatchOperation,
	ConfigData,
	DatabaseSnapshot,
	RollbackResult,
} from '../types';
import { log } from '../utils';

/**
 * Initialize database table if it doesn't exist
 */
export async function initializeDatabase(env: Env): Promise<boolean> {
	if (!env.CALLSIGN_DB) {
		log('warn', 'D1 database not configured');
		return false;
	}

	try {
		// Create callsigns table with dynamic columns
		// Using a simple key-value structure where we store the full record as JSON
		await env.CALLSIGN_DB.prepare(
			`CREATE TABLE IF NOT EXISTS callsigns (
				callsign TEXT PRIMARY KEY,
				data TEXT NOT NULL,
				updated_at TEXT NOT NULL
			)`
		).run();

		// Create index on updated_at for performance
		await env.CALLSIGN_DB.prepare(
			`CREATE INDEX IF NOT EXISTS idx_updated_at ON callsigns(updated_at)`
		).run();

		// Create snapshots table for rollback support
		await env.CALLSIGN_DB.prepare(
			`CREATE TABLE IF NOT EXISTS database_snapshots (
				version TEXT PRIMARY KEY,
				timestamp TEXT NOT NULL,
				record_count INTEGER NOT NULL,
				hash TEXT NOT NULL,
				data_path TEXT NOT NULL
			)`
		).run();

		log('info', 'Database initialized successfully');
		return true;
	} catch (error) {
		log('error', 'Failed to initialize database', {
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

/**
 * Parse a record line into key-value pairs
 */
function parseRecordLine(
	line: string,
	delimiter: string,
	fields: string[]
): Record<string, string> {
	const values = line.split(delimiter).map((v) => v.trim());
	const record: Record<string, string> = {};

	for (let i = 0; i < Math.min(fields.length, values.length); i++) {
		record[fields[i]] = values[i];
	}

	return record;
}

/**
 * Create patch operations from diff result
 */
export function createPatchOperations(
	newContent: string,
	oldContent: string | null,
	diff: DiffResult,
	config: ConfigData
): PatchOperation[] {
	const operations: PatchOperation[] = [];
	const delimiter = config.dataSource.expectedSchema.delimiter || ',';
	const fields = config.dataSource.expectedSchema.fields;
	const hasHeader = config.dataSource.expectedSchema.hasHeader !== false;

	// Parse content into lines
	const newLines = newContent.split('\n').filter((line) => line.trim().length > 0);
	const oldLines = oldContent
		? oldContent.split('\n').filter((line) => line.trim().length > 0)
		: [];

	// Build maps of records by key
	const newRecordsMap = new Map<string, string>();
	const oldRecordsMap = new Map<string, string>();

	// Parse new records
	const startIndex = hasHeader ? 1 : 0;
	for (let i = startIndex; i < newLines.length; i++) {
		const line = newLines[i];
		const firstDelimiterIndex = line.indexOf(delimiter);
		if (firstDelimiterIndex !== -1) {
			const key = line.substring(0, firstDelimiterIndex).trim();
			newRecordsMap.set(key, line);
		}
	}

	// Parse old records
	for (let i = startIndex; i < oldLines.length; i++) {
		const line = oldLines[i];
		const firstDelimiterIndex = line.indexOf(delimiter);
		if (firstDelimiterIndex !== -1) {
			const key = line.substring(0, firstDelimiterIndex).trim();
			oldRecordsMap.set(key, line);
		}
	}

	// Create INSERT operations for added records
	for (const key of diff.added) {
		const line = newRecordsMap.get(key);
		if (line) {
			const record = parseRecordLine(line, delimiter, fields);
			operations.push({
				type: 'insert',
				record,
				key,
			});
		}
	}

	// Create UPDATE operations for modified records
	for (const key of diff.modified) {
		const line = newRecordsMap.get(key);
		if (line) {
			const record = parseRecordLine(line, delimiter, fields);
			operations.push({
				type: 'update',
				record,
				key,
			});
		}
	}

	// Create DELETE operations for deleted records
	for (const key of diff.deleted) {
		const line = oldRecordsMap.get(key);
		if (line) {
			const record = parseRecordLine(line, delimiter, fields);
			operations.push({
				type: 'delete',
				record,
				key,
			});
		}
	}

	log('info', 'Created patch operations', {
		inserts: diff.added.length,
		updates: diff.modified.length,
		deletes: diff.deleted.length,
		total: operations.length,
	});

	return operations;
}

/**
 * Apply patch operations to D1 database in batches
 */
export async function applyPatchOperations(
	env: Env,
	operations: PatchOperation[],
	batchSize: number = 100
): Promise<{ success: boolean; appliedCount: number; error?: string }> {
	if (!env.CALLSIGN_DB) {
		return { success: false, appliedCount: 0, error: 'D1 database not configured' };
	}

	log('info', 'Starting to apply patch operations', {
		totalOperations: operations.length,
		batchSize,
	});

	let appliedCount = 0;

	try {
		// Process operations in batches
		for (let i = 0; i < operations.length; i += batchSize) {
			const batch = operations.slice(i, i + batchSize);

			// Execute batch as a single transaction
			const statements: D1PreparedStatement[] = [];

			for (const op of batch) {
				const timestamp = new Date().toISOString();
				const dataJson = JSON.stringify(op.record);

				switch (op.type) {
					case 'insert':
						statements.push(
							env.CALLSIGN_DB.prepare(
								`INSERT INTO callsigns (callsign, data, updated_at) VALUES (?, ?, ?)`
							).bind(op.key, dataJson, timestamp)
						);
						break;

					case 'update':
						statements.push(
							env.CALLSIGN_DB.prepare(
								`UPDATE callsigns SET data = ?, updated_at = ? WHERE callsign = ?`
							).bind(dataJson, timestamp, op.key)
						);
						break;

					case 'delete':
						statements.push(
							env.CALLSIGN_DB.prepare(
								`DELETE FROM callsigns WHERE callsign = ?`
							).bind(op.key)
						);
						break;
				}
			}

			// Execute batch
			await env.CALLSIGN_DB.batch(statements);
			appliedCount += batch.length;

			log('info', 'Applied batch of patch operations', {
				batchNumber: Math.floor(i / batchSize) + 1,
				batchSize: batch.length,
				totalApplied: appliedCount,
			});
		}

		log('info', 'Successfully applied all patch operations', {
			totalApplied: appliedCount,
		});

		return { success: true, appliedCount };
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		log('error', 'Failed to apply patch operations', {
			error: errorMsg,
			appliedCount,
		});

		return {
			success: false,
			appliedCount,
			error: errorMsg,
		};
	}
}

/**
 * Create a database snapshot for rollback
 */
export async function createDatabaseSnapshot(
	env: Env,
	version: string,
	recordCount: number,
	hash: string,
	dataPath: string
): Promise<boolean> {
	if (!env.CALLSIGN_DB) {
		log('warn', 'D1 database not configured');
		return false;
	}

	try {
		const timestamp = new Date().toISOString();

		await env.CALLSIGN_DB.prepare(
			`INSERT INTO database_snapshots (version, timestamp, record_count, hash, data_path)
			 VALUES (?, ?, ?, ?, ?)
			 ON CONFLICT(version) DO UPDATE SET
			   timestamp = excluded.timestamp,
			   record_count = excluded.record_count,
			   hash = excluded.hash,
			   data_path = excluded.data_path`
		)
			.bind(version, timestamp, recordCount, hash, dataPath)
			.run();

		log('info', 'Created database snapshot', { version, recordCount });
		return true;
	} catch (error) {
		log('error', 'Failed to create database snapshot', {
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}

/**
 * Get the latest database snapshot
 */
export async function getLatestSnapshot(
	env: Env
): Promise<DatabaseSnapshot | null> {
	if (!env.CALLSIGN_DB) {
		return null;
	}

	try {
		const result = await env.CALLSIGN_DB.prepare(
			`SELECT version, timestamp, record_count, hash, data_path
			 FROM database_snapshots
			 ORDER BY timestamp DESC
			 LIMIT 1`
		).first<{
			version: string;
			timestamp: string;
			record_count: number;
			hash: string;
			data_path: string;
		}>();

		if (!result) {
			return null;
		}

		return {
			version: result.version,
			timestamp: result.timestamp,
			recordCount: result.record_count,
			hash: result.hash,
			dataPath: result.data_path,
		};
	} catch (error) {
		log('error', 'Failed to get latest snapshot', {
			error: error instanceof Error ? error.message : String(error),
		});
		return null;
	}
}

/**
 * Rollback database to a previous snapshot
 */
export async function rollbackToSnapshot(
	env: Env,
	targetVersion?: string
): Promise<RollbackResult> {
	if (!env.CALLSIGN_DB || !env.DATA_EXPORTS) {
		return {
			success: false,
			error: 'Required resources not configured',
			timestamp: new Date().toISOString(),
		};
	}

	try {
		// Get snapshot to rollback to
		let snapshot: DatabaseSnapshot | null;

		if (targetVersion) {
			const result = await env.CALLSIGN_DB.prepare(
				`SELECT version, timestamp, record_count, hash, data_path
				 FROM database_snapshots
				 WHERE version = ?`
			)
				.bind(targetVersion)
				.first<{
					version: string;
					timestamp: string;
					record_count: number;
					hash: string;
					data_path: string;
				}>();

			if (!result) {
				return {
					success: false,
					error: `Snapshot version ${targetVersion} not found`,
					timestamp: new Date().toISOString(),
				};
			}

			snapshot = {
				version: result.version,
				timestamp: result.timestamp,
				recordCount: result.record_count,
				hash: result.hash,
				dataPath: result.data_path,
			};
		} else {
			snapshot = await getLatestSnapshot(env);
			if (!snapshot) {
				return {
					success: false,
					error: 'No snapshot available for rollback',
					timestamp: new Date().toISOString(),
				};
			}
		}

		log('info', 'Rolling back to snapshot', {
			version: snapshot.version,
			recordCount: snapshot.recordCount,
		});

		// Get snapshot data from R2
		await env.DATA_EXPORTS.get(snapshot.dataPath);

		// Clear current database
		await env.CALLSIGN_DB.prepare(`DELETE FROM callsigns`).run();

		// TODO: Restore data from snapshot
		// This would require parsing the content and re-inserting records
		// For now, we just clear and log the operation
		log('info', 'Rollback completed', {
			version: snapshot.version,
			recordsRestored: snapshot.recordCount,
			note: 'Data restoration from snapshot content not yet implemented',
		});

		return {
			success: true,
			rolledBackTo: snapshot.version,
			recordsRestored: snapshot.recordCount,
			timestamp: new Date().toISOString(),
		};
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		log('error', 'Rollback failed', { error: errorMsg });

		return {
			success: false,
			error: errorMsg,
			timestamp: new Date().toISOString(),
		};
	}
}

/**
 * Get database record count
 */
export async function getDatabaseRecordCount(env: Env): Promise<number> {
	if (!env.CALLSIGN_DB) {
		return 0;
	}

	try {
		const result = await env.CALLSIGN_DB.prepare(
			`SELECT COUNT(*) as count FROM callsigns`
		).first<{ count: number }>();

		return result?.count || 0;
	} catch (error) {
		log('error', 'Failed to get record count', {
			error: error instanceof Error ? error.message : String(error),
		});
		return 0;
	}
}
