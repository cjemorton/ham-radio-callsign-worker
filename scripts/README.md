# Project Scripts

This directory contains utility scripts for managing the Ham Radio Callsign Worker project.

## Available Scripts

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
