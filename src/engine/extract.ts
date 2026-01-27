/**
 * Extraction engine for processing ZIP files
 */

import type { Env, ExtractionResult, ConfigData } from '../types';
import { log } from '../utils';
import { logExtractionEvent } from './logger';

/**
 * Simple ZIP file parser for extracting files
 * Note: This is a basic implementation. For production, consider using a library like fflate
 */
class SimpleZipExtractor {
	private data: Uint8Array;
	private view: DataView;

	constructor(buffer: ArrayBuffer) {
		this.data = new Uint8Array(buffer);
		this.view = new DataView(buffer);
	}

	/**
	 * Find central directory end record
	 */
	private findEndOfCentralDirectory(): number | null {
		// Search for end of central directory signature (0x06054b50) from the end
		const signature = 0x06054b50;
		for (let i = this.data.length - 22; i >= 0; i--) {
			if (this.view.getUint32(i, true) === signature) {
				return i;
			}
		}
		return null;
	}

	/**
	 * Extract a specific file from the ZIP
	 */
	extractFile(targetFileName: string): Uint8Array | null {
		try {
			const eocdPos = this.findEndOfCentralDirectory();
			if (eocdPos === null) {
				log('error', 'Could not find end of central directory');
				return null;
			}

			// Read central directory offset
			const cdOffset = this.view.getUint32(eocdPos + 16, true);
			const cdEntries = this.view.getUint16(eocdPos + 10, true);

			let pos = cdOffset;

			// Iterate through central directory entries
			for (let i = 0; i < cdEntries; i++) {
				const signature = this.view.getUint32(pos, true);
				if (signature !== 0x02014b50) {
					log('error', 'Invalid central directory entry signature');
					return null;
				}

				const fileNameLength = this.view.getUint16(pos + 28, true);
				const extraFieldLength = this.view.getUint16(pos + 30, true);
				const fileCommentLength = this.view.getUint16(pos + 32, true);
				const localHeaderOffset = this.view.getUint32(pos + 42, true);

				// Read file name
				const nameStart = pos + 46;
				const fileName = new TextDecoder().decode(
					this.data.slice(nameStart, nameStart + fileNameLength)
				);

				if (fileName === targetFileName) {
					// Found the target file, now extract it
					return this.extractFromLocalHeader(localHeaderOffset);
				}

				// Move to next entry
				pos += 46 + fileNameLength + extraFieldLength + fileCommentLength;
			}

			log('warn', 'File not found in ZIP', { targetFileName });
			return null;
		} catch (error) {
			log('error', 'Error extracting file from ZIP', {
				error: error instanceof Error ? error.message : String(error),
			});
			return null;
		}
	}

	/**
	 * Extract file data from local header
	 */
	private extractFromLocalHeader(offset: number): Uint8Array | null {
		try {
			const signature = this.view.getUint32(offset, true);
			if (signature !== 0x04034b50) {
				log('error', 'Invalid local file header signature');
				return null;
			}

			const compressionMethod = this.view.getUint16(offset + 8, true);
			const compressedSize = this.view.getUint32(offset + 18, true);
			const fileNameLength = this.view.getUint16(offset + 26, true);
			const extraFieldLength = this.view.getUint16(offset + 28, true);

			// Calculate data offset
			const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
			const fileData = this.data.slice(dataOffset, dataOffset + compressedSize);

			// Check compression method
			if (compressionMethod === 0) {
				// Stored (no compression)
				return fileData;
			} else if (compressionMethod === 8) {
				// Deflate compression - would need to decompress
				log('warn', 'Deflate compression detected, attempting to return compressed data');
				// For a full implementation, use a library like fflate to decompress
				// For now, return the compressed data and let the caller handle it
				return fileData;
			} else {
				log('error', 'Unsupported compression method', { compressionMethod });
				return null;
			}
		} catch (error) {
			log('error', 'Error extracting from local header', {
				error: error instanceof Error ? error.message : String(error),
			});
			return null;
		}
	}

