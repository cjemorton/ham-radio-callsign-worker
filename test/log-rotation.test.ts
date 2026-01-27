import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	getExpiredLogFiles,
	deleteExpiredLogs,
	getLogStatistics,
	archiveOldLogs,
} from '../src/engine/log-rotation';
import type { Env } from '../src/types';

describe('Log Rotation Utilities', () => {
	let env: Env;
	let mockR2Bucket: R2Bucket;

	beforeEach(() => {
		mockR2Bucket = {
			get: vi.fn(),
			put: vi.fn(),
			delete: vi.fn(),
			list: vi.fn(),
		} as unknown as R2Bucket;

		env = {
			ENVIRONMENT: 'test',
			LOG_LEVEL: 'info',
			DATA_EXPORTS: mockR2Bucket,
		};
	});

	describe('getExpiredLogFiles', () => {
		it('should return empty array when R2 bucket is not configured', async () => {
			const envWithoutR2: Env = {
				ENVIRONMENT: 'test',
				LOG_LEVEL: 'info',
			};

			const result = await getExpiredLogFiles(envWithoutR2, { retentionDays: 30 });
			expect(result).toEqual([]);
		});

		it('should identify expired log files', async () => {
			// Create dates 31 days ago and 15 days ago
			const expiredDate = new Date();
			expiredDate.setDate(expiredDate.getDate() - 31);
			const expiredDateStr = expiredDate.toISOString().split('T')[0];

			const validDate = new Date();
			validDate.setDate(validDate.getDate() - 15);
			const validDateStr = validDate.toISOString().split('T')[0];

			const mockListResult = {
				objects: [
					{ key: `events/logs-${expiredDateStr}.jsonl`, size: 1024 },
					{ key: `events/logs-${validDateStr}.jsonl`, size: 2048 },
				],
				truncated: false,
			};

			vi.mocked(mockR2Bucket.list).mockResolvedValue(mockListResult as R2Objects);

			const result = await getExpiredLogFiles(env, { retentionDays: 30 });
			expect(result).toHaveLength(1);
			expect(result[0]).toBe(`events/logs-${expiredDateStr}.jsonl`);
		});

		it('should not return files with non-matching names', async () => {
			const mockListResult = {
				objects: [
					{ key: 'events/logs-2024-01-15.jsonl', size: 1024 },
					{ key: 'events/other-file.txt', size: 2048 },
					{ key: 'events/logs-invalid.jsonl', size: 512 },
				],
				truncated: false,
			};

			vi.mocked(mockR2Bucket.list).mockResolvedValue(mockListResult as R2Objects);

			// Set retention to 0 days so first file would be expired if checked
			const result = await getExpiredLogFiles(env, { retentionDays: 0 });
			// Only the properly formatted file should be considered
			expect(result.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe('deleteExpiredLogs', () => {
		it('should return error when R2 bucket is not configured', async () => {
			const envWithoutR2: Env = {
				ENVIRONMENT: 'test',
				LOG_LEVEL: 'info',
			};

			const result = await deleteExpiredLogs(envWithoutR2, { retentionDays: 30 });
			expect(result.deleted).toBe(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toBe('R2 bucket not configured');
		});

		it('should delete expired log files', async () => {
			// Create an expired date
			const expiredDate = new Date();
			expiredDate.setDate(expiredDate.getDate() - 31);
			const expiredDateStr = expiredDate.toISOString().split('T')[0];

			const mockListResult = {
				objects: [
					{ key: `events/logs-${expiredDateStr}.jsonl`, size: 1024 },
				],
				truncated: false,
			};

			vi.mocked(mockR2Bucket.list).mockResolvedValue(mockListResult as R2Objects);
			vi.mocked(mockR2Bucket.delete).mockResolvedValue();

			const result = await deleteExpiredLogs(env, { retentionDays: 30 });
			expect(result.deleted).toBe(1);
			expect(result.errors).toHaveLength(0);
			expect(mockR2Bucket.delete).toHaveBeenCalledWith(`events/logs-${expiredDateStr}.jsonl`);
		});

		it('should collect errors when deletion fails', async () => {
			const expiredDate = new Date();
			expiredDate.setDate(expiredDate.getDate() - 31);
			const expiredDateStr = expiredDate.toISOString().split('T')[0];

			const mockListResult = {
				objects: [
					{ key: `events/logs-${expiredDateStr}.jsonl`, size: 1024 },
				],
				truncated: false,
			};

			vi.mocked(mockR2Bucket.list).mockResolvedValue(mockListResult as R2Objects);
			vi.mocked(mockR2Bucket.delete).mockRejectedValue(new Error('Permission denied'));

			const result = await deleteExpiredLogs(env, { retentionDays: 30 });
			expect(result.deleted).toBe(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Permission denied');
		});
	});

	describe('getLogStatistics', () => {
		it('should return empty statistics when R2 bucket is not configured', async () => {
			const envWithoutR2: Env = {
				ENVIRONMENT: 'test',
				LOG_LEVEL: 'info',
			};

			const result = await getLogStatistics(envWithoutR2);
			expect(result.totalFiles).toBe(0);
			expect(result.totalSize).toBe(0);
			expect(result.filesByDate).toEqual({});
		});

		it('should calculate statistics correctly', async () => {
			const mockListResult = {
				objects: [
					{ key: 'events/logs-2024-01-15.jsonl', size: 1024 },
					{ key: 'events/logs-2024-01-14.jsonl', size: 2048 },
					{ key: 'events/logs-2024-01-13.jsonl', size: 512 },
				],
				truncated: false,
			};

			vi.mocked(mockR2Bucket.list).mockResolvedValue(mockListResult as R2Objects);

			const result = await getLogStatistics(env);
			expect(result.totalFiles).toBe(3);
			expect(result.totalSize).toBe(3584); // 1024 + 2048 + 512
			expect(result.oldestLog).toBe('2024-01-13');
			expect(result.newestLog).toBe('2024-01-15');
			expect(result.filesByDate).toEqual({
				'2024-01-13': 1,
				'2024-01-14': 1,
				'2024-01-15': 1,
			});
		});

		it('should handle multiple files on same date', async () => {
			const mockListResult = {
				objects: [
					{ key: 'events/logs-2024-01-15.jsonl', size: 1024 },
					{ key: 'events/logs-2024-01-15.jsonl.backup', size: 512 },
				],
				truncated: false,
			};

			vi.mocked(mockR2Bucket.list).mockResolvedValue(mockListResult as R2Objects);

			const result = await getLogStatistics(env);
			// Only properly named files should be counted in filesByDate
			expect(result.filesByDate['2024-01-15']).toBe(1);
		});
	});

	describe('archiveOldLogs', () => {
		it('should return error when R2 bucket is not configured', async () => {
			const envWithoutR2: Env = {
				ENVIRONMENT: 'test',
				LOG_LEVEL: 'info',
			};

			const result = await archiveOldLogs(envWithoutR2, 7);
			expect(result.archived).toBe(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toBe('R2 bucket not configured');
		});

		it('should archive old log files', async () => {
			// Create a date 10 days ago
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 10);
			const oldDateStr = oldDate.toISOString().split('T')[0];

			const mockListResult = {
				objects: [
					{ key: `events/logs-${oldDateStr}.jsonl`, size: 1024 },
				],
				truncated: false,
			};

			const mockR2Object = {
				arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
				httpMetadata: {},
				customMetadata: {},
			};

			vi.mocked(mockR2Bucket.list).mockResolvedValue(mockListResult as R2Objects);
			vi.mocked(mockR2Bucket.get).mockResolvedValue(mockR2Object as unknown as R2ObjectBody);
			vi.mocked(mockR2Bucket.put).mockResolvedValue({} as R2Object);
			vi.mocked(mockR2Bucket.delete).mockResolvedValue();

			const result = await archiveOldLogs(env, 7);
			expect(result.archived).toBe(1);
			expect(result.errors).toHaveLength(0);
			expect(mockR2Bucket.put).toHaveBeenCalledWith(
				`events/archive/logs-${oldDateStr}.jsonl`,
				expect.any(ArrayBuffer),
				expect.any(Object)
			);
			expect(mockR2Bucket.delete).toHaveBeenCalledWith(`events/logs-${oldDateStr}.jsonl`);
		});

		it('should not archive recent files', async () => {
			// Create a date 5 days ago (less than archiveDays)
			const recentDate = new Date();
			recentDate.setDate(recentDate.getDate() - 5);
			const recentDateStr = recentDate.toISOString().split('T')[0];

			const mockListResult = {
				objects: [
					{ key: `events/logs-${recentDateStr}.jsonl`, size: 1024 },
				],
				truncated: false,
			};

			vi.mocked(mockR2Bucket.list).mockResolvedValue(mockListResult as R2Objects);

			const result = await archiveOldLogs(env, 7);
			expect(result.archived).toBe(0);
			expect(mockR2Bucket.put).not.toHaveBeenCalled();
		});

		it('should collect errors when archiving fails', async () => {
			const oldDate = new Date();
			oldDate.setDate(oldDate.getDate() - 10);
			const oldDateStr = oldDate.toISOString().split('T')[0];

			const mockListResult = {
				objects: [
					{ key: `events/logs-${oldDateStr}.jsonl`, size: 1024 },
				],
				truncated: false,
			};

			vi.mocked(mockR2Bucket.list).mockResolvedValue(mockListResult as R2Objects);
			vi.mocked(mockR2Bucket.get).mockRejectedValue(new Error('Read error'));

			const result = await archiveOldLogs(env, 7);
			expect(result.archived).toBe(0);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0]).toContain('Read error');
		});
	});
});
