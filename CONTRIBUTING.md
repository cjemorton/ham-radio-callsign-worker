# Contributing to Ham Radio Callsign Worker

Thank you for your interest in contributing to the Ham Radio Callsign Worker project! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
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

3. **Create a Feature Branch**
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
