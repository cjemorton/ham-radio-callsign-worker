# Project Scripts

This directory contains utility scripts for managing the Ham Radio Callsign Worker project.

## Available Scripts

### validate-config.ts

**NEW** - Configuration validation tool for ensuring configuration files are valid before deployment.

**Usage:**
```bash
# Validate a local JSON configuration file
npm run validate:config -- --file examples/configs/valid-config.json

# Validate configuration stored in Cloudflare KV
npm run validate:config -- --kv

# Get verbose output with warnings
npm run validate:config -- --file config.json --verbose

# Get JSON output (useful for CI/CD)
npm run validate:config -- --file config.json --json

# Show help
npm run validate:config -- --help
```

**Features:**
- Comprehensive validation of all configuration fields
- Type checking for all properties
- URL validation for data source endpoints
- Detailed error messages with actionable suggestions
- Warning detection for non-critical issues
- JSON output mode for CI/CD integration
- Support for both local files and KV-stored configs

**What It Validates:**
- **dataSource**: URL validity, required fields, schema structure
- **backupEndpoints**: URL validity for backup sources
- **externalSync**: SQL and Redis endpoint configurations
- **features**: Boolean flag types
- **rateLimits**: Positive numbers for rate limiting
- **cache**: TTL and max entries validation

**Exit Codes:**
- `0`: Configuration is valid
- `1`: Validation failed (errors found)
- `2`: Invalid usage or file not found

**CI/CD Integration:**
The validation tool is automatically run in GitHub Actions when configuration files change. See `.github/workflows/validate-config.yml` for the CI workflow.

**Examples:**

```bash
# Quick validation during development
npm run validate:config -- --file examples/configs/valid-config.json

# Validate before deploying to production
npm run validate:config -- --kv --verbose

# Use in a shell script
if npm run validate:config -- --file config.json --json > validation.json; then
  echo "Config is valid"
else
  echo "Config has errors"
  cat validation.json
  exit 1
fi
```

**Validation Output Example:**
```
Validating configuration file: config.json

✗ Configuration validation failed with 2 error(s):

1. [dataSource.originZipUrl]
   Error: originZipUrl is not a valid URL
   Suggestion: Provide a valid HTTP or HTTPS URL

2. [features.jwtAuth]
   Error: jwtAuth must be a boolean
   Suggestion: Set to true or false

⚠ Found 1 warning(s):

1. [rateLimits]
   Warning: Rate limits not configured
   Suggestion: Add rate limits to prevent abuse
```

