/**
 * R2 Logger for event logs, metadata, and diffs
 * Implements JSONL format with rotation
 */

import type { Env, DataProcessingEvent } from '../types';
import { log } from '../utils';

/**
 * Generate unique event ID
 */
export function generateEventId(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 9);
	return `${timestamp}-${random}`;
}

/**
 * Get current log file name with rotation
 * Rotates daily: logs-YYYY-MM-DD.jsonl
 */
export function getLogFileName(): string {
	const date = new Date();
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	return `logs-${year}-${month}-${day}.jsonl`;
}

/**
 * Write event log to R2
 */
export async function writeEventLog(
	env: Env,
	event: DataProcessingEvent
): Promise<void> {
	if (!env.DATA_EXPORTS) {
		log('warn', 'R2 bucket not configured, skipping event log', { eventId: event.eventId });
		return;
	}

	try {
		const logFileName = getLogFileName();
		const logPath = `events/${logFileName}`;

		// Read existing log file if it exists
		let existingContent = '';
		try {
			const existingLog = await env.DATA_EXPORTS.get(logPath);
			if (existingLog) {
				existingContent = await existingLog.text();
			}
		} catch (error) {
			// File doesn't exist yet, that's okay
			log('debug', 'Creating new log file', { logPath });
		}

		// Append new event as JSONL
		const newLine = JSON.stringify(event) + '\n';
		const updatedContent = existingContent + newLine;

		// Write back to R2
		await env.DATA_EXPORTS.put(logPath, updatedContent, {
			httpMetadata: {
				contentType: 'application/x-ndjson',
			},
			customMetadata: {
				lastUpdated: new Date().toISOString(),
				eventCount: String(updatedContent.split('\n').filter(line => line.trim()).length),
			},
		});

		log('debug', 'Event log written to R2', { eventId: event.eventId, logPath });
	} catch (error) {
		log('error', 'Failed to write event log to R2', {
			eventId: event.eventId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Create and log a fetch event
 */
export async function logFetchEvent(
	env: Env,
	status: 'success' | 'failure' | 'warning',
	details: DataProcessingEvent['details']
): Promise<void> {
	const event: DataProcessingEvent = {
		eventId: generateEventId(),
		timestamp: new Date().toISOString(),
		type: 'fetch',
		status,
		details,
	};

	await writeEventLog(env, event);
}

/**
 * Create and log an extraction event
 */
export async function logExtractionEvent(
	env: Env,
	status: 'success' | 'failure' | 'warning',
	details: DataProcessingEvent['details']
): Promise<void> {
	const event: DataProcessingEvent = {
		eventId: generateEventId(),
		timestamp: new Date().toISOString(),
		type: 'extract',
		status,
		details,
	};

	await writeEventLog(env, event);
}

/**
 * Create and log a validation event
 */
export async function logValidationEvent(
	env: Env,
	status: 'success' | 'failure' | 'warning',
	details: DataProcessingEvent['details']
): Promise<void> {
	const event: DataProcessingEvent = {
		eventId: generateEventId(),
		timestamp: new Date().toISOString(),
		type: 'validate',
		status,
		details,
	};

	await writeEventLog(env, event);
}

/**
 * Create and log a fallback event
 */
export async function logFallbackEvent(
	env: Env,
	status: 'success' | 'failure' | 'warning',
	details: DataProcessingEvent['details']
): Promise<void> {
	const event: DataProcessingEvent = {
		eventId: generateEventId(),
		timestamp: new Date().toISOString(),
		type: 'fallback',
		status,
		details,
	};

	await writeEventLog(env, event);
}

/**
 * Create and log an error event
 */
export async function logErrorEvent(
	env: Env,
	error: Error,
	context: string,
	metadata?: Record<string, unknown>
): Promise<void> {
	const event: DataProcessingEvent = {
		eventId: generateEventId(),
		timestamp: new Date().toISOString(),
		type: 'error',
		status: 'failure',
		details: {
			message: `Error in ${context}: ${error.message}`,
			error: error.message,
			stackTrace: error.stack,
			metadata,
		},
	};

	await writeEventLog(env, event);
}

/**
 * Store metadata to R2
 */
export async function storeMetadata(
	env: Env,
	key: string,
	metadata: Record<string, unknown>
): Promise<void> {
	if (!env.DATA_EXPORTS) {
		log('warn', 'R2 bucket not configured, skipping metadata storage');
		return;
	}

	try {
		const metadataPath = `metadata/${key}.json`;
		const content = JSON.stringify(metadata, null, 2);

		await env.DATA_EXPORTS.put(metadataPath, content, {
			httpMetadata: {
				contentType: 'application/json',
			},
			customMetadata: {
				lastUpdated: new Date().toISOString(),
			},
		});

		log('debug', 'Metadata stored to R2', { key, metadataPath });
	} catch (error) {
		log('error', 'Failed to store metadata to R2', {
			key,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Store diff to R2
 */
export async function storeDiff(
	env: Env,
	version: string,
	diff: {
		added: number;
		modified: number;
		deleted: number;
		details?: unknown;
	}
): Promise<void> {
	if (!env.DATA_EXPORTS) {
		log('warn', 'R2 bucket not configured, skipping diff storage');
		return;
	}

	try {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		const diffPath = `diffs/diff-${version}-${timestamp}.json`;
		const content = JSON.stringify(diff, null, 2);

		await env.DATA_EXPORTS.put(diffPath, content, {
			httpMetadata: {
				contentType: 'application/json',
			},
			customMetadata: {
				version,
				timestamp: new Date().toISOString(),
			},
		});

		log('debug', 'Diff stored to R2', { version, diffPath });
	} catch (error) {
		log('error', 'Failed to store diff to R2', {
			version,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
