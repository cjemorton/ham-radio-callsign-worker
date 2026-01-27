/**
 * Tests for the diff engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { Env, ConfigData } from '../src/types';
import { calculateDiff, getLastDataContent } from '../src/engine/diff';

describe('Diff Engine', () => {
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

	describe('calculateDiff', () => {
		it('should detect no changes when content is identical', async () => {
			const content = 'callsign,name,class\nAA1AA,John Doe,Extra\nBB2BB,Jane Smith,General\n';

			const diff = await calculateDiff(content, content, config);

			expect(diff.hasChanges).toBe(false);
			expect(diff.summary.addedCount).toBe(0);
			expect(diff.summary.modifiedCount).toBe(0);
			expect(diff.summary.deletedCount).toBe(0);
			expect(diff.summary.unchangedCount).toBe(2);
		});

		it('should detect added records', async () => {
			const oldContent = 'callsign,name,class\nAA1AA,John Doe,Extra\n';
			const newContent = 'callsign,name,class\nAA1AA,John Doe,Extra\nBB2BB,Jane Smith,General\n';

			const diff = await calculateDiff(newContent, oldContent, config);

			expect(diff.hasChanges).toBe(true);
			expect(diff.summary.addedCount).toBe(1);
			expect(diff.summary.modifiedCount).toBe(0);
			expect(diff.summary.deletedCount).toBe(0);
			expect(diff.added).toContain('BB2BB');
		});

		it('should detect deleted records', async () => {
			const oldContent = 'callsign,name,class\nAA1AA,John Doe,Extra\nBB2BB,Jane Smith,General\n';
			const newContent = 'callsign,name,class\nAA1AA,John Doe,Extra\n';

			const diff = await calculateDiff(newContent, oldContent, config);

			expect(diff.hasChanges).toBe(true);
			expect(diff.summary.addedCount).toBe(0);
			expect(diff.summary.modifiedCount).toBe(0);
			expect(diff.summary.deletedCount).toBe(1);
			expect(diff.deleted).toContain('BB2BB');
		});

		it('should detect modified records', async () => {
			const oldContent = 'callsign,name,class\nAA1AA,John Doe,Extra\n';
			const newContent = 'callsign,name,class\nAA1AA,John Doe,General\n';

			const diff = await calculateDiff(newContent, oldContent, config);

			expect(diff.hasChanges).toBe(true);
			expect(diff.summary.addedCount).toBe(0);
			expect(diff.summary.modifiedCount).toBe(1);
			expect(diff.summary.deletedCount).toBe(0);
			expect(diff.modified).toContain('AA1AA');
		});

		it('should handle null old content (first import)', async () => {
			const newContent = 'callsign,name,class\nAA1AA,John Doe,Extra\n';

			const diff = await calculateDiff(newContent, null, config);

			expect(diff.hasChanges).toBe(true);
			expect(diff.summary.addedCount).toBe(1);
			expect(diff.summary.modifiedCount).toBe(0);
			expect(diff.summary.deletedCount).toBe(0);
			expect(diff.added).toContain('AA1AA');
		});

		it('should detect multiple changes at once', async () => {
			const oldContent = 'callsign,name,class\nAA1AA,John Doe,Extra\nBB2BB,Jane Smith,General\nCC3CC,Bob Jones,Technician\n';
			const newContent = 'callsign,name,class\nAA1AA,John Doe,General\nBB2BB,Jane Smith,General\nDD4DD,Alice Brown,Extra\n';

			const diff = await calculateDiff(newContent, oldContent, config);

			expect(diff.hasChanges).toBe(true);
			expect(diff.summary.addedCount).toBe(1);
			expect(diff.summary.modifiedCount).toBe(1);
			expect(diff.summary.deletedCount).toBe(1);
			expect(diff.summary.unchangedCount).toBe(1);
			expect(diff.added).toContain('DD4DD');
			expect(diff.modified).toContain('AA1AA');
			expect(diff.deleted).toContain('CC3CC');
		});

		it('should handle pipe delimiter', async () => {
			const configWithPipe: ConfigData = {
				...config,
				dataSource: {
					...config.dataSource,
					expectedSchema: {
						fields: ['callsign', 'name', 'class'],
						delimiter: '|',
						hasHeader: true,
					},
				},
			};

			const oldContent = 'callsign|name|class\nAA1AA|John Doe|Extra\n';
			const newContent = 'callsign|name|class\nAA1AA|John Doe|Extra\nBB2BB|Jane Smith|General\n';

			const diff = await calculateDiff(newContent, oldContent, configWithPipe);

			expect(diff.hasChanges).toBe(true);
			expect(diff.summary.addedCount).toBe(1);
			expect(diff.added).toContain('BB2BB');
		});
	});

	describe('getLastDataContent', () => {
		it('should return null when storage not configured', async () => {
			const result = await getLastDataContent(env);
			expect(result).toBeNull();
		});

		it('should return null when no previous data exists', async () => {
			const mockKV = {
				get: async () => null,
			} as unknown as KVNamespace;

			env.METADATA_STORE = mockKV;
			env.DATA_EXPORTS = {} as R2Bucket;

			const result = await getLastDataContent(env);
			expect(result).toBeNull();
		});
	});
});
