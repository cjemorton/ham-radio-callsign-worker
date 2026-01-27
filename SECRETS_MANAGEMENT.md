# Secrets Management Guide

This document provides comprehensive guidance on managing secrets, API keys, and sensitive credentials for the Ham Radio Callsign Worker project.

## Table of Contents

- [Overview](#overview)
- [Secret Types](#secret-types)
- [Setup Instructions](#setup-instructions)
  - [Development Environment](#development-environment)
  - [Production Environment](#production-environment)
- [Secret Storage Methods](#secret-storage-methods)
- [Secret Rotation](#secret-rotation)
- [Best Practices](#best-practices)
- [CI/CD Security](#cicd-security)
- [Troubleshooting](#troubleshooting)
- [Security Checklist](#security-checklist)

## Overview

This project uses Cloudflare Workers and follows security best practices for secret management:

- **No secrets in source code**: All sensitive data is stored externally
- **Wrangler Secrets**: Primary method for sensitive environment variables
- **Encrypted KV Storage**: For configuration that may contain sensitive endpoints
- **Least Privilege**: Secrets are only accessible to authorized services and personnel
- **Audit Trail**: All secret access is logged (where applicable)

## Secret Types

### 1. Worker Secrets (Sensitive)

These are secrets required by the Cloudflare Worker at runtime:

| Secret Name | Purpose | Required | Storage Method |
|-------------|---------|----------|----------------|
| `ADMIN_API_KEY` | Admin endpoint authentication | Yes | Wrangler Secret |

### 2. Configuration Secrets (Semi-Sensitive)

These may be stored in KV but should be treated with care:

| Configuration | Purpose | Storage Method |
|---------------|---------|----------------|
| External SQL endpoints | Database synchronization | CONFIG_KV (encrypted) |
| Redis endpoints | Cache synchronization | CONFIG_KV (encrypted) |
| Backup data source URLs | Fallback data sources | CONFIG_KV |

### 3. CI/CD Secrets

These are required for automated deployments and workflows:

| Secret Name | Purpose | Storage Location |
|-------------|---------|------------------|
| `CLOUDFLARE_API_TOKEN` | Wrangler deployment | GitHub Actions Secrets |
| `GITHUB_TOKEN` | Issue creation, PR comments | GitHub (automatic) |

## Setup Instructions

### Development Environment

#### 1. Initial Setup

```bash
# Clone the repository
git clone https://github.com/cjemorton/ham-radio-callsign-worker.git
cd ham-radio-callsign-worker

# Install dependencies
npm install
```

#### 2. Configure Local Secrets

For local development, create a `.dev.vars` file (git-ignored):

```bash
# Copy the example file
cp .dev.vars.example .dev.vars

# Edit with your local secrets
# .dev.vars
ADMIN_API_KEY=dev-test-key-12345-do-not-use-in-production
```

> **⚠️ Important**: Never commit `.dev.vars` to version control. It's already in `.gitignore`.

#### 3. Generate a Strong API Key

```bash
# Generate a secure random API key (Linux/macOS)
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### 4. Run Development Server

```bash
# Start the local dev server
npm run dev

# The worker will be available at http://localhost:8787
```

#### 5. Test Authentication

```bash
# Test that admin endpoints require authentication
curl http://localhost:8787/admin/stats

# Should return 401 Unauthorized

# Test with your API key
curl -H "X-API-Key: dev-test-key-12345-do-not-use-in-production" \
     http://localhost:8787/admin/stats
```

### Production Environment

#### 1. Create Cloudflare Resources

```bash
# Login to Cloudflare
wrangler login

# Create KV namespaces (if not already created)
wrangler kv:namespace create "CALLSIGN_CACHE"
wrangler kv:namespace create "METADATA_STORE"
wrangler kv:namespace create "CONFIG_KV"

# Create D1 database
wrangler d1 create ham-radio-callsigns

# Create R2 bucket
wrangler r2 bucket create callsign-exports
```

#### 2. Update `wrangler.toml`

Update the binding IDs in `wrangler.toml` with the IDs from the previous step:

```toml
[[kv_namespaces]]
binding = "CALLSIGN_CACHE"
id = "your_actual_kv_namespace_id"

[[kv_namespaces]]
binding = "METADATA_STORE"
id = "your_actual_metadata_namespace_id"

[[kv_namespaces]]
binding = "CONFIG_KV"
id = "your_actual_config_namespace_id"

[[d1_databases]]
binding = "CALLSIGN_DB"
database_name = "ham-radio-callsigns"
database_id = "your_actual_d1_database_id"

[[r2_buckets]]
binding = "DATA_EXPORTS"
bucket_name = "callsign-exports"
```

#### 3. Set Production Secrets

```bash
# Set the admin API key
wrangler secret put ADMIN_API_KEY

# You'll be prompted to enter the secret value
# Use a strong, randomly generated key (see generation commands above)
```

#### 4. Verify Secrets

```bash
# List all secrets (shows names only, not values)
wrangler secret list

# Expected output:
# ADMIN_API_KEY
```

#### 5. Deploy to Production

```bash
# Deploy the worker
npm run deploy

# Or deploy to a specific environment
wrangler deploy --env production
```

#### 6. Test Production Deployment

```bash
# Replace with your actual worker URL and API key
export WORKER_URL="https://your-worker.workers.dev"
export ADMIN_API_KEY="your-production-api-key"

# Test health endpoint (no auth required)
curl $WORKER_URL/health

# Test admin endpoint (requires auth)
curl -H "Authorization: Bearer $ADMIN_API_KEY" \
     $WORKER_URL/admin/stats
```

## Secret Storage Methods

### Wrangler Secrets (Recommended for Sensitive Data)

**Use for**: API keys, tokens, passwords

**Advantages**:
- Encrypted at rest and in transit
- Not visible in Cloudflare dashboard
- Accessible only to the worker at runtime
- Cannot be read via API (write-only)

**Commands**:
```bash
# Add or update a secret
wrangler secret put SECRET_NAME

# Delete a secret
wrangler secret delete SECRET_NAME

# List secrets (names only)
wrangler secret list
```

### KV Storage (For Configuration)

**Use for**: Non-sensitive configuration, or encrypted sensitive configuration

**Advantages**:
- Can be updated without redeployment
- Supports versioning
- Can be read and written via API
- Suitable for dynamic configuration

**Important**: If storing sensitive data in KV, encrypt it first using a key stored as a Wrangler secret.

**Example**:
```typescript
// Storing configuration in KV
await env.CONFIG_KV.put('config', JSON.stringify(configData));

// Reading configuration
const configStr = await env.CONFIG_KV.get('config');
const config = JSON.parse(configStr);
```

### Environment Variables (Non-Sensitive Only)

**Use for**: Public configuration like environment names, log levels

**Defined in**: `wrangler.toml`

```toml
[vars]
ENVIRONMENT = "production"
LOG_LEVEL = "warn"
```

## Secret Rotation

Regular secret rotation is a security best practice. Follow these procedures:

### Rotating Admin API Key

#### Zero-Downtime Rotation (Recommended)

1. **Phase 1: Add New Key Support**
   ```bash
   # Add a secondary API key
   wrangler secret put ADMIN_API_KEY_NEW
   ```

2. **Phase 2: Update Code to Accept Both Keys** (temporary)
   ```typescript
   const validKeys = [env.ADMIN_API_KEY, env.ADMIN_API_KEY_NEW].filter(Boolean);
   const isValid = validKeys.includes(apiKey);
   ```

3. **Phase 3: Deploy Updated Code**
   ```bash
   wrangler deploy
   ```

4. **Phase 4: Update All Clients** to use the new key

5. **Phase 5: Remove Old Key**
   ```bash
   wrangler secret delete ADMIN_API_KEY
   wrangler secret put ADMIN_API_KEY  # Use the new key value
   wrangler secret delete ADMIN_API_KEY_NEW
   ```

6. **Phase 6: Revert Code** to use single key validation

#### Simple Rotation (Brief Downtime)

```bash
# Generate new API key
NEW_KEY=$(openssl rand -hex 32)

# Update the secret
wrangler secret put ADMIN_API_KEY
# Paste the new key when prompted

# Update all clients with the new key immediately
```

### Rotation Schedule

Recommended rotation schedule:

- **Admin API Keys**: Every 90 days or immediately upon:
  - Employee offboarding
  - Suspected compromise
  - Compliance requirements
  - Annual security audit

- **CI/CD Tokens**: Every 180 days or when:
  - Team member with access leaves
  - Token scope changes
  - Security incident occurs

## Best Practices

### 1. Never Commit Secrets

**❌ Never do this:**
```typescript
// DO NOT hardcode secrets!
const apiKey = 'sk-1234567890abcdef';
```

**✅ Always do this:**
```typescript
// Read from environment
const apiKey = env.ADMIN_API_KEY;
```

### 2. Use Strong Secrets

```bash
# Generate strong random secrets (32+ bytes)
openssl rand -hex 32

# Example output:
# 7f9c8e2a5b1d4f6a8c3e7b9d2f5a8c1e4b7d9f2a5c8e1b4d7f9c2e5a8b1d4f6a
```

### 3. Validate Secret Presence

```typescript
// Always check if secrets are configured
if (!env.ADMIN_API_KEY) {
  throw new Error('ADMIN_API_KEY is not configured');
}
```

### 4. Minimize Secret Scope

- Use different secrets for different environments (dev, staging, prod)
- Use different secrets for different services
- Follow the principle of least privilege

### 5. Log Security Events (Without Leaking Secrets)

**✅ Good logging:**
```typescript
log('info', 'Admin authentication successful', {
  timestamp: Date.now(),
  endpoint: '/admin/stats'
});
```

**❌ Bad logging:**
```typescript
// DO NOT log secrets!
log('debug', 'Auth with key: ' + apiKey);  // NEVER DO THIS
```

### 6. Regular Audits

- Review who has access to secrets quarterly
- Audit secret usage in logs
- Check for any secrets accidentally committed to git
- Verify all secrets are properly rotated

### 7. Use `.gitignore`

Ensure these patterns are in `.gitignore`:
```
.env
.env.*
.dev.vars
*.secret
*.key
```

### 8. Secure Development Practices

- Never share secrets via email, Slack, or other chat tools
- Use secure password managers for team secret sharing
- Use 1Password, LastPass, or similar for personal secret storage
- Enable 2FA on Cloudflare accounts

## CI/CD Security

### GitHub Actions Security

#### Current Security Measures

1. **GITHUB_TOKEN** is automatically provided by GitHub Actions
   - Limited to repository scope
   - Automatically expires after workflow completes
   - No manual configuration required

2. **Secrets are masked in logs**
   - GitHub automatically masks secret values in workflow logs
   - Prevents accidental exposure

#### Setting Up Deployment Secrets

For automated deployments, you'll need to add Cloudflare credentials:

```bash
# Generate a Cloudflare API Token
# 1. Go to Cloudflare Dashboard > My Profile > API Tokens
# 2. Create Token > Edit Cloudflare Workers > Select Account/Zone
# 3. Copy the token
```

Add to GitHub repository:
1. Go to repository Settings > Secrets and variables > Actions
2. Click "New repository secret"
3. Name: `CLOUDFLARE_API_TOKEN`
4. Value: Your Cloudflare API token
5. Click "Add secret"

#### Secure Workflow Example

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          npm run deploy
```

#### Preventing Secret Leakage

**Built-in Protection:**
- GitHub Actions automatically masks known secrets in logs
- Use `secrets.SECRET_NAME` syntax, never `$SECRET_NAME` in shell

**Additional Protection:**
```yaml
# Add this step to verify no secrets leak
- name: Check for secrets in logs
  run: |
    if grep -r "ADMIN_API_KEY\|sk-\|token" .; then
      echo "Possible secret found!"
      exit 1
    fi
```

### Pre-commit Hooks

Install git-secrets to prevent committing secrets:

```bash
# Install git-secrets (macOS)
brew install git-secrets

# Install git-secrets (Linux)
git clone https://github.com/awslabs/git-secrets
cd git-secrets
make install

# Setup git-secrets for this repository
cd /path/to/ham-radio-callsign-worker
git secrets --install
git secrets --register-aws

# Add custom patterns for this project
git secrets --add 'ADMIN_API_KEY.*=.*'
git secrets --add '[0-9a-f]{64}'  # 64-char hex strings (API keys)
git secrets --add 'sk-[a-zA-Z0-9]{32,}'  # Secret key patterns
```

## Troubleshooting

### Issue: "ADMIN_API_KEY is not configured"

**Symptoms**: Worker returns 500 error when accessing admin endpoints

**Solution**:
```bash
# Verify secret is set
wrangler secret list

# If not listed, add it
wrangler secret put ADMIN_API_KEY

# If in development, check .dev.vars exists
ls -la .dev.vars
```

### Issue: "401 Unauthorized" on Admin Endpoints

**Symptoms**: API returns 401 even with correct key

**Debugging**:
```bash
# Test locally first
npm run dev

# In another terminal, test the endpoint
curl -v -H "X-API-Key: your-dev-key" http://localhost:8787/admin/stats

# Check the response headers and status code
```

**Common causes**:
- Wrong API key value
- Missing `X-API-Key` or `Authorization` header
- Typo in header name
- Key needs to be rotated (set a new value)

### Issue: Secret Not Available in Worker

**Symptoms**: `env.ADMIN_API_KEY` is `undefined`

**Solution**:
```bash
# For production
wrangler secret put ADMIN_API_KEY

# For development
echo 'ADMIN_API_KEY=your-dev-key' > .dev.vars

# Restart the dev server
npm run dev
```

### Issue: Unable to List or Delete Secrets

**Symptoms**: `wrangler secret list` fails or returns empty

**Solution**:
```bash
# Ensure you're logged in
wrangler login

# Ensure you're in the correct project directory
pwd  # Should be /path/to/ham-radio-callsign-worker

# Check wrangler.toml exists
cat wrangler.toml

# If you have multiple environments, specify one
wrangler secret list --env production
```

### Issue: Secrets Exposed in Logs

**Symptoms**: API keys or tokens visible in application logs

**Solution**:
1. Immediately rotate the exposed secret
2. Review and fix logging code to never log secret values
3. Add sanitization to logging middleware
4. Review R2 logs for any exposure
5. Consider using structured logging with automatic secret masking

**Example sanitization**:
```typescript
function sanitizeLogData(data: any): any {
  const sensitive = ['apiKey', 'token', 'password', 'secret'];
  const sanitized = { ...data };
  
  for (const key of Object.keys(sanitized)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}
```

### Issue: CI/CD Pipeline Cannot Deploy

**Symptoms**: GitHub Actions workflow fails during deployment

**Solution**:
```bash
# Check if CLOUDFLARE_API_TOKEN is set in GitHub
# Settings > Secrets and variables > Actions > Repository secrets

# Verify the token has correct permissions
# Go to Cloudflare Dashboard > API Tokens
# Ensure token has "Edit Cloudflare Workers" permission

# Test token locally
export CLOUDFLARE_API_TOKEN="your-token"
wrangler deploy
```

## Security Checklist

Use this checklist to verify your security posture:

### Initial Setup
- [ ] `.dev.vars` is in `.gitignore`
- [ ] `.env*` files are in `.gitignore`
- [ ] No secrets in `wrangler.toml` (only non-sensitive vars)
- [ ] No secrets hardcoded in TypeScript files
- [ ] Strong ADMIN_API_KEY generated (32+ bytes random)

### Development
- [ ] `.dev.vars` file created locally (not committed)
- [ ] Local dev server uses `.dev.vars` for secrets
- [ ] Test credentials differ from production
- [ ] Secrets never shared via insecure channels

### Production
- [ ] All Wrangler secrets set via `wrangler secret put`
- [ ] Production API key is strong and unique
- [ ] KV namespaces created and IDs in `wrangler.toml`
- [ ] D1 database created and ID in `wrangler.toml`
- [ ] R2 bucket created and name in `wrangler.toml`
- [ ] Worker deployed successfully
- [ ] Admin endpoints tested and working

### CI/CD
- [ ] `CLOUDFLARE_API_TOKEN` set in GitHub Secrets
- [ ] GitHub Actions workflow uses `secrets.` syntax
- [ ] No secrets echoed or logged in workflows
- [ ] Workflow has minimal required permissions
- [ ] Deployment succeeds without exposing secrets

### Ongoing Maintenance
- [ ] Secret rotation schedule documented
- [ ] Team members know how to rotate secrets
- [ ] Offboarding procedure includes secret rotation
- [ ] Quarterly security audit scheduled
- [ ] Incident response plan includes secret compromise scenario

### Code Review
- [ ] No new secrets hardcoded in code
- [ ] New secrets added to this documentation
- [ ] Logging never includes secret values
- [ ] New environment variables properly categorized (secret vs. public)

## Additional Resources

- [Cloudflare Workers Secrets Documentation](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/commands/#secret)
- [GitHub Actions Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

---

**Last Updated**: 2026-01-27  
**Maintainer**: Project Team  
**Review Schedule**: Quarterly
