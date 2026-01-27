/**
 * Tests for the database patching engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { ConfigData, DiffResult } from '../src/types';
import { createPatchOperations } from '../src/engine/database';

describe('Database Engine', () => {
	let config: ConfigData;

	beforeEach(() => {
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

	describe('createPatchOperations', () => {
		it('should create insert operations for added records', () => {
			const oldContent = 'callsign,name,class\nAA1AA,John Doe,Extra\n';
			const newContent = 'callsign,name,class\nAA1AA,John Doe,Extra\nBB2BB,Jane Smith,General\n';

			const diff: DiffResult = {
				hasChanges: true,
				added: ['BB2BB'],
				modified: [],
				deleted: [],
				unchanged: 1,
				summary: {
					addedCount: 1,
					modifiedCount: 0,
					deletedCount: 0,
					unchangedCount: 1,
					totalOldRecords: 1,
					totalNewRecords: 2,
				},
				metadata: {
					newVersion: 'v1',
					newHash: 'hash1',
					timestamp: new Date().toISOString(),
				},
			};

			const operations = createPatchOperations(newContent, oldContent, diff, config);

			expect(operations).toHaveLength(1);
			expect(operations[0].type).toBe('insert');
			expect(operations[0].key).toBe('BB2BB');
			expect(operations[0].record.callsign).toBe('BB2BB');
			expect(operations[0].record.name).toBe('Jane Smith');
		});

		it('should create update operations for modified records', () => {
			const oldContent = 'callsign,name,class\nAA1AA,John Doe,Extra\n';
			const newContent = 'callsign,name,class\nAA1AA,John Doe,General\n';

			const diff: DiffResult = {
				hasChanges: true,
				added: [],
				modified: ['AA1AA'],
				deleted: [],
				unchanged: 0,
				summary: {
					addedCount: 0,
					modifiedCount: 1,
					deletedCount: 0,
					unchangedCount: 0,
					totalOldRecords: 1,
					totalNewRecords: 1,
				},
				metadata: {
					newVersion: 'v1',
					newHash: 'hash1',
					timestamp: new Date().toISOString(),
				},
			};

			const operations = createPatchOperations(newContent, oldContent, diff, config);

			expect(operations).toHaveLength(1);
			expect(operations[0].type).toBe('update');
			expect(operations[0].key).toBe('AA1AA');
			expect(operations[0].record.class).toBe('General');
		});

		it('should create delete operations for deleted records', () => {
			const oldContent = 'callsign,name,class\nAA1AA,John Doe,Extra\nBB2BB,Jane Smith,General\n';
			const newContent = 'callsign,name,class\nAA1AA,John Doe,Extra\n';

			const diff: DiffResult = {
				hasChanges: true,
				added: [],
				modified: [],
				deleted: ['BB2BB'],
				unchanged: 1,
				summary: {
					addedCount: 0,
					modifiedCount: 0,
					deletedCount: 1,
					unchangedCount: 1,
					totalOldRecords: 2,
					totalNewRecords: 1,
				},
				metadata: {
					newVersion: 'v1',
					newHash: 'hash1',
					timestamp: new Date().toISOString(),
				},
			};

			const operations = createPatchOperations(newContent, oldContent, diff, config);

			expect(operations).toHaveLength(1);
			expect(operations[0].type).toBe('delete');
			expect(operations[0].key).toBe('BB2BB');
		});

		it('should create mixed operations', () => {
			const oldContent = 'callsign,name,class\nAA1AA,John Doe,Extra\nBB2BB,Jane Smith,General\n';
			const newContent = 'callsign,name,class\nAA1AA,John Doe,General\nCC3CC,Bob Jones,Technician\n';

			const diff: DiffResult = {
				hasChanges: true,
				added: ['CC3CC'],
				modified: ['AA1AA'],
				deleted: ['BB2BB'],
				unchanged: 0,
				summary: {
					addedCount: 1,
					modifiedCount: 1,
					deletedCount: 1,
					unchangedCount: 0,
					totalOldRecords: 2,
					totalNewRecords: 2,
				},
				metadata: {
					newVersion: 'v1',
					newHash: 'hash1',
					timestamp: new Date().toISOString(),
				},
			};

			const operations = createPatchOperations(newContent, oldContent, diff, config);

			expect(operations).toHaveLength(3);
			
			const insertOps = operations.filter(op => op.type === 'insert');
			const updateOps = operations.filter(op => op.type === 'update');
			const deleteOps = operations.filter(op => op.type === 'delete');

			expect(insertOps).toHaveLength(1);
			expect(updateOps).toHaveLength(1);
			expect(deleteOps).toHaveLength(1);
		});

		it('should handle null old content (first import)', () => {
			const newContent = 'callsign,name,class\nAA1AA,John Doe,Extra\n';

			const diff: DiffResult = {
				hasChanges: true,
				added: ['AA1AA'],
				modified: [],
				deleted: [],
				unchanged: 0,
				summary: {
					addedCount: 1,
					modifiedCount: 0,
					deletedCount: 0,
					unchangedCount: 0,
					totalOldRecords: 0,
					totalNewRecords: 1,
				},
				metadata: {
					newVersion: 'v1',
					newHash: 'hash1',
					timestamp: new Date().toISOString(),
				},
			};

			const operations = createPatchOperations(newContent, null, diff, config);

			expect(operations).toHaveLength(1);
			expect(operations[0].type).toBe('insert');
			expect(operations[0].key).toBe('AA1AA');
		});
	});
});
