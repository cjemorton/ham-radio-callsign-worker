# Testing Guide

This document provides comprehensive guidance for testing the Ham Radio Callsign Worker project, including unit tests, integration tests, end-to-end tests, and manual testing procedures.

## Table of Contents

- [Overview](#overview)
- [Test Infrastructure](#test-infrastructure)
- [Running Tests](#running-tests)
- [Test Organization](#test-organization)
- [Unit Testing](#unit-testing)
- [Integration Testing](#integration-testing)
- [End-to-End Testing](#end-to-end-testing)
- [Manual Testing](#manual-testing)
- [Edge Cases and Failure Scenarios](#edge-cases-and-failure-scenarios)
- [Test Patterns and Best Practices](#test-patterns-and-best-practices)
- [Continuous Integration](#continuous-integration)
- [Troubleshooting](#troubleshooting)

## Overview

The Ham Radio Callsign Worker uses [Vitest](https://vitest.dev/) as its primary testing framework, chosen for its excellent TypeScript support, fast execution, and compatibility with Cloudflare Workers.

### Test Statistics

- **Test Files**: 12
- **Total Tests**: 182+
- **Coverage Target**: 80%+ for core business logic

### Test Categories

1. **Unit Tests**: Test individual functions and modules in isolation
2. **Integration Tests**: Test interactions between components
3. **End-to-End Tests**: Test complete workflows through the API
4. **Manual Tests**: Documented procedures for complex scenarios

## Test Infrastructure

### Technology Stack

- **Vitest**: Test runner and assertion library
- **TypeScript**: Type-safe test development
- **Miniflare**: Local Cloudflare Workers simulation (for E2E tests)
- **Wrangler**: Cloudflare Workers development environment

### Setup

```bash
# Install dependencies
npm install

# Verify test setup
npm test
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm test -- --coverage

# Run specific test file
npm test test/engine.test.ts

# Run tests matching a pattern
npm test -- --grep "validation"

# Run tests in UI mode (interactive)
npm test -- --ui
```

### Coverage Reports

After running tests with coverage:

```bash
# Generate coverage report
npm test -- --coverage

# View HTML coverage report
open coverage/index.html
```

Coverage reports include:
- Line coverage
- Branch coverage
- Function coverage
- Statement coverage

## Test Organization

Tests are organized by module in the `test/` directory:

```
test/
├── config.test.ts              # Configuration loading and validation
├── config-endpoints.test.ts    # Configuration API endpoints
├── database.test.ts            # Database operations
├── diff.test.ts                # Diffing engine
├── engine.test.ts              # Core fetch/extract/validate engine
├── index.test.ts               # Main worker entry point
├── log-rotation.test.ts        # Log rotation logic
├── logging-endpoints.test.ts   # Logging API endpoints
├── middleware.test.ts          # Middleware (auth, CORS, rate limiting)
├── router.test.ts              # Request routing
├── slave-sync.test.ts          # External database sync
└── validate.test.ts            # Data validation engine
```

## Unit Testing

Unit tests focus on testing individual functions and modules in isolation.

### Example: Testing Validation Functions

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { validateSchema, calculateHash } from '../src/engine/validate';
import type { ConfigData } from '../src/types';

describe('Validation Engine', () => {
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

  describe('validateSchema', () => {
    it('should validate correct schema', () => {
      const content = 'callsign,name,class\nAA1AA,John Doe,Extra\n';
      const result = validateSchema(content, config);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing fields', () => {
      const content = 'callsign,name\nAA1AA,John Doe\n';
      const result = validateSchema(content, config);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('calculateHash', () => {
    it('should generate consistent hash', async () => {
      const content = 'test content';
      const hash1 = await calculateHash(content);
      const hash2 = await calculateHash(content);
      
      expect(hash1).toBe(hash2);
    });
  });
});
```

### Mocking External Dependencies

When testing code that depends on Cloudflare services (KV, D1, R2), use mock objects:

```typescript
const mockKV = {
  get: async (key: string) => {
    if (key === 'test-key') {
      return JSON.stringify({ data: 'test-value' });
    }
    return null;
  },
  put: async (key: string, value: string) => {
    // Mock implementation
  },
} as unknown as KVNamespace;

env.METADATA_STORE = mockKV;
```

## Integration Testing

Integration tests verify that multiple components work together correctly.

### Example: Testing Router and Middleware

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';
import type { Env } from '../src/types';

describe('Router Integration Tests', () => {
  let env: Env;

  beforeEach(() => {
    env = {
      ENVIRONMENT: 'test',
      LOG_LEVEL: 'info',
      ADMIN_API_KEY: 'test-api-key',
    };
  });

  it('should route health check request', async () => {
    const request = new Request('http://localhost/health');
    const response = await worker.fetch(request, env, {} as ExecutionContext);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  it('should enforce authentication on admin endpoints', async () => {
    const request = new Request('http://localhost/admin/update', {
      method: 'POST',
    });
    const response = await worker.fetch(request, env, {} as ExecutionContext);

    expect(response.status).toBe(401);
  });

  it('should apply CORS headers', async () => {
    const request = new Request('http://localhost/health');
    const response = await worker.fetch(request, env, {} as ExecutionContext);

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});
```

## End-to-End Testing

End-to-end tests verify complete workflows through the entire system.

### Using Miniflare

[Miniflare](https://miniflare.dev/) provides a local simulation of the Cloudflare Workers environment:

```bash
# Install Miniflare
npm install -D miniflare

# Run worker locally
npx wrangler dev
```

### E2E Test Patterns

```typescript
describe('Update Workflow E2E', () => {
  it('should complete full update cycle', async () => {
    // 1. Trigger update
    const updateRequest = new Request('http://localhost/admin/update', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-key' },
    });
    const updateResponse = await worker.fetch(updateRequest, env, ctx);
    
    // 2. Verify update initiated
    expect([200, 202]).toContain(updateResponse.status);
    
    // 3. Check status
    const statusRequest = new Request('http://localhost/admin/status');
    const statusResponse = await worker.fetch(statusRequest, env, ctx);
    
    // 4. Verify data is queryable
    const lookupRequest = new Request('http://localhost/api/v1/callsign/TEST');
    const lookupResponse = await worker.fetch(lookupRequest, env, ctx);
    
    expect([200, 404, 503]).toContain(lookupResponse.status);
  });
});
```

### Manual E2E Testing with Wrangler Dev

```bash
# Start local development server
npm run dev

# In another terminal, test endpoints
curl http://localhost:8787/health
curl http://localhost:8787/version
curl http://localhost:8787/api/v1/callsign/K1ABC
curl "http://localhost:8787/api/v1/search?q=smith"

# Test admin endpoints
curl -X POST http://localhost:8787/admin/update \
  -H "Authorization: Bearer your-api-key"

curl http://localhost:8787/admin/status \
  -H "Authorization: Bearer your-api-key"
```

## Manual Testing

### Edge Cases and Failure Scenarios

#### 1. Empty Database Scenario

**Test**: Query callsign when database is empty

```bash
# Start fresh worker
npm run dev

# Query before any data is loaded
curl http://localhost:8787/api/v1/callsign/TEST123
```

**Expected**: 503 Service Unavailable (database not available)

#### 2. Corrupted Data Handling

**Test**: Attempt to process invalid data

**Setup**:
1. Modify data source to return invalid ZIP
2. Trigger update
3. Verify fallback mechanism activates

**Expected**: 
- Validation fails with detailed errors
- Last known good data is used
- Error logged to R2

#### 3. Network Failure During Fetch

**Test**: Simulate network failure

**Setup**:
1. Configure invalid data source URL
2. Trigger update
3. Verify retry logic

**Expected**:
- Multiple retry attempts (default: 3)
- Exponential backoff between retries
- Clear error message after final failure

#### 4. Concurrent Update Operations

**Test**: Multiple simultaneous update requests

```bash
# Trigger multiple updates
for i in {1..5}; do
  curl -X POST http://localhost:8787/admin/update \
    -H "Authorization: Bearer test-key" &
done
wait
```

**Expected**:
- Only one update proceeds
- Other requests receive "Update in progress" message
- No data corruption

#### 5. Large Dataset Handling

**Test**: Process dataset with 100,000+ records

**Setup**:
1. Configure data source with large file
2. Monitor memory usage
3. Verify processing completes

**Expected**:
- Streaming processing for large files
- Memory usage stays within worker limits
- All records processed correctly

#### 6. Rate Limit Boundary Conditions

**Test**: Exceed rate limits

```bash
# Send 110 requests rapidly (limit is 100/min)
for i in {1..110}; do
  curl http://localhost:8787/api/v1/search?q=test${i}
done
```

**Expected**:
- First 100 requests succeed
- Remaining requests receive 429 Too Many Requests
- Rate limit headers included in responses

#### 7. Invalid Configuration Handling

**Test**: Worker with missing or invalid configuration

**Setup**:
1. Remove required config from KV
2. Restart worker
3. Attempt operations

**Expected**:
- Worker starts successfully
- Returns helpful error messages
- Suggests configuration steps

### Manual Test Checklist

Before deployment, manually verify:

- [ ] Health endpoint responds correctly
- [ ] Version endpoint returns current version
- [ ] Callsign lookup works for known callsigns
- [ ] Search returns relevant results
- [ ] Admin authentication works
- [ ] Invalid auth tokens are rejected
- [ ] Rate limiting enforces limits
- [ ] CORS headers present on all responses
- [ ] Error responses are well-formatted JSON
- [ ] Log rotation occurs daily
- [ ] Fallback mechanism activates on validation failure
- [ ] External sync completes successfully (if configured)

## Test Patterns and Best Practices

### 1. Arrange-Act-Assert Pattern

```typescript
it('should validate callsign format', () => {
  // Arrange: Set up test data
  const callsign = 'K1ABC';
  
  // Act: Execute the function
  const result = validateCallsignFormat(callsign);
  
  // Assert: Verify the outcome
  expect(result).toBe(true);
});
```

### 2. Test Naming Convention

Use descriptive test names that explain what is being tested:

```typescript
// Good
it('should return 404 for non-existent callsign', async () => { ... });

// Bad
it('test callsign lookup', async () => { ... });
```

### 3. Group Related Tests

```typescript
describe('Callsign Validation', () => {
  describe('valid callsigns', () => {
    it('should accept standard US callsign', () => { ... });
    it('should accept Canadian callsign', () => { ... });
  });

  describe('invalid callsigns', () => {
    it('should reject empty string', () => { ... });
    it('should reject special characters', () => { ... });
  });
});
```

### 4. Use beforeEach for Common Setup

```typescript
describe('Database Operations', () => {
  let db: D1Database;
  let env: Env;

  beforeEach(() => {
    env = createTestEnv();
    db = env.CALLSIGN_DB;
  });

  it('should insert record', async () => {
    await insertCallsign(db, { callsign: 'TEST', name: 'Test' });
    // ... assertions
  });
});
```

### 5. Test Both Success and Failure Paths

```typescript
describe('Data Fetching', () => {
  it('should fetch data successfully', async () => {
    // Test success case
  });

  it('should handle network errors', async () => {
    // Test failure case
  });

  it('should retry on temporary failure', async () => {
    // Test retry logic
  });
});
```

### 6. Avoid Test Interdependencies

Each test should be independent and able to run in any order:

```typescript
// Bad: Tests depend on execution order
it('should create user', () => { createUser(); });
it('should find created user', () => { findUser(); });

// Good: Each test is self-contained
it('should create user', () => {
  createUser();
  expect(userExists()).toBe(true);
});

it('should find existing user', () => {
  createUser(); // Setup within test
  const user = findUser();
  expect(user).toBeDefined();
});
```

## Continuous Integration

### GitHub Actions

Example CI workflow:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Pre-commit Hooks

Use Husky for pre-commit testing:

```bash
# Install Husky
npm install --save-dev husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm test"
```

## Troubleshooting

### Common Issues

#### Tests Timeout

**Problem**: Tests hang or timeout

**Solutions**:
- Increase timeout: `npm test -- --test-timeout=10000`
- Check for unclosed promises
- Verify mock implementations return values

#### Inconsistent Test Results

**Problem**: Tests pass/fail randomly

**Solutions**:
- Check for race conditions
- Avoid relying on timing (use proper async/await)
- Ensure tests are independent

#### Coverage Not Generated

**Problem**: Coverage report is empty

**Solutions**:
- Verify vitest.config.ts has coverage configured
- Check that source files are not in exclude list
- Run with verbose flag: `npm test -- --coverage --reporter=verbose`

### Debug Mode

Run tests in debug mode:

```bash
# Node inspector
node --inspect-brk ./node_modules/vitest/vitest.mjs

# VS Code launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "program": "${workspaceFolder}/node_modules/vitest/vitest.mjs",
  "args": ["--run"],
  "console": "integratedTerminal"
}
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Miniflare Documentation](https://miniflare.dev/)
- [Cloudflare Workers Testing Guide](https://developers.cloudflare.com/workers/testing/)
- [Wrangler CLI Reference](https://developers.cloudflare.com/workers/wrangler/)

## Contributing

When adding new features:

1. Write tests first (TDD approach recommended)
2. Ensure tests pass locally
3. Verify coverage meets minimum thresholds
4. Update this guide if adding new test patterns
5. Include test examples in PR description

For questions or issues with testing, please open an issue on GitHub.
