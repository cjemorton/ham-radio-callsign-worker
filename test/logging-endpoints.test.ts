import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as adminHandlers from '../src/handlers/admin';
import type { Env } from '../src/types';

describe('Admin Logging Endpoints', () => {
	let env: Env;
	let mockR2Bucket: R2Bucket;

	beforeEach(() => {
		// Mock R2 bucket
		mockR2Bucket = {
			get: vi.fn(),
			put: vi.fn(),
			delete: vi.fn(),
			list: vi.fn(),
		} as unknown as R2Bucket;

		env = {
			ENVIRONMENT: 'test',
			LOG_LEVEL: 'info',
			ADMIN_API_KEY: 'test-api-key-123',
			DATA_EXPORTS: mockR2Bucket,
		};
	});

	describe('GET /admin/logs/events', () => {
		it('should return 503 when R2 bucket is not configured', async () => {
			const envWithoutR2: Env = {
				ENVIRONMENT: 'test',
				LOG_LEVEL: 'info',
			};

			const request = new Request('http://localhost/admin/logs/events');
			const response = await adminHandlers.getEventLogs(
				request,
				envWithoutR2,
				{} as ExecutionContext
			);

			expect(response.status).toBe(503);
			const data = await response.json();
			expect(data).toHaveProperty('error', 'Service Unavailable');
		});

		it('should return empty logs when log file does not exist', async () => {
			vi.mocked(mockR2Bucket.get).mockResolvedValue(null);

			const request = new Request('http://localhost/admin/logs/events');
			const response = await adminHandlers.getEventLogs(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.data.count).toBe(0);
			expect(data.data.logs).toEqual([]);
		});

		it('should parse and return JSONL logs', async () => {
			const mockLogContent = `{"eventId":"123","timestamp":"2024-01-15T10:00:00.000Z","type":"fetch","status":"success","details":{"message":"Test"}}\n{"eventId":"456","timestamp":"2024-01-15T10:01:00.000Z","type":"error","status":"failure","details":{"message":"Error"}}`;

			const mockR2Object = {
				text: vi.fn().mockResolvedValue(mockLogContent),
				uploaded: new Date('2024-01-15T23:59:00.000Z'),
			};

			vi.mocked(mockR2Bucket.get).mockResolvedValue(mockR2Object as unknown as R2ObjectBody);

			const request = new Request('http://localhost/admin/logs/events');
			const response = await adminHandlers.getEventLogs(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.data.count).toBe(2);
			expect(data.data.logs).toHaveLength(2);
			expect(data.data.logs[0].eventId).toBe('456'); // Most recent first
			expect(data.data.logs[1].eventId).toBe('123');
		});

		it('should filter logs by type', async () => {
			const mockLogContent = `{"eventId":"123","timestamp":"2024-01-15T10:00:00.000Z","type":"fetch","status":"success","details":{"message":"Test"}}\n{"eventId":"456","timestamp":"2024-01-15T10:01:00.000Z","type":"error","status":"failure","details":{"message":"Error"}}`;

			const mockR2Object = {
				text: vi.fn().mockResolvedValue(mockLogContent),
				uploaded: new Date('2024-01-15T23:59:00.000Z'),
			};

			vi.mocked(mockR2Bucket.get).mockResolvedValue(mockR2Object as unknown as R2ObjectBody);

			const request = new Request('http://localhost/admin/logs/events?type=error');
			const response = await adminHandlers.getEventLogs(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.data.count).toBe(1);
			expect(data.data.logs[0].type).toBe('error');
		});

		it('should respect limit parameter', async () => {
			const mockLogContent = Array.from({ length: 10 }, (_, i) => 
				JSON.stringify({
					eventId: `${i}`,
					timestamp: `2024-01-15T10:0${i}:00.000Z`,
					type: 'fetch',
					status: 'success',
					details: { message: `Log ${i}` }
				})
			).join('\n');

			const mockR2Object = {
				text: vi.fn().mockResolvedValue(mockLogContent),
				uploaded: new Date('2024-01-15T23:59:00.000Z'),
			};

			vi.mocked(mockR2Bucket.get).mockResolvedValue(mockR2Object as unknown as R2ObjectBody);

			const request = new Request('http://localhost/admin/logs/events?limit=5');
			const response = await adminHandlers.getEventLogs(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.data.count).toBe(5);
			expect(data.data.total).toBe(10);
		});
	});

	describe('GET /admin/logs/files', () => {
		it('should return 503 when R2 bucket is not configured', async () => {
			const envWithoutR2: Env = {
				ENVIRONMENT: 'test',
				LOG_LEVEL: 'info',
			};

			const request = new Request('http://localhost/admin/logs/files');
			const response = await adminHandlers.getLogFiles(
				request,
				envWithoutR2,
				{} as ExecutionContext
			);

			expect(response.status).toBe(503);
		});

		it('should list log files from R2', async () => {
			const mockListResult = {
				objects: [
					{
						key: 'events/logs-2024-01-15.jsonl',
						size: 1024,
						uploaded: new Date('2024-01-15T23:59:00.000Z'),
						etag: 'abc123',
					},
					{
						key: 'events/logs-2024-01-14.jsonl',
						size: 2048,
						uploaded: new Date('2024-01-14T23:59:00.000Z'),
						etag: 'def456',
					},
				],
				truncated: false,
			};

			vi.mocked(mockR2Bucket.list).mockResolvedValue(mockListResult as R2Objects);

			const request = new Request('http://localhost/admin/logs/files');
			const response = await adminHandlers.getLogFiles(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.data.count).toBe(2);
			expect(data.data.files).toHaveLength(2);
			expect(data.data.files[0].name).toBe('logs-2024-01-15.jsonl');
		});
	});

	describe('GET /admin/logs/stats', () => {
		it('should return 503 when R2 bucket is not configured', async () => {
			const envWithoutR2: Env = {
				ENVIRONMENT: 'test',
				LOG_LEVEL: 'info',
			};

			const request = new Request('http://localhost/admin/logs/stats');
			const response = await adminHandlers.getLogStats(
				request,
				envWithoutR2,
				{} as ExecutionContext
			);

			expect(response.status).toBe(503);
		});

		it('should return log statistics', async () => {
			const mockListResult = {
				objects: [
					{
						key: 'events/logs-2024-01-15.jsonl',
						size: 1024,
						uploaded: new Date('2024-01-15T23:59:00.000Z'),
					},
					{
						key: 'events/logs-2024-01-14.jsonl',
						size: 2048,
						uploaded: new Date('2024-01-14T23:59:00.000Z'),
					},
				],
				truncated: false,
			};

			vi.mocked(mockR2Bucket.list).mockResolvedValue(mockListResult as R2Objects);

			const request = new Request('http://localhost/admin/logs/stats');
			const response = await adminHandlers.getLogStats(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.data.totalFiles).toBe(2);
			expect(data.data.totalSize).toBe(3072); // 1024 + 2048
			expect(data.data.oldestLog).toBe('2024-01-14');
			expect(data.data.newestLog).toBe('2024-01-15');
		});
	});

	describe('GET /admin/status', () => {
		it('should return system status with healthy state', async () => {
			const request = new Request('http://localhost/admin/status');
			const response = await adminHandlers.getStatus(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('status');
			expect(data.data).toHaveProperty('timestamp');
			expect(data.data).toHaveProperty('services');
			expect(data.data).toHaveProperty('storage');
			expect(data.data.storage.r2Available).toBe(true);
		});

		it('should show degraded status when database is unavailable', async () => {
			const envWithoutDB: Env = {
				ENVIRONMENT: 'test',
				LOG_LEVEL: 'info',
				DATA_EXPORTS: mockR2Bucket,
			};

			const request = new Request('http://localhost/admin/status');
			const response = await adminHandlers.getStatus(
				request,
				envWithoutDB,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.data.database.available).toBe(false);
			expect(data.data.services.database).toBe(false);
		});
	});

	describe('POST /admin/logs/rotate', () => {
		it('should return 503 when R2 bucket is not configured', async () => {
			const envWithoutR2: Env = {
				ENVIRONMENT: 'test',
				LOG_LEVEL: 'info',
			};

			const request = new Request('http://localhost/admin/logs/rotate', {
				method: 'POST',
			});
			const response = await adminHandlers.rotateAndCleanupLogs(
				request,
				envWithoutR2,
				{} as ExecutionContext
			);

			expect(response.status).toBe(503);
		});

		it('should handle log rotation with default parameters', async () => {
			// Mock list with no expired files
			vi.mocked(mockR2Bucket.list).mockResolvedValue({
				objects: [
					{
						key: 'events/logs-2024-01-15.jsonl',
						size: 1024,
						uploaded: new Date('2024-01-15T23:59:00.000Z'),
					},
				],
				truncated: false,
			} as R2Objects);

			const request = new Request('http://localhost/admin/logs/rotate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ retentionDays: 30 }),
			});

			const response = await adminHandlers.rotateAndCleanupLogs(
				request,
				env,
				{} as ExecutionContext
			);

			expect(response.status).toBe(200);
			const data = await response.json();
			expect(data.success).toBe(true);
			expect(data.data).toHaveProperty('message', 'Log rotation completed');
			expect(data.data).toHaveProperty('retentionDays', 30);
			expect(data.data).toHaveProperty('deleted');
			expect(data.data).toHaveProperty('archived');
		});
	});
});