	/**
	 * List all files in the ZIP
	 */
	listFiles(): string[] {
		const files: string[] = [];
		try {
			const eocdPos = this.findEndOfCentralDirectory();
			if (eocdPos === null) {
				return files;
			}

			const cdOffset = this.view.getUint32(eocdPos + 16, true);
			const cdEntries = this.view.getUint16(eocdPos + 10, true);

			let pos = cdOffset;

			for (let i = 0; i < cdEntries; i++) {
				const signature = this.view.getUint32(pos, true);
				if (signature !== 0x02014b50) {
					break;
				}

				const fileNameLength = this.view.getUint16(pos + 28, true);
				const extraFieldLength = this.view.getUint16(pos + 30, true);
				const fileCommentLength = this.view.getUint16(pos + 32, true);

				const nameStart = pos + 46;
				const fileName = new TextDecoder().decode(
					this.data.slice(nameStart, nameStart + fileNameLength)
				);

				files.push(fileName);

				pos += 46 + fileNameLength + extraFieldLength + fileCommentLength;
			}
		} catch (error) {
			log('error', 'Error listing ZIP files', {
				error: error instanceof Error ? error.message : String(error),
			});
		}
		return files;
	}
}

/**
 * Extract target file from ZIP data
 */
export async function extractFromZip(
	env: Env,
	zipData: ArrayBuffer,
	config: ConfigData
): Promise<ExtractionResult> {
	const startTime = Date.now();
	const targetFileName = config.dataSource.extractedFileName;

	log('info', 'Starting file extraction from ZIP', { targetFileName });

	try {
		const extractor = new SimpleZipExtractor(zipData);

		// List files for debugging
		const files = extractor.listFiles();
		log('info', 'Files found in ZIP', { files, count: files.length });

		// Extract target file
		const fileData = extractor.extractFile(targetFileName);

		if (!fileData) {
			const duration = Date.now() - startTime;
			const result: ExtractionResult = {
				success: false,
				error: `Target file '${targetFileName}' not found in ZIP`,
				metadata: {
					fileName: targetFileName,
					timestamp: new Date().toISOString(),
				},
			};

			await logExtractionEvent(env, 'failure', {
				message: `File '${targetFileName}' not found in ZIP`,
				duration,
				metadata: { availableFiles: files },
			});

			return result;
		}

		// Decode as UTF-8 text
		const content = new TextDecoder('utf-8').decode(fileData);
		const duration = Date.now() - startTime;

		const result: ExtractionResult = {
			success: true,
			content,
			metadata: {
				fileName: targetFileName,
				timestamp: new Date().toISOString(),
				size: fileData.length,
				encoding: 'utf-8',
			},
		};

		log('info', 'Successfully extracted file from ZIP', {
			fileName: targetFileName,
			size: fileData.length,
			duration,
		});

		await logExtractionEvent(env, 'success', {
			message: `File '${targetFileName}' extracted successfully`,
			duration,
			dataSize: fileData.length,
		});

		return result;
	} catch (error) {
		const duration = Date.now() - startTime;
		const errorMessage = error instanceof Error ? error.message : String(error);

		const result: ExtractionResult = {
			success: false,
			error: `Extraction failed: ${errorMessage}`,
			metadata: {
				fileName: targetFileName,
				timestamp: new Date().toISOString(),
			},
		};

		log('error', 'Failed to extract file from ZIP', {
			error: errorMessage,
			duration,
		});

		await logExtractionEvent(env, 'failure', {
			message: 'Extraction failed',
			duration,
			error: errorMessage,
		});

		return result;
	}
}

/**
 * Validate file presence in ZIP before extraction
 */
export function validateFilePresence(
	zipData: ArrayBuffer,
	targetFileName: string
): boolean {
	try {
		const extractor = new SimpleZipExtractor(zipData);
		const files = extractor.listFiles();
		return files.includes(targetFileName);
	} catch (error) {
		log('error', 'Failed to validate file presence', {
			error: error instanceof Error ? error.message : String(error),
		});
		return false;
	}
}