See [Configuration Validation](#configuration-validation) section below for more details.

---

### secrets-setup.sh

Interactive helper script for setting up and managing secrets.

**Usage:**
```bash
# Interactive mode (recommended for first-time setup)
./scripts/secrets-setup.sh

# Setup development environment
./scripts/secrets-setup.sh dev

# Setup production environment
./scripts/secrets-setup.sh production

# Setup staging environment
./scripts/secrets-setup.sh staging

# List configured secrets
./scripts/secrets-setup.sh list

# Generate API key only (output to stdout)
./scripts/secrets-setup.sh generate

# Show help
./scripts/secrets-setup.sh --help
```

**Features:**
- Interactive menu-driven interface
- Secure API key generation using `openssl` or Node.js `crypto`
- Automatic `.dev.vars` creation for local development
- Integration with Wrangler CLI for production secrets
- Secret listing (names only, values are never displayed)
- Validation and error checking

**Prerequisites:**
- For key generation: `openssl` (preferred) or `node` must be installed
- For production setup: `wrangler` CLI must be installed and authenticated

**Security Notes:**
- Generated keys are 256-bit (64 hex characters) for strong security
- Keys are displayed only once during generation
- Production keys are stored securely via Wrangler secrets
- Development keys are stored in `.dev.vars` (git-ignored)

See [SECRETS_MANAGEMENT.md](../SECRETS_MANAGEMENT.md) for complete documentation.

---

### setup-git-secrets.sh

Setup git-secrets pre-commit hooks to prevent committing sensitive data.

**Usage:**
```bash
# Run the setup script
./scripts/setup-git-secrets.sh
```

**Features:**
- Installs git-secrets pre-commit hooks
- Registers AWS secret patterns
- Adds custom patterns for this project (API keys, tokens, passwords)
- Configures allowed patterns (exceptions for documentation examples)

**Prerequisites:**
- `git-secrets` must be installed:
  - macOS: `brew install git-secrets`
  - Linux: Clone and `make install` from [awslabs/git-secrets](https://github.com/awslabs/git-secrets)

**What It Protects:**
- API keys and tokens (including 64-char hex keys)
- Passwords and secret keys
- Database connection strings
- Private keys
- JWT tokens
- Environment variable assignments with secrets

**Manual Commands:**
```bash
# Scan current changes
git secrets --scan

# Scan entire repository history
git secrets --scan-history

# List all registered patterns
git secrets --list
```

---

### validate-secrets.sh

Validate that secrets are properly configured and no secrets are accidentally committed.

**Usage:**
```bash
# Run validation checks
./scripts/validate-secrets.sh

# Run in CI mode (exit with error if issues found)
./scripts/validate-secrets.sh --ci
```

**What It Checks:**
1. `.gitignore` contains required secret patterns
2. No `.dev.vars` is committed to git
3. `.dev.vars.example` template exists
4. No obvious secrets in tracked files
5. Required documentation exists
6. Scripts are executable
7. Test files don't contain hardcoded secrets
8. `wrangler.toml` doesn't contain secrets in vars section

**Exit Codes:**
- `0`: All checks passed (or warnings only in non-CI mode)
- `1`: Validation failed with errors

**CI Integration:**
Add to GitHub Actions workflow:
```yaml
- name: Validate Secrets
  run: ./scripts/validate-secrets.sh --ci
```

---

### demo-secret-injection.sh

Demonstration and validation that secrets are properly injected and not hardcoded.

**Usage:**
```bash
./scripts/demo-secret-injection.sh
```

**What It Does:**
1. Verifies no hardcoded secrets in source code
2. Shows how secrets are accessed via environment bindings
3. Checks TypeScript type definitions for secrets
4. Validates development secret configuration
5. Demonstrates production secret management
6. Provides comprehensive security summary

**Example Output:**
```
✓ No secrets hardcoded in source code
✓ Secrets accessed via env bindings (env.ADMIN_API_KEY)
✓ Type definitions ensure safe secret access
✓ Development: .dev.vars (git-ignored)
✓ Production: Wrangler secrets (encrypted)
```

**Use Cases:**
- Onboarding new developers
- Security audits
- CI/CD validation
- Documentation and training
- Verifying secret injection works correctly

**Exit Codes:**
- `0`: All checks passed, secrets properly configured
- `1`: Hardcoded secrets found or configuration issues

---

## Configuration Validation

### Why Validate Configuration?

Configuration errors can cause:
- Service outages and downtime
- Data processing failures
- Security vulnerabilities
- Difficult-to-debug runtime errors

The validation tool catches these issues **before deployment**, ensuring configurations are correct and complete.

### Validation Workflow

```
┌─────────────────┐
│ Edit Config     │
│ File            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Run Validation  │
│ Tool            │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌────────┐
│ Valid │ │ Errors │
└───┬───┘ └───┬────┘
    │         │
    │         ▼
    │    ┌────────────┐
    │    │ Fix Errors │
    │    └─────┬──────┘
    │          │
    │          └──────┐
    │                 │
    ▼                 ▼
┌─────────────────────┐
│ Commit & Push       │
└──────────┬──────────┘
           │
           ▼
┌──────────────────────┐
│ CI Validates         │
│ Automatically        │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Deploy if Valid      │
└──────────────────────┘
```

### Local Validation

Before committing configuration changes:

```bash
# Validate your config file
npm run validate:config -- --file examples/configs/my-config.json

# Get detailed output
npm run validate:config -- --file examples/configs/my-config.json --verbose
```

### CI/CD Validation

Configuration validation runs automatically in CI when:
- Configuration files in `examples/configs/` change
- Config-related source files change
- On pull requests and main branch pushes

The CI workflow:
1. Validates all configuration files
2. Posts results as PR comments
3. **Blocks merge if validation fails**
4. Provides actionable error messages

### Common Validation Errors

#### Invalid URL
```
Error: originZipUrl is not a valid URL
Suggestion: Provide a valid HTTP or HTTPS URL
```
**Fix:** Use a complete URL with `http://` or `https://` protocol.

#### Missing Required Field
```
Error: Missing zipFileName
Suggestion: Provide the name of the ZIP file (e.g., "l_amat.zip")
```
**Fix:** Add the missing field to your configuration.

#### Invalid Type
```
Error: jwtAuth must be a boolean
Suggestion: Set to true or false
```
**Fix:** Change string values like `"yes"` to boolean `true` or `false`.

#### Empty Array
```
Error: expectedSchema.fields must not be empty
Suggestion: Add at least one field name to the array
```
**Fix:** Add field names to the array: `["callsign", "operator_class"]`

### Configuration Best Practices

1. **Always validate locally** before committing
2. **Use example configs** as templates
3. **Test with actual data** when possible
4. **Document custom configurations** with comments (in JSON: use description fields)
5. **Keep backups** of working configurations
6. **Review validation warnings** even if config is valid

### Adding Custom Validations

To add new validation rules:

1. Edit `src/validation.ts`
2. Add validation logic to `validateConfigData()`
3. Add tests in `test/validation.test.ts`
4. Update documentation

Example:
```typescript
// In src/validation.ts
if (data.cache && data.cache.ttl > 86400) {
  warnings.push({
    field: 'cache.ttl',
    message: 'TTL is very high (>24 hours)',
    severity: 'warning',
    suggestion: 'Consider a lower TTL for fresher data'
  });
}
```

---

## Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| **Storage** | `.dev.vars` file | Wrangler secrets |
| **Setup Command** | `./scripts/secrets-setup.sh dev` | `./scripts/secrets-setup.sh production` |
| **Committed to Git** | ❌ No (in .gitignore) | ❌ No (stored in Cloudflare) |
| **Readable** | ✅ Yes (local file) | ❌ No (encrypted, write-only) |
| **Rotation** | Generate new `.dev.vars` | `wrangler secret put` |

## Adding New Scripts

When adding new scripts to this directory:

1. Make scripts executable: `chmod +x scripts/your-script.sh`
2. Add a shebang line at the top: `#!/bin/bash` or `#!/usr/bin/env node`
3. Include usage documentation in the script header
4. Update this README with script description and usage
5. Test scripts in both development and production environments
6. Follow security best practices (never log secrets, validate inputs)

## Security Guidelines for Scripts

- **Never hardcode secrets** in scripts
- **Never log secret values** (names only)
- **Validate all inputs** to prevent injection attacks
- **Use secure random generation** for keys and tokens
- **Check prerequisites** before executing sensitive operations
- **Provide clear error messages** without exposing system details
- **Use exit codes** properly (0 for success, non-zero for errors)

## Common Tasks

### Generate a Strong API Key
```bash
# Method 1: Using the script
./scripts/secrets-setup.sh generate

# Method 2: Using openssl directly
openssl rand -hex 32

# Method 3: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Quick Development Setup
```bash
# One-line setup for development
./scripts/secrets-setup.sh dev && npm run dev
```

### Rotate Production API Key
```bash
# Generate and set a new production key
./scripts/secrets-setup.sh production

# Update your API clients with the new key
# Old key continues to work until you delete it
```

## Troubleshooting

### "Command not found" Error
Make sure the script is executable:
```bash
chmod +x scripts/secrets-setup.sh
```

### "Cannot generate random key" Error
Install either `openssl` (recommended) or Node.js:
```bash
# macOS
brew install openssl

# Ubuntu/Debian
sudo apt-get install openssl

# Or install Node.js
# See https://nodejs.org/
```

### "Not logged in to Wrangler" Error
Authenticate with Cloudflare:
```bash
wrangler login
```

### Script Fails with "Must be run from project root"
Navigate to the project root directory:
```bash
cd /path/to/ham-radio-callsign-worker
./scripts/secrets-setup.sh
```

## Related Documentation

- [SECRETS_MANAGEMENT.md](../SECRETS_MANAGEMENT.md) - Complete secrets management guide
- [README.md](../README.md) - Project overview and setup
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture
- [CONTRIBUTING.md](../CONTRIBUTING.md) - Contribution guidelines
