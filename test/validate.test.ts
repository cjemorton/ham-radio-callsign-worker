/**
 * Tests for the validate engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Env, ConfigData } from '../src/types';
import {
	validateSchema,
	validateData,
	calculateHash,
	storeValidationMetadata,
} from '../src/engine/validate';

describe('Validate Engine', () => {
	let env: Env;
	let config: ConfigData;

	beforeEach(() => {
		env = {
			ENVIRONMENT: 'test',
			LOG_LEVEL: 'info',
		};

		config = {
			dataSource: {
				originZipUrl: 'https://example.com/data.zip',
				zipFileName: 'data.zip',
				extractedFileName: 'data.txt',
				expectedSchema: {
					fields: ['callsign', 'name', 'class'],
					delimiter: ',',
					hasHeader: true,
				},
			},
			features: {
				jwtAuth: false,
				canaryDeployment: false,
				advancedSearch: false,
				dataExport: false,
				externalSync: false,
			},
		};
	});

	describe('calculateHash', () => {
		it('should generate consistent hash for same content', async () => {
			const content = 'test content';
			const hash1 = await calculateHash(content);
			const hash2 = await calculateHash(content);
			expect(hash1).toBe(hash2);
		});

		it('should generate different hash for different content', async () => {
			const hash1 = await calculateHash('content1');
			const hash2 = await calculateHash('content2');
			expect(hash1).not.toBe(hash2);
		});

		it('should generate hash for empty content', async () => {
			const hash = await calculateHash('');
			expect(hash).toBeTruthy();
			expect(typeof hash).toBe('string');
			expect(hash.length).toBeGreaterThan(0);
		});

		it('should generate hash for large content', async () => {
			const largeContent = 'x'.repeat(10000);
			const hash = await calculateHash(largeContent);
			expect(hash).toBeTruthy();
			expect(typeof hash).toBe('string');
		});
	});

	describe('validateSchema', () => {
		it('should validate data with correct schema', () => {
			const content =
				'callsign,name,class\nAA1AA,John Doe,Extra\nBB2BB,Jane Smith,General\n';
			const result = validateSchema(content, config);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should detect missing required fields', () => {
			const content = 'callsign,name\nAA1AA,John Doe\n';
			const result = validateSchema(content, config);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should handle data without header when configured', () => {
			const noHeaderConfig: ConfigData = {
				...config,
				dataSource: {
					...config.dataSource,
					expectedSchema: {
						...config.dataSource.expectedSchema,
						hasHeader: false,
					},
				},
			};

			const content = 'AA1AA,John Doe,Extra\nBB2BB,Jane Smith,General\n';
			const result = validateSchema(content, noHeaderConfig);
			expect(result.valid).toBe(true);
		});

		it('should validate with different delimiters', () => {
			const pipeConfig: ConfigData = {
				...config,
				dataSource: {
					...config.dataSource,
					expectedSchema: {
						...config.dataSource.expectedSchema,
						delimiter: '|',
					},
				},
			};

			const content =
				'callsign|name|class\nAA1AA|John Doe|Extra\nBB2BB|Jane Smith|General\n';
			const result = validateSchema(content, pipeConfig);
			expect(result.valid).toBe(true);
		});

		it('should handle empty content', () => {
			const result = validateSchema('', config);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	describe('validateData', () => {
		it('should validate data with correct format and hash', async () => {
			const content =
				'callsign,name,class\nAA1AA,John Doe,Extra\nBB2BB,Jane Smith,General\n';
			const result = await validateData(env, content, config);

			expect(result.success).toBe(true);
			expect(result.metadata.recordCount).toBe(2);
			expect(result.errors).toHaveLength(0);
		});

		it('should return validation errors for invalid data', async () => {
			const content = 'invalid data without proper structure';
			const result = await validateData(env, content, config);

			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it('should count records correctly', async () => {
			const content =
				'callsign,name,class\nAA1AA,John,Extra\nBB2BB,Jane,General\nCC3CC,Bob,Tech\n';
			const result = await validateData(env, content, config);

			expect(result.success).toBe(true);
			expect(result.metadata.recordCount).toBe(3);
		});

		it('should handle data without header', async () => {
			const noHeaderConfig: ConfigData = {
				...config,
				dataSource: {
					...config.dataSource,
					expectedSchema: {
						...config.dataSource.expectedSchema,
						hasHeader: false,
					},
				},
			};

			const content = 'AA1AA,John Doe,Extra\nBB2BB,Jane Smith,General\n';
			const result = await validateData(env, content, noHeaderConfig);

			expect(result.success).toBe(true);
			// With hasHeader: false, both lines are treated as data rows
			expect(result.metadata.recordCount).toBeGreaterThan(0);
		});
	});

	describe('storeValidationMetadata', () => {
		it('should do nothing when METADATA_STORE is not configured', async () => {
			const validationResult = {
				success: true,
				errors: [],
				warnings: [],
				metadata: {
					timestamp: new Date().toISOString(),
					recordCount: 100,
				},
			};

			// Should not throw
			await expect(
				storeValidationMetadata(env, validationResult, '1.0.0')
			).resolves.toBeUndefined();
		});

		it('should store validation metadata in KV', async () => {
			let storedKey: string | null = null;
			let storedValue: string | null = null;

			const mockKV = {
				put: async (key: string, value: string) => {
					storedKey = key;
					storedValue = value;
				},
			} as unknown as KVNamespace;

			env.METADATA_STORE = mockKV;

			const validationResult = {
				success: true,
				errors: [],
				warnings: [],
				metadata: {
					timestamp: new Date().toISOString(),
					hashMatch: true,
					schemaMatch: true,
					recordCount: 100,
				},
			};

			await storeValidationMetadata(env, validationResult, '1.2.3');

			expect(storedKey).toBe('validation:1.2.3');
			expect(storedValue).not.toBeNull();

			const parsed = JSON.parse(storedValue!);
			expect(parsed.success).toBe(true);
			expect(parsed.recordCount).toBe(100);
			expect(parsed.version).toBe('1.2.3');
			expect(parsed.timestamp).toBeTruthy();
		});
	});
});
