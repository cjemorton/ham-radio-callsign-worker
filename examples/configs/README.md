# Example Configurations

This directory contains example configuration files for the Ham Radio Callsign Worker.

## Files

### valid-config.json

A complete, valid configuration file that demonstrates all configuration options with proper values.

**Use cases:**
- Template for creating new configurations
- Reference for all available options
- Testing the validation tool
- Understanding the configuration schema

**Validation:**
```bash
npm run validate:config -- --file examples/configs/valid-config.json
```

Expected result: ✓ Configuration is valid with no warnings

### invalid-config.json

An intentionally invalid configuration file used for testing error detection and validation messages.

**Contains:**
- Invalid URL format
- Missing required fields
- Empty arrays
- Wrong field types

**Use cases:**
- Testing validation error messages
- Understanding common configuration mistakes
- Demonstrating validation tool capabilities

**Validation:**
```bash
npm run validate:config -- --file examples/configs/invalid-config.json
```

Expected result: Multiple validation errors with actionable suggestions

## Using These Examples

### As Templates

Copy and modify for your needs:

```bash
# Copy the valid config as a starting point
cp examples/configs/valid-config.json my-config.json

# Edit the file with your settings
vim my-config.json

# Validate before use
npm run validate:config -- --file my-config.json
```

### For Testing

Test the validation tool:

```bash
# Test valid configuration
npm run validate:config -- --file examples/configs/valid-config.json

# Test invalid configuration (should fail)
npm run validate:config -- --file examples/configs/invalid-config.json

# Get JSON output for automation
npm run validate:config -- --file examples/configs/valid-config.json --json
```

### For Development

Use as references when:
- Implementing new configuration options
- Writing tests for configuration validation
- Documenting configuration schema
- Creating deployment configurations

## Configuration Schema

See [CONFIG_VALIDATION.md](../../CONFIG_VALIDATION.md) for complete documentation on:
- All configuration fields and their requirements
- Validation rules
- Common errors and how to fix them
- CI/CD integration
- Best practices

## Creating New Configurations

1. **Start with a template:**
   ```bash
   cp examples/configs/valid-config.json production-config.json
   ```

2. **Modify for your environment:**
   - Update `dataSource.originZipUrl` if using a different source
   - Configure `backupEndpoints` for redundancy
   - Enable/disable `features` as needed
   - Set appropriate `rateLimits` for your use case
   - Configure `cache.ttl` based on data freshness requirements

3. **Validate the configuration:**
   ```bash
   npm run validate:config -- --file production-config.json --verbose
   ```

4. **Test in development:**
   - Load the configuration in a development environment
   - Verify all features work as expected
   - Check logs for any warnings

5. **Deploy to production:**
   - Store in KV using admin endpoints
   - Validate the deployed configuration
   - Monitor for issues

## Adding to CI/CD

Configurations in this directory are automatically validated by CI when:
- Any file in this directory changes
- Configuration-related source files change
- On pull requests

See `.github/workflows/validate-config.yml` for the CI configuration.

## Environment-Specific Configurations

Consider creating separate configurations for each environment:

```
examples/configs/
├── valid-config.json         # Template/reference
├── invalid-config.json       # Testing
├── development-config.json   # Development environment
├── staging-config.json       # Staging environment
└── production-config.json    # Production environment
```

**Note:** Production configurations with secrets should NOT be committed to git. Store them securely in Cloudflare KV.

## Common Patterns

### Minimal Configuration

For basic deployments with default settings:

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

### High-Availability Configuration

For production with redundancy:

```json
{
  "dataSource": {
    "originZipUrl": "https://data.fcc.gov/download/pub/uls/complete/l_amat.zip",
    "zipFileName": "l_amat.zip",
    "extractedFileName": "AM.dat",
    "expectedSchema": {
      "fields": ["callsign", "operator_class", "..."]
    }
  },
  "backupEndpoints": {
    "primary": "https://backup1.example.com/l_amat.zip",
    "secondary": "https://backup2.example.com/l_amat.zip",
    "tertiary": "https://backup3.example.com/l_amat.zip"
  },
  "features": {
    "jwtAuth": true,
    "canaryDeployment": true,
    "advancedSearch": true,
    "dataExport": true,
    "externalSync": true
  },
  "rateLimits": {
    "user": {
      "requestsPerMinute": 1000,
      "burstSize": 100
    },
    "admin": {
      "requestsPerMinute": 500,
      "burstSize": 50
    }
  },
  "cache": {
    "ttl": 1800,
    "maxEntries": 50000
  }
}
```

## Related Documentation

- [CONFIG_VALIDATION.md](../../CONFIG_VALIDATION.md) - Complete validation guide
- [scripts/README.md](../../scripts/README.md) - All project scripts
- [README.md](../../README.md) - Project overview
- [ARCHITECTURE.md](../../ARCHITECTURE.md) - System architecture
