import { describe, it, expect } from 'vitest';
import type { ConfigData } from '../src/types';
import { validateConfigData, formatValidationResult, formatValidationResultJSON } from '../src/validation';

describe('Configuration Validation Module', () => {
	describe('validateConfigData', () => {
		it('should validate a complete and valid configuration', () => {
			const validConfig: ConfigData = {
				dataSource: {
					originZipUrl: 'https://data.fcc.gov/download/pub/uls/complete/l_amat.zip',
					zipFileName: 'l_amat.zip',
					extractedFileName: 'AM.dat',
					expectedSchema: {
						fields: ['record_type', 'callsign', 'operator_class'],
						delimiter: '|',
						hasHeader: false,
					},
				},
				backupEndpoints: {
					primary: 'https://backup.example.com/l_amat.zip',
				},
				externalSync: {
					sql: {
						enabled: false,
						endpoints: [],
					},
					redis: {
						enabled: false,
						endpoints: [],
					},
				},
				features: {
					jwtAuth: false,
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: false,
				},
				rateLimits: {
					user: {
						requestsPerMinute: 100,
						burstSize: 10,
					},
					admin: {
						requestsPerMinute: 1000,
						burstSize: 50,
					},
				},
				cache: {
					ttl: 3600,
					maxEntries: 10000,
				},
			};

			const result = validateConfigData(validConfig);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should detect missing dataSource', () => {
			const config = {
				features: {
					jwtAuth: false,
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: false,
				},
			} as ConfigData;

			const result = validateConfigData(config);

			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: 'dataSource',
					severity: 'error',
				})
			);
		});

		it('should detect invalid URL in dataSource.originZipUrl', () => {
			const config: ConfigData = {
				dataSource: {
					originZipUrl: 'not-a-valid-url',
					zipFileName: 'l_amat.zip',
					extractedFileName: 'AM.dat',
					expectedSchema: {
						fields: ['callsign'],
					},
				},
				features: {
					jwtAuth: false,
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: false,
				},
			};

			const result = validateConfigData(config);

			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: 'dataSource.originZipUrl',
					message: 'originZipUrl is not a valid URL',
					severity: 'error',
				})
			);
		});

		it('should detect empty expectedSchema.fields array', () => {
			const config: ConfigData = {
				dataSource: {
					originZipUrl: 'https://example.com/data.zip',
					zipFileName: 'data.zip',
					extractedFileName: 'data.dat',
					expectedSchema: {
						fields: [],
					},
				},
				features: {
					jwtAuth: false,
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: false,
				},
			};

			const result = validateConfigData(config);

			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: 'dataSource.expectedSchema.fields',
					message: 'expectedSchema.fields must not be empty',
					severity: 'error',
				})
			);
		});

		it('should detect invalid feature flags', () => {
			const config: ConfigData = {
				dataSource: {
					originZipUrl: 'https://example.com/data.zip',
					zipFileName: 'data.zip',
					extractedFileName: 'data.dat',
					expectedSchema: {
						fields: ['callsign'],
					},
				},
				features: {
					jwtAuth: 'yes' as any, // Invalid: should be boolean
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: false,
				},
			};

			const result = validateConfigData(config);

			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: 'features.jwtAuth',
					message: 'jwtAuth must be a boolean',
					severity: 'error',
				})
			);
		});

		it('should detect invalid rate limit values', () => {
			const config: ConfigData = {
				dataSource: {
					originZipUrl: 'https://example.com/data.zip',
					zipFileName: 'data.zip',
					extractedFileName: 'data.dat',
					expectedSchema: {
						fields: ['callsign'],
					},
				},
				features: {
					jwtAuth: false,
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: false,
				},
				rateLimits: {
					user: {
						requestsPerMinute: -10, // Invalid: negative value
					},
					admin: {
						requestsPerMinute: 1000,
					},
				},
			};

			const result = validateConfigData(config);

			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: 'rateLimits.user.requestsPerMinute',
					severity: 'error',
				})
			);
		});

		it('should detect invalid SQL endpoint configuration', () => {
			const config: ConfigData = {
				dataSource: {
					originZipUrl: 'https://example.com/data.zip',
					zipFileName: 'data.zip',
					extractedFileName: 'data.dat',
					expectedSchema: {
						fields: ['callsign'],
					},
				},
				externalSync: {
					sql: {
						enabled: true,
						endpoints: [
							{
								id: 'db1',
								type: 'invalid-type' as any, // Invalid type
								endpoint: 'postgres://localhost:5432',
								enabled: true,
							},
						],
					},
				},
				features: {
					jwtAuth: false,
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: false,
				},
			};

			const result = validateConfigData(config);

			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: 'externalSync.sql.endpoints[0].type',
					severity: 'error',
				})
			);
		});

		it('should detect missing required fields in SQL endpoints', () => {
			const config: ConfigData = {
				dataSource: {
					originZipUrl: 'https://example.com/data.zip',
					zipFileName: 'data.zip',
					extractedFileName: 'data.dat',
					expectedSchema: {
						fields: ['callsign'],
					},
				},
				externalSync: {
					sql: {
						enabled: true,
						endpoints: [
							{
								// Missing id, type, endpoint, enabled
							} as any,
						],
					},
				},
				features: {
					jwtAuth: false,
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: false,
				},
			};

			const result = validateConfigData(config);

			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
			// Should have errors for id, type, endpoint, and enabled
			expect(result.errors.filter(e => e.field.startsWith('externalSync.sql.endpoints[0]'))).toHaveLength(4);
		});

		it('should detect invalid backup endpoint URLs', () => {
			const config: ConfigData = {
				dataSource: {
					originZipUrl: 'https://example.com/data.zip',
					zipFileName: 'data.zip',
					extractedFileName: 'data.dat',
					expectedSchema: {
						fields: ['callsign'],
					},
				},
				backupEndpoints: {
					primary: 'ftp://invalid-protocol.com/data.zip', // FTP not allowed
				},
				features: {
					jwtAuth: false,
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: false,
				},
			};

			const result = validateConfigData(config);

			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: 'backupEndpoints.primary',
					severity: 'error',
				})
			);
		});

		it('should generate warnings for missing optional but recommended fields', () => {
			const config: ConfigData = {
				dataSource: {
					originZipUrl: 'https://example.com/data.zip',
					zipFileName: 'data.zip',
					extractedFileName: 'data.dat',
					expectedSchema: {
						fields: ['callsign'],
					},
				},
				features: {
					jwtAuth: false,
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: false,
				},
				// Missing rateLimits and cache
			};

			const result = validateConfigData(config);

			expect(result.valid).toBe(true); // Still valid
			expect(result.warnings.length).toBeGreaterThan(0);
			expect(result.warnings).toContainEqual(
				expect.objectContaining({
					field: 'rateLimits',
					severity: 'warning',
				})
			);
			expect(result.warnings).toContainEqual(
				expect.objectContaining({
					field: 'cache',
					severity: 'warning',
				})
			);
		});

		it('should validate Redis endpoint configuration', () => {
			const config: ConfigData = {
				dataSource: {
					originZipUrl: 'https://example.com/data.zip',
					zipFileName: 'data.zip',
					extractedFileName: 'data.dat',
					expectedSchema: {
						fields: ['callsign'],
					},
				},
				externalSync: {
					redis: {
						enabled: true,
						endpoints: [
							{
								id: 'redis1',
								endpoint: 'redis://localhost:6379',
								enabled: true,
								ttl: 3600,
							},
						],
					},
				},
				features: {
					jwtAuth: false,
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: true,
				},
			};

			const result = validateConfigData(config);

			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it('should detect non-string fields in expectedSchema.fields', () => {
			const config: ConfigData = {
				dataSource: {
					originZipUrl: 'https://example.com/data.zip',
					zipFileName: 'data.zip',
					extractedFileName: 'data.dat',
					expectedSchema: {
						fields: ['callsign', 123 as any, 'operator_class'], // 123 is not a string
					},
				},
				features: {
					jwtAuth: false,
					canaryDeployment: false,
					advancedSearch: true,
					dataExport: true,
					externalSync: false,
				},
			};

			const result = validateConfigData(config);

			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(
				expect.objectContaining({
					field: 'dataSource.expectedSchema.fields[1]',
					message: 'Field at index 1 must be a string',
					severity: 'error',
				})
			);
		});
	});

	describe('formatValidationResult', () => {
		it('should format a valid result with no warnings', () => {
			const result = {
				valid: true,
				errors: [],
				warnings: [],
			};

			const formatted = formatValidationResult(result);

			expect(formatted).toContain('✓');
			expect(formatted).toContain('valid with no warnings');
		});

		it('should format errors with suggestions', () => {
			const result = {
				valid: false,
				errors: [
					{
						field: 'dataSource.originZipUrl',
						message: 'Missing originZipUrl',
						severity: 'error' as const,
						suggestion: 'Add a valid URL',
					},
				],
				warnings: [],
			};

			const formatted = formatValidationResult(result);

			expect(formatted).toContain('✗');
			expect(formatted).toContain('dataSource.originZipUrl');
			expect(formatted).toContain('Missing originZipUrl');
			expect(formatted).toContain('Add a valid URL');
		});

		it('should format warnings separately from errors', () => {
			const result = {
				valid: true,
				errors: [],
				warnings: [
					{
						field: 'cache',
						message: 'Cache not configured',
						severity: 'warning' as const,
						suggestion: 'Add cache configuration',
					},
				],
			};

			const formatted = formatValidationResult(result);

			expect(formatted).toContain('⚠');
			expect(formatted).toContain('warning');
			expect(formatted).toContain('cache');
		});
	});

	describe('formatValidationResultJSON', () => {
		it('should format result as valid JSON', () => {
			const result = {
				valid: true,
				errors: [],
				warnings: [],
			};

			const formatted = formatValidationResultJSON(result);
			const parsed = JSON.parse(formatted);

			expect(parsed.valid).toBe(true);
			expect(parsed.errors).toEqual([]);
			expect(parsed.warnings).toEqual([]);
		});

		it('should include all error details in JSON', () => {
			const result = {
				valid: false,
				errors: [
					{
						field: 'test.field',
						message: 'Test error',
						severity: 'error' as const,
						suggestion: 'Fix it',
					},
				],
				warnings: [],
			};

			const formatted = formatValidationResultJSON(result);
			const parsed = JSON.parse(formatted);

			expect(parsed.errors[0].field).toBe('test.field');
			expect(parsed.errors[0].message).toBe('Test error');
			expect(parsed.errors[0].suggestion).toBe('Fix it');
		});
	});
});
