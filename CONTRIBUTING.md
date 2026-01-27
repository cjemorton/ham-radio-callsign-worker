# Contributing to Ham Radio Callsign Worker

Thank you for your interest in contributing to the Ham Radio Callsign Worker project! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Security Guidelines](#security-guidelines)
- [Documentation](#documentation)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for all contributors, regardless of background or experience level.

### Expected Behavior

- Be respectful and considerate in communications
- Provide constructive feedback
- Focus on what's best for the project and community
- Show empathy towards other contributors

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Trolling or insulting/derogatory remarks
- Personal or political attacks
- Publishing others' private information without permission

## Getting Started

1. **Fork the Repository**
   - Fork the project on GitHub
   - Clone your fork locally
   ```bash
   git clone https://github.com/YOUR_USERNAME/ham-radio-callsign-worker.git
   cd ham-radio-callsign-worker
   ```

2. **Set Up Development Environment**
   ```bash
   npm install
   ```

3. **Configure Secrets for Development** (see [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md))
   ```bash
   # Quick setup using the helper script
   ./scripts/secrets-setup.sh dev
   
   # Or manually create .dev.vars
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your development secrets
   ```

4. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Process

### Before You Start

1. Check existing issues to avoid duplicating work
2. For major changes, open an issue first to discuss your approach
3. Review the project roadmap and current priorities
4. Understand the architectural vision outlined in the README

### Making Changes

1. **Keep Changes Focused**
   - One feature or fix per pull request
   - Avoid mixing unrelated changes

2. **Write Quality Code**
   - Follow existing code style and patterns
   - Add appropriate comments for complex logic
   - Ensure type safety with TypeScript

3. **Test Your Changes**
   - Add tests for new functionality
   - Ensure existing tests pass
   - Test edge cases and error conditions

4. **Update Documentation**
   - Update README.md if adding features
   - Add JSDoc comments for public APIs
   - Update relevant configuration examples

## Pull Request Process

### Preparing Your PR

1. **Update Your Branch**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run Quality Checks**
   ```bash
   npm run build    # Type-check TypeScript
   npm test         # Run tests
   npm run lint     # Run linter
   npm run format   # Format code
   ```

3. **Commit Your Changes**
   - Write clear, descriptive commit messages
   - Follow conventional commit format when possible:
     ```
     feat: add callsign search endpoint
     fix: resolve caching issue in KV store
     docs: update API documentation
     test: add tests for admin endpoints
     ```

### Submitting Your PR

1. **PR Title and Description**
   - Use a clear, descriptive title
   - Reference related issues (e.g., "Fixes #123")
   - Describe what changes were made and why
   - Include testing steps if applicable

2. **PR Checklist**
   - [ ] Code follows project style guidelines
   - [ ] Tests added for new functionality
   - [ ] All tests passing
   - [ ] Documentation updated
   - [ ] No new warnings or errors
   - [ ] Commit messages are clear

3. **Review Process**
   - Respond to feedback promptly
   - Make requested changes in new commits
   - Don't force-push after review has started
   - Mark conversations as resolved when addressed

### After Approval

- Maintainers will merge your PR
- Your contribution will be included in the next release
- You'll be added to the contributors list

## Coding Standards

### TypeScript Style

- Use TypeScript strict mode
- Avoid `any` type unless absolutely necessary
- Use interfaces for object shapes
- Use enums for fixed sets of values
- Prefer `const` over `let`, avoid `var`

### Naming Conventions

- **Variables/Functions**: camelCase (`getUserData`, `isValid`)
- **Classes/Interfaces**: PascalCase (`CallsignService`, `UserRequest`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `API_VERSION`)
- **Files**: kebab-case (`callsign-service.ts`, `user-validator.ts`)

### Code Organization

```typescript
// 1. Imports
import { Request, Response } from './types';

// 2. Types/Interfaces
interface Config {
  // ...
}

// 3. Constants
const DEFAULT_TIMEOUT = 5000;

// 4. Functions/Classes
export class Service {
  // ...
}
```

### Comments

- Use JSDoc for public APIs and exported functions
- Add inline comments for complex logic
- Avoid obvious comments
- Keep comments up-to-date with code changes

```typescript
/**
 * Validates a ham radio callsign format
 * @param callsign - The callsign to validate
 * @returns True if valid, false otherwise
 */
function validateCallsign(callsign: string): boolean {
  // Implementation
}
```

## Testing Guidelines

### Test Structure

- Use Vitest for testing
- Organize tests to mirror source structure
- Use descriptive test names

```typescript
describe('CallsignService', () => {
  describe('validateCallsign', () => {
    it('should return true for valid US callsigns', () => {
      // Test implementation
    });

    it('should return false for invalid formats', () => {
      // Test implementation
    });
  });
});
```

### Test Coverage

- Aim for high coverage on business logic
- Test both success and error paths
- Include edge cases
- Mock external dependencies (KV, D1, R2)

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Security Guidelines

> 🔐 **Complete Documentation**: See [SECRETS_MANAGEMENT.md](./SECRETS_MANAGEMENT.md)

Security is a critical aspect of this project. All contributors must follow these security guidelines:

### Handling Secrets

**NEVER commit secrets to version control:**

❌ **DO NOT DO THIS:**
```typescript
// WRONG: Hardcoded secret
const apiKey = 'sk-1234567890abcdef';
const dbPassword = 'mypassword123';
```

✅ **DO THIS INSTEAD:**
```typescript
// CORRECT: Read from environment
const apiKey = env.ADMIN_API_KEY;
```

### Files to NEVER Commit

- `.dev.vars` - Development secrets
- `.env`, `.env.local`, `.env.*` - Environment files
- Any file containing API keys, passwords, or tokens
- Private keys or certificates
- Database credentials

**Note**: These are already in `.gitignore`, but always verify before committing.

### Development Secrets

1. **Use `.dev.vars` for local development**:
   ```bash
   cp .dev.vars.example .dev.vars
   # Edit .dev.vars with your local secrets
   ```

2. **Never share `.dev.vars` via insecure channels**
   - Use password managers for team secret sharing
   - Use secure communication channels only

3. **Use different secrets for development and production**
   - Never use production secrets in development
   - Never test with real API keys or credentials

### Logging and Error Messages

**DO NOT log secret values:**

❌ **WRONG:**
```typescript
console.log('API Key:', env.ADMIN_API_KEY);
log('debug', 'Using password: ' + password);
```

✅ **CORRECT:**
```typescript
log('info', 'API key configured', { keyLength: env.ADMIN_API_KEY?.length });
log('debug', 'Authentication attempted');
```

### Code Review Checklist

Before submitting a PR, verify:

- [ ] No secrets hardcoded in code
- [ ] No secrets in logs or error messages
- [ ] No secrets in test files
- [ ] No secrets in comments
- [ ] `.gitignore` updated if new secret files added
- [ ] Secrets documented in SECRETS_MANAGEMENT.md if new ones added

### Reporting Security Issues

**DO NOT open public issues for security vulnerabilities.**

Instead:
1. Email the maintainers privately
2. Provide detailed description of the vulnerability
3. Include steps to reproduce if applicable
4. Allow time for a fix before public disclosure

### Security Testing

When adding authentication or authorization code:

1. **Test invalid credentials**:
   ```typescript
   it('should reject invalid API key', async () => {
     const response = await handler(requestWithInvalidKey, env);
     expect(response.status).toBe(401);
   });
   ```

2. **Test missing credentials**:
   ```typescript
   it('should reject missing API key', async () => {
     const response = await handler(requestWithoutKey, env);
     expect(response.status).toBe(401);
   });
   ```

3. **Test authorization boundaries**:
   ```typescript
   it('should not allow user key for admin endpoints', async () => {
     // Test implementation
   });
   ```

### Input Validation

Always validate and sanitize inputs:

```typescript
// Validate callsign format
if (!/^[A-Z0-9]{3,6}$/.test(callsign)) {
  return errorResponse('Invalid callsign format', 400);
}

// Sanitize SQL inputs (use parameterized queries)
const stmt = env.CALLSIGN_DB.prepare(
  'SELECT * FROM callsigns WHERE callsign = ?'
).bind(callsign);
```

### Dependencies

When adding new dependencies:

1. **Check for known vulnerabilities**:
   ```bash
   npm audit
   ```

2. **Use specific versions** (not `*` or `latest`)

3. **Review the package** before adding:
   - Check npm downloads and reputation
   - Review source code for suspicious behavior
   - Check for recent maintenance and updates

## Documentation

### README Updates

- Update the README for new features or configuration
- Keep the roadmap section current
- Update API endpoint documentation
- Add usage examples for new functionality

### Code Documentation

- Document all public APIs with JSDoc
- Include parameter descriptions and return types
- Add usage examples for complex functions
- Document configuration options

### API Documentation

- Document all endpoints with:
  - HTTP method and path
  - Request parameters
  - Request body schema
  - Response format
  - Error codes
  - Usage examples

## Issue Reporting

### Bug Reports

Include:
- Clear description of the issue
- Steps to reproduce
- Expected vs. actual behavior
- Environment details (Node version, OS, etc.)
- Relevant logs or error messages

### Feature Requests

Include:
- Clear description of the proposed feature
- Use cases and motivation
- Proposed implementation approach (if applicable)
- Potential impacts on existing functionality

## Questions?

- Open an issue for general questions
- Tag issues appropriately (`question`, `help wanted`, etc.)
- Be patient and respectful when asking for help

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Ham Radio Callsign Worker! 🎉
