# Configuration Validation Guide

This guide explains how to use the automated configuration validation tool to ensure your configurations are valid before deployment.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Command Line Interface](#command-line-interface)
- [CI/CD Integration](#cicd-integration)
- [Validation Rules](#validation-rules)
- [Error Messages](#error-messages)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

## Overview

The configuration validation tool provides:

- ✅ **Pre-deployment validation** - Catch errors before they reach production
- ✅ **Detailed diagnostics** - Clear error messages with actionable suggestions
- ✅ **CI integration** - Automatic validation in pull requests
- ✅ **Multiple modes** - Validate local files or KV-stored configs
- ✅ **JSON output** - Machine-readable output for automation

## Quick Start

### Install Dependencies

```bash
npm install
```

### Validate a Configuration File

```bash
npm run validate:config -- --file examples/configs/valid-config.json
```

### Expected Output

```
Validating configuration file: examples/configs/valid-config.json

✓ Configuration is valid with no warnings
```

## Command Line Interface

### Basic Usage

```bash
npm run validate:config -- [options]
```

### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--file <path>` | `-f` | Validate a local JSON configuration file |
| `--kv` | `-k` | Validate configuration stored in Cloudflare KV |
| `--verbose` | `-v` | Show verbose output including warnings |
| `--json` | `-j` | Output results as JSON (useful for CI) |
| `--help` | `-h` | Show help message |

### Examples

#### Validate a local file
```bash
npm run validate:config -- --file config.json
```

#### Validate with verbose output
```bash
npm run validate:config -- --file config.json --verbose
```

#### Get JSON output for automation
```bash
npm run validate:config -- --file config.json --json
```

#### Validate KV-stored configuration
```bash
npm run validate:config -- --kv
```

### Exit Codes

- `0` - Configuration is valid
- `1` - Validation failed (errors found)
- `2` - Invalid usage or file not found

## CI/CD Integration

### GitHub Actions Workflow

The validation tool automatically runs in CI when:

- Configuration files change
- Configuration-related source files change
- Pull requests are opened or updated

Workflow file: `.github/workflows/validate-config.yml`

### What the CI Does

1. **Validates all config files** in `examples/configs/`
2. **Posts results** as PR comments
3. **Blocks merge** if validation fails
4. **Provides actionable feedback** in the PR

### Example CI Output

```markdown
## Configuration Validation Results

### Validating: `examples/configs/prod-config.json`
✅ **Valid**

### Validating: `examples/configs/test-config.json`
❌ **Invalid**

[dataSource.originZipUrl]
Error: originZipUrl is not a valid URL
Suggestion: Provide a valid HTTP or HTTPS URL

---
❌ **Configuration validation failed. Please fix the errors above.**
```

### Manual Workflow Trigger

You can manually trigger validation from GitHub Actions:

1. Go to Actions → Validate Configuration
2. Click "Run workflow"
3. Optionally specify a config file path
4. Click "Run workflow"

## Validation Rules

### Required Fields

#### dataSource (Required)

```json
{
  "dataSource": {
    "originZipUrl": "https://...",      // Must be valid HTTP/HTTPS URL
    "zipFileName": "l_amat.zip",        // Required string
    "extractedFileName": "AM.dat",      // Required string
    "expectedSchema": {
      "fields": ["field1", "field2"],   // Non-empty array of strings
      "delimiter": "|",                 // Optional string
      "hasHeader": false                // Optional boolean
    }
  }
}
```

#### features (Required)

```json
{
  "features": {
    "jwtAuth": false,           // Must be boolean
    "canaryDeployment": false,  // Must be boolean
    "advancedSearch": true,     // Must be boolean
    "dataExport": true,         // Must be boolean
    "externalSync": false       // Must be boolean
  }
}
```

### Optional but Validated Fields

#### backupEndpoints (Optional)

```json
{
  "backupEndpoints": {
    "primary": "https://...",     // Must be valid HTTP/HTTPS URL
    "secondary": "https://...",   // Must be valid HTTP/HTTPS URL
    "tertiary": "https://..."     // Must be valid HTTP/HTTPS URL
  }
}
```

#### rateLimits (Optional, but generates warning if missing)

```json
{
  "rateLimits": {
    "user": {
      "requestsPerMinute": 100,   // Must be positive number
      "burstSize": 10             // Optional, non-negative number
    },
    "admin": {
      "requestsPerMinute": 1000,  // Must be positive number
      "burstSize": 50             // Optional, non-negative number
    }
  }
}
```

#### cache (Optional, but generates warning if missing)

```json
{
  "cache": {
    "ttl": 3600,        // Must be positive number
    "maxEntries": 10000 // Optional, must be positive number
  }
}
```

#### externalSync (Optional)

```json
{
  "externalSync": {
    "sql": {
      "enabled": false,     // Must be boolean
      "endpoints": [
        {
          "id": "db1",                    // Required string
          "type": "postgresql",           // Required, one of: postgresql, mysql, mariadb, sqlite, mssql
          "endpoint": "postgres://...",   // Required string
          "tableName": "callsigns",       // Optional string
          "enabled": true,                // Required boolean
          "priority": 1                   // Optional number
        }
      ]
    },
    "redis": {
      "enabled": false,     // Must be boolean
      "endpoints": [
        {
          "id": "redis1",           // Required string
          "endpoint": "redis://...", // Required string
          "ttl": 3600,              // Optional, positive number
          "keyPrefix": "ham:",      // Optional string
          "enabled": true           // Required boolean
        }
      ]
    }
  }
}
```

### Type Validation

The validator checks:

- ✅ String fields are strings
- ✅ Boolean fields are booleans
- ✅ Number fields are numbers
- ✅ Arrays are arrays
- ✅ Objects are objects
- ✅ URLs are valid HTTP/HTTPS URLs
- ✅ Numbers are in valid ranges (positive, non-negative, etc.)

## Error Messages

### Error vs Warning

**Errors** (❌) - Block deployment, must be fixed:
- Missing required fields
- Invalid types
- Invalid URLs
- Invalid enum values
- Empty required arrays

**Warnings** (⚠️) - Informational, don't block deployment:
- Missing optional but recommended fields
- Suboptimal values
- Potential issues

### Common Errors and Fixes

#### 1. Invalid URL

```
Error: originZipUrl is not a valid URL
Suggestion: Provide a valid HTTP or HTTPS URL
```

**Cause:** URL is malformed or uses an unsupported protocol (e.g., FTP)

**Fix:**
```json
// ❌ Bad
"originZipUrl": "not-a-url"
"originZipUrl": "ftp://example.com/file.zip"

// ✅ Good
"originZipUrl": "https://data.fcc.gov/download/pub/uls/complete/l_amat.zip"
```

#### 2. Wrong Type

```
Error: jwtAuth must be a boolean
Suggestion: Set to true or false
```

**Cause:** Field has wrong type

**Fix:**
```json
// ❌ Bad
"jwtAuth": "yes"
"jwtAuth": 1

// ✅ Good
"jwtAuth": true
"jwtAuth": false
```

#### 3. Empty Array

```
Error: expectedSchema.fields must not be empty
Suggestion: Add at least one field name to the array
```

**Cause:** Required array is empty

**Fix:**
```json
// ❌ Bad
"fields": []

// ✅ Good
"fields": ["record_type", "callsign", "operator_class"]
```

#### 4. Missing Required Field

```
Error: Missing zipFileName
Suggestion: Provide the name of the ZIP file (e.g., "l_amat.zip")
```

**Cause:** Required field is not present

**Fix:**
```json
// ❌ Bad
{
  "dataSource": {
    "originZipUrl": "https://..."
    // zipFileName missing
  }
}

// ✅ Good
{
  "dataSource": {
    "originZipUrl": "https://...",
    "zipFileName": "l_amat.zip"
  }
}
```

#### 5. Invalid Database Type

```
Error: Invalid database type: postgres
Suggestion: Use one of: postgresql, mysql, mariadb, sqlite, mssql
```

**Cause:** Database type uses wrong name

**Fix:**
```json
// ❌ Bad
"type": "postgres"

// ✅ Good
"type": "postgresql"
```

## Examples

### Minimal Valid Configuration

```json
{
  "dataSource": {
    "originZipUrl": "https://data.fcc.gov/download/pub/uls/complete/l_amat.zip",
    "zipFileName": "l_amat.zip",
    "extractedFileName": "AM.dat",
    "expectedSchema": {
      "fields": ["callsign", "operator_class"]
    }
  },
  "features": {
    "jwtAuth": false,
    "canaryDeployment": false,
    "advancedSearch": false,
    "dataExport": false,
    "externalSync": false
  }
}
```

### Complete Valid Configuration

See `examples/configs/valid-config.json` for a complete example with all optional fields.

### Testing Your Configuration

1. **Create or edit** your configuration file
2. **Validate locally:**
   ```bash
   npm run validate:config -- --file path/to/your/config.json
   ```
3. **Fix any errors** reported
4. **Review warnings** and decide if they need addressing
5. **Commit and push** when validation passes
6. **CI will re-validate** automatically

### Automation Example

Use in shell scripts:

```bash
#!/bin/bash

# Validate configuration
if npm run validate:config -- --file config.json --json > result.json; then
  echo "✅ Configuration is valid"
  # Deploy
  npm run deploy
else
  echo "❌ Configuration is invalid"
  cat result.json
  exit 1
fi
```

## Troubleshooting

### "File not found" Error

**Problem:** Configuration file doesn't exist

**Solution:**
- Check the file path is correct
- Use absolute or relative path from project root
- Verify file exists: `ls -la path/to/config.json`

### "Invalid JSON" Error

**Problem:** Configuration file is not valid JSON

**Solution:**
- Check for syntax errors (missing commas, quotes, brackets)
- Use a JSON validator: https://jsonlint.com/
- Use an IDE with JSON validation (VS Code, etc.)

### "wrangler not found" Error

**Problem:** Trying to validate KV config but wrangler not installed

**Solution:**
```bash
npm install -g wrangler
# or use local wrangler
npx wrangler --version
```

### "Could not retrieve configuration from KV" Error

**Problem:** Cannot access KV namespace

**Solution:**
1. Check `wrangler.toml` has `CONFIG_KV` namespace configured
2. Authenticate with wrangler: `wrangler login`
3. Ensure configuration exists in KV
4. Check namespace ID is correct

### CLI Hangs or Doesn't Exit

**Problem:** Process doesn't complete

**Solution:**
- Press Ctrl+C to cancel
- Check if file path is correct
- Try with `--verbose` flag for more info
- Check Node.js version (requires Node 18+)

## Best Practices

1. ✅ **Validate before committing** - Always run validation locally
2. ✅ **Use version control** - Track configuration changes in git
3. ✅ **Test with real data** - Use realistic values when testing
4. ✅ **Review warnings** - Even if config is valid, warnings may indicate issues
5. ✅ **Document custom configs** - Add comments explaining non-standard values
6. ✅ **Keep examples updated** - Update example configs when schema changes
7. ✅ **Use CI validation** - Let CI catch errors automatically
8. ✅ **Monitor after deployment** - Check config health endpoint after changes

## Related Documentation

- [scripts/README.md](scripts/README.md) - All project scripts
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [CONTRIBUTING.md](CONTRIBUTING.md) - Contribution guidelines
- [src/validation.ts](src/validation.ts) - Validation source code
- [test/validation.test.ts](test/validation.test.ts) - Validation tests

## Support

If you encounter issues:

1. Check this documentation
2. Review error messages carefully
3. Check example configurations
4. Review validation source code
5. Open an issue on GitHub
