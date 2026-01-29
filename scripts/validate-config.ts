#!/usr/bin/env node
/**
 * Configuration Validation CLI Tool
 * 
 * Validates configuration files or KV-stored configurations before deployment.
 * Can be run manually or as part of CI/CD pipelines.
 * 
 * Usage:
 *   # Validate a local JSON file
 *   npm run validate:config -- --file config.json
 * 
 *   # Validate current config in KV (requires wrangler setup)
 *   npm run validate:config -- --kv
 * 
 *   # Validate with verbose output
 *   npm run validate:config -- --file config.json --verbose
 * 
 *   # Output as JSON (for CI integration)
 *   npm run validate:config -- --file config.json --json
 */

import * as fs from 'fs';
import * as path from 'path';
import type { ConfigData, Config } from '../src/types';
import { validateConfigData, validateConfig, formatValidationResult, formatValidationResultJSON } from '../src/validation';

interface CliOptions {
	file?: string;
	kv?: boolean;
	verbose?: boolean;
	json?: boolean;
	help?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): CliOptions {
	const options: CliOptions = {};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		switch (arg) {
			case '--file':
			case '-f':
				options.file = args[++i];
				break;
			case '--kv':
			case '-k':
				options.kv = true;
				break;
			case '--verbose':
			case '-v':
				options.verbose = true;
				break;
			case '--json':
			case '-j':
				options.json = true;
				break;
			case '--help':
			case '-h':
				options.help = true;
				break;
		}
	}

	return options;
}

/**
 * Print help message
 */
function printHelp(): void {
	console.log(`
Configuration Validation Tool
==============================

Validates configuration files or KV-stored configurations before deployment.

Usage:
  npm run validate:config -- [options]

Options:
  --file, -f <path>    Validate a local JSON configuration file
  --kv, -k             Validate configuration stored in Cloudflare KV (requires wrangler)
  --verbose, -v        Show verbose output including warnings
  --json, -j           Output results as JSON (useful for CI)
  --help, -h           Show this help message

Examples:
  # Validate a local config file
  npm run validate:config -- --file config.json

  # Validate config in KV
  npm run validate:config -- --kv

  # Validate with detailed output
  npm run validate:config -- --file config.json --verbose

  # Get JSON output for CI integration
  npm run validate:config -- --file config.json --json

Exit Codes:
  0  Configuration is valid
  1  Validation failed (errors found)
  2  Invalid usage or file not found

Notes:
  - Validation checks all required fields, types, and relationships
  - Warnings are informational and don't cause validation failure
  - Use --json mode for CI/CD pipeline integration
`);
}

/**
 * Validate a configuration file
 */
function validateFile(filePath: string, options: CliOptions): number {
	try {
		// Read and parse the file
		const absolutePath = path.resolve(process.cwd(), filePath);
		
		if (!fs.existsSync(absolutePath)) {
			console.error(`Error: File not found: ${absolutePath}`);
			return 2;
		}

		const fileContent = fs.readFileSync(absolutePath, 'utf-8');
		let configData: ConfigData;

		try {
			const parsed = JSON.parse(fileContent);
			
			// Check if it's a Config object (with data and version) or just ConfigData
			if (parsed.data && parsed.version) {
				configData = parsed.data;
			} else {
				configData = parsed;
			}
		} catch (parseError) {
			console.error('Error: Invalid JSON in configuration file');
			if (options.verbose) {
				console.error((parseError as Error).message);
			}
			return 2;
		}

		// Validate the configuration
		const result = validateConfigData(configData);

		// Output results
		if (options.json) {
			console.log(formatValidationResultJSON(result));
		} else {
			console.log(`\nValidating configuration file: ${filePath}\n`);
			console.log(formatValidationResult(result));
		}

		// Return appropriate exit code
		return result.valid ? 0 : 1;

	} catch (error) {
		console.error('Error validating configuration file:');
		console.error((error as Error).message);
		if (options.verbose) {
			console.error((error as Error).stack);
		}
		return 2;
	}
}

/**
 * Validate configuration in KV using wrangler
 */
async function validateKV(options: CliOptions): Promise<number> {
	try {
		// Check if wrangler is available
		const { execSync } = await import('child_process');
		
		try {
			execSync('wrangler --version', { stdio: 'ignore' });
		} catch {
			console.error('Error: wrangler CLI not found. Please install it with: npm install -g wrangler');
			return 2;
		}

		// Try to get config using wrangler kv:key get
		// Note: This requires CONFIG_KV to be configured in wrangler.toml
		let configJson: string;
		try {
			// Use wrangler to get the key directly
			// This is a simplified approach - in production, consider using wrangler's JS API
			// or parsing wrangler.toml properly with a TOML parser
			configJson = execSync('wrangler kv:key get "config:current" --namespace-id "$(grep CONFIG_KV wrangler.toml | grep -oP \'id = "\\K[^"]+\')" 2>/dev/null', {
				encoding: 'utf-8',
				stdio: ['pipe', 'pipe', 'pipe'],
				shell: '/bin/bash',
			});
		} catch {
			console.error('Error: Could not retrieve configuration from KV.');
			console.error('Make sure:');
			console.error('  1. CONFIG_KV is configured in wrangler.toml');
			console.error('  2. You are authenticated with wrangler (run: wrangler login)');
			console.error('  3. A configuration exists in KV');
			console.error('');
			console.error('Note: For production use, consider using wrangler\'s JavaScript API');
			return 2;
		}

		if (!configJson || configJson.trim() === '') {
			console.error('Error: No configuration found in KV');
			return 2;
		}

		// Parse and validate
		const config = JSON.parse(configJson) as Config;
		const result = validateConfig(config);

		// Output results
		if (options.json) {
			console.log(formatValidationResultJSON(result));
		} else {
			console.log('\nValidating configuration from KV\n');
			console.log(`Version: ${config.version.version}`);
			console.log(`Hash: ${config.version.hash}`);
			console.log(`Last Updated: ${config.version.timestamp}\n`);
			console.log(formatValidationResult(result));
		}

		return result.valid ? 0 : 1;

	} catch (error) {
		console.error('Error validating KV configuration:');
		console.error((error as Error).message);
		if (options.verbose) {
			console.error((error as Error).stack);
		}
		return 2;
	}
}

/**
 * Main function
 */
async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const options = parseArgs(args);

	// Show help if requested or no options provided
	if (options.help || (args.length === 0 && !options.file && !options.kv)) {
		printHelp();
		process.exit(0);
	}

	let exitCode = 0;

	// Validate based on mode
	if (options.file) {
		exitCode = validateFile(options.file, options);
	} else if (options.kv) {
		exitCode = await validateKV(options);
	} else {
		console.error('Error: Please specify either --file or --kv');
		printHelp();
		exitCode = 2;
	}

	process.exit(exitCode);
}

// Run the CLI
main().catch((error) => {
	console.error('Unexpected error:', error);
	process.exit(2);
});
