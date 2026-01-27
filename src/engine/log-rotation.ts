/**
 * Log Rotation Utilities
 * Handles log file rotation and retention management
 */

import type { Env } from '../types';
import { log } from '../utils';

/**
 * Log rotation configuration
 */
export interface LogRotationConfig {
	retentionDays: number; // How many days to keep logs
	maxFileSize?: number; // Optional max file size in bytes
}

/**
 * Default rotation configuration
 */
const DEFAULT_ROTATION_CONFIG: LogRotationConfig = {
	retentionDays: 30, // Keep logs for 30 days by default
	maxFileSize: 10 * 1024 * 1024, // 10MB max file size
};

/**
 * Get list of log files older than retention period
 */
export async function getExpiredLogFiles(
	env: Env,
	config: LogRotationConfig = DEFAULT_ROTATION_CONFIG
): Promise<string[]> {
	if (!env.DATA_EXPORTS) {
		log('warn', 'R2 bucket not configured, cannot check for expired logs');
		return [];
	}

	try {
		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);

		// List all log files
		const listed = await env.DATA_EXPORTS.list({
			prefix: 'events/',
			limit: 1000,
		});

		const expiredFiles: string[] = [];

		for (const obj of listed.objects) {
			// Extract date from filename (format: logs-YYYY-MM-DD.jsonl)
			const match = obj.key.match(/logs-(\d{4}-\d{2}-\d{2})\.jsonl$/);
			if (match) {
				const fileDate = new Date(match[1]);
				if (fileDate < cutoffDate) {
					expiredFiles.push(obj.key);
				}
			}
		}

		return expiredFiles;
	} catch (error) {
		log('error', 'Failed to get expired log files', {
			error: error instanceof Error ? error.message : String(error),
		});
		return [];
	}
}

/**
 * Delete expired log files
 */
export async function deleteExpiredLogs(
	env: Env,
	config: LogRotationConfig = DEFAULT_ROTATION_CONFIG
): Promise<{ deleted: number; errors: string[] }> {
	if (!env.DATA_EXPORTS) {
		return { deleted: 0, errors: ['R2 bucket not configured'] };
	}

	const expiredFiles = await getExpiredLogFiles(env, config);
	const errors: string[] = [];
	let deleted = 0;

	for (const key of expiredFiles) {
		try {
			await env.DATA_EXPORTS.delete(key);
			deleted++;
			log('info', 'Deleted expired log file', { key });
		} catch (error) {
			const errorMsg = `Failed to delete ${key}: ${error instanceof Error ? error.message : String(error)}`;
			errors.push(errorMsg);
			log('error', 'Failed to delete expired log file', {
				key,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { deleted, errors };
}

/**
 * Get log file statistics
 */
export async function getLogStatistics(env: Env): Promise<{
	totalFiles: number;
	totalSize: number;
	oldestLog?: string;
	newestLog?: string;
	filesByDate: Record<string, number>;
}> {
	if (!env.DATA_EXPORTS) {
		return {
			totalFiles: 0,
			totalSize: 0,
			filesByDate: {},
		};
	}

	try {
		const listed = await env.DATA_EXPORTS.list({
			prefix: 'events/',
			limit: 1000,
		});

		let totalSize = 0;
		const dates: string[] = [];
		const filesByDate: Record<string, number> = {};

		for (const obj of listed.objects) {
			totalSize += obj.size || 0;

			// Extract date from filename
			const match = obj.key.match(/logs-(\d{4}-\d{2}-\d{2})\.jsonl$/);
			if (match) {
				const date = match[1];
				dates.push(date);
				filesByDate[date] = (filesByDate[date] || 0) + 1;
			}
		}

		dates.sort();

		return {
			totalFiles: listed.objects.length,
			totalSize,
			oldestLog: dates.length > 0 ? dates[0] : undefined,
			newestLog: dates.length > 0 ? dates[dates.length - 1] : undefined,
			filesByDate,
		};
	} catch (error) {
		log('error', 'Failed to get log statistics', {
			error: error instanceof Error ? error.message : String(error),
		});
		return {
			totalFiles: 0,
			totalSize: 0,
			filesByDate: {},
		};
	}
}

/**
 * Archive old logs (compress and move to archive prefix)
 * Note: R2 doesn't support compression directly, so this just moves files
 */
export async function archiveOldLogs(
	env: Env,
	daysToArchive: number = 7
): Promise<{ archived: number; errors: string[] }> {
	if (!env.DATA_EXPORTS) {
		return { archived: 0, errors: ['R2 bucket not configured'] };
	}

	try {
		const archiveDate = new Date();
		archiveDate.setDate(archiveDate.getDate() - daysToArchive);

		// List log files
		const listed = await env.DATA_EXPORTS.list({
			prefix: 'events/',
			limit: 1000,
		});

		const errors: string[] = [];
		let archived = 0;

		for (const obj of listed.objects) {
			// Extract date from filename
			const match = obj.key.match(/logs-(\d{4}-\d{2}-\d{2})\.jsonl$/);
			if (!match) continue;

			const fileDate = new Date(match[1]);
			if (fileDate >= archiveDate) continue;

			// Move to archive
			const newKey = obj.key.replace('events/', 'events/archive/');
			try {
				// Copy to new location
				const content = await env.DATA_EXPORTS.get(obj.key);
				if (content) {
					await env.DATA_EXPORTS.put(newKey, await content.arrayBuffer(), {
						httpMetadata: content.httpMetadata,
						customMetadata: content.customMetadata,
					});
					// Delete original
					await env.DATA_EXPORTS.delete(obj.key);
					archived++;
					log('info', 'Archived log file', { from: obj.key, to: newKey });
				}
			} catch (error) {
				const errorMsg = `Failed to archive ${obj.key}: ${error instanceof Error ? error.message : String(error)}`;
				errors.push(errorMsg);
				log('error', 'Failed to archive log file', {
					key: obj.key,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return { archived, errors };
	} catch (error) {
		log('error', 'Failed to archive old logs', {
			error: error instanceof Error ? error.message : String(error),
		});
		return {
			archived: 0,
			errors: [error instanceof Error ? error.message : String(error)],
		};
	}
}
