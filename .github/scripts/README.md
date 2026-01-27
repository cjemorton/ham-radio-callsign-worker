# Automation Scripts

This directory contains automation scripts for managing the project.

## create-backlog-issues.js

Automates the creation of GitHub issues from the backlog definition file.

### Features

- **Duplicate Prevention**: Automatically checks for existing issues and skips duplicates
- **Batch Processing**: Creates multiple issues efficiently with rate limiting
- **Dry-Run Mode**: Preview issues before creating them
- **Flexible Configuration**: Supports custom backlog files and repository specification
- **Error Handling**: Gracefully handles failures and provides detailed reporting

### Usage

#### Quick Start

```bash
# Preview issues (dry-run mode)
node .github/scripts/create-backlog-issues.js --dry-run

# Create issues (requires GitHub token)
export GITHUB_TOKEN=ghp_your_token_here
node .github/scripts/create-backlog-issues.js
```

#### Options

- `--dry-run`: Run in preview mode without creating issues
- `--backlog-file <path>`: Path to backlog YAML file (default: `.github/backlog.yaml`)
- `--token <token>`: GitHub personal access token (or use `GITHUB_TOKEN` env var)
- `--repo <owner/repo>`: Target repository (auto-detected from git if not specified)

#### Examples

```bash
# Use a custom backlog file
node .github/scripts/create-backlog-issues.js --backlog-file custom-backlog.yaml

# Specify repository explicitly
node .github/scripts/create-backlog-issues.js --repo myuser/myrepo

# Use token from command line
node .github/scripts/create-backlog-issues.js --token ghp_xxxxxxxxxxxxx
```

### Requirements

- Node.js 14 or higher
- GitHub personal access token with `repo` scope
- Access to the target repository

### Generating a GitHub Token

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Click "Generate new token (classic)"
3. Select the `repo` scope (full control of private repositories)
4. Generate and copy the token
5. Use it with the script via `--token` flag or `GITHUB_TOKEN` environment variable

### Output

The script provides detailed output including:

- Total issues processed
- Issues created (with success confirmation)
- Issues skipped (already exist)
- Issues failed (with error messages)
- Summary statistics

Example output:

```
=== Backlog Issue Automation ===

Repository: owner/repo
Backlog file: .github/backlog.yaml
Dry run: No

Reading backlog file...
Found 50 issues in backlog

Fetching existing issues...
Found 12 existing issues

📝 Creating: Security: Implement JWT Authentication Support
✅ Created successfully

⏭️  Skipping (exists): API: Generate OpenAPI 3.0 Specification

...

=== Summary ===
✅ Created: 38
⏭️  Skipped (already exists): 12
❌ Failed: 0
📊 Total processed: 50
```

### Error Handling

The script handles various error conditions:

- **Missing token**: Clear error message with instructions
- **Invalid repository**: Validation and helpful error
- **API failures**: Detailed error messages for each failed issue
- **Rate limiting**: Built-in delays between requests
- **Network errors**: Graceful failure with error reporting

### Implementation Details

- **No External Dependencies**: Uses only Node.js built-in modules (`fs`, `https`, `child_process`)
- **Simple YAML Parser**: Custom parser for the specific YAML structure (no external YAML library needed)
- **Rate Limiting**: 1-second delay between issue creations to respect GitHub API limits
- **Pagination**: Fetches all existing issues using pagination to ensure accurate duplicate detection

### Troubleshooting

**Issue: "GitHub token is required"**
- Solution: Set `GITHUB_TOKEN` environment variable or use `--token` flag

**Issue: "Could not detect repository"**
- Solution: Use `--repo` flag to specify repository explicitly (format: `owner/repo`)

**Issue: "Backlog file not found"**
- Solution: Ensure the backlog file exists at the specified path or use `--backlog-file` to specify the correct path

**Issue: GitHub API rate limiting**
- Solution: The script includes automatic delays, but if you hit rate limits, wait and retry later

**Issue: Permission denied when creating issues**
- Solution: Ensure your GitHub token has the `repo` scope permission

### Extending

To modify or extend the script:

1. The YAML parser is in the `parseYAML()` function
2. GitHub API calls are in the `makeGitHubRequest()` function
3. Main logic is in the `main()` function
4. Add new command-line options by modifying the `options` object and `getArgValue()` function

### Related Files

- **Backlog Definition**: [`.github/backlog.yaml`](../backlog.yaml)
- **GitHub Actions Workflow**: [`.github/workflows/create-backlog-issues.yml`](../workflows/create-backlog-issues.yml)
- **Documentation**: See [README.md](../../README.md#backlog-management) for full documentation
