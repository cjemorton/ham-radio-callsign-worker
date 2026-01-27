#!/usr/bin/env node

/**
 * Backlog Issue Automation Script
 * 
 * This script automates the creation of backlog issues defined in .github/backlog.yaml
 * 
 * Usage:
 *   node .github/scripts/create-backlog-issues.js [options]
 * 
 * Options:
 *   --dry-run          Preview issues without creating them
 *   --backlog-file     Path to backlog YAML file (default: .github/backlog.yaml)
 *   --token            GitHub personal access token (or use GITHUB_TOKEN env var)
 *   --repo             Repository in format owner/repo (or auto-detect from git)
 * 
 * Environment Variables:
 *   GITHUB_TOKEN       GitHub personal access token with repo permissions
 * 
 * Examples:
 *   # Dry run to preview issues
 *   node .github/scripts/create-backlog-issues.js --dry-run
 * 
 *   # Create issues with explicit token
 *   node .github/scripts/create-backlog-issues.js --token ghp_xxxxx
 * 
 *   # Use custom backlog file
 *   node .github/scripts/create-backlog-issues.js --backlog-file custom-backlog.yaml
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  backlogFile: getArgValue('--backlog-file') || '.github/backlog.yaml',
  token: getArgValue('--token') || process.env.GITHUB_TOKEN,
  repo: getArgValue('--repo') || detectRepository()
};

function getArgValue(flag) {
  const index = args.indexOf(flag);
  return index !== -1 && args[index + 1] ? args[index + 1] : null;
}

function detectRepository() {
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const match = remoteUrl.match(/github\.com[:/](.+?\/.+?)(?:\.git)?$/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

function parseYAML(content) {
  // Simple YAML parser for our specific format
  // This handles the basic structure we need without requiring external dependencies
  const lines = content.split('\n');
  const result = { issues: [] };
  let currentIssue = null;
  let currentField = null;
  let indentLevel = 0;
  let inBodyBlock = false;
  let bodyLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines at root level
    if (trimmed.startsWith('#') || (trimmed === '' && !inBodyBlock)) {
      continue;
    }

    // Detect issue start
    if (trimmed.startsWith('- title:')) {
      // Save previous issue if exists
      if (currentIssue) {
        if (inBodyBlock) {
          currentIssue.body = bodyLines.join('\n').trim();
        }
        result.issues.push(currentIssue);
      }
      // Start new issue
      currentIssue = {
        title: trimmed.substring(8).trim().replace(/^["']|["']$/g, ''),
        body: '',
        labels: []
      };
      currentField = null;
      inBodyBlock = false;
      bodyLines = [];
      continue;
    }

    if (!currentIssue) continue;

    // Detect body field
    if (trimmed.startsWith('body:')) {
      inBodyBlock = true;
      bodyLines = [];
      const bodyValue = trimmed.substring(5).trim();
      if (bodyValue && bodyValue !== '|') {
        bodyLines.push(bodyValue.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    // Handle body content
    if (inBodyBlock && trimmed.startsWith('labels:')) {
      currentIssue.body = bodyLines.join('\n').trim();
      inBodyBlock = false;
      bodyLines = [];
      currentField = 'labels';
      continue;
    }

    if (inBodyBlock) {
      // Add line to body, preserving indentation for formatting
      bodyLines.push(line.substring(6)); // Remove minimal indent
      continue;
    }

    // Handle labels
    if (currentField === 'labels' && trimmed.startsWith('-')) {
      const label = trimmed.substring(1).trim().replace(/^["']|["']$/g, '');
      currentIssue.labels.push(label);
    }
  }

  // Save last issue
  if (currentIssue) {
    if (inBodyBlock) {
      currentIssue.body = bodyLines.join('\n').trim();
    }
    result.issues.push(currentIssue);
  }

  return result;
}

function makeGitHubRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const postData = data ? JSON.stringify(data) : null;
    
    const requestOptions = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'User-Agent': 'Backlog-Issue-Automation',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${options.token}`,
        'Content-Type': 'application/json'
      }
    };

    if (postData) {
      requestOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(requestOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body ? JSON.parse(body) : null);
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode} - ${body}`));
        }
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function getExistingIssues(repo) {
  console.log('Fetching existing issues...');
  const [owner, repoName] = repo.split('/');
  let allIssues = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const issues = await makeGitHubRequest(
      'GET',
      `/repos/${owner}/${repoName}/issues?state=all&per_page=100&page=${page}`
    );
    
    if (issues.length === 0) {
      hasMore = false;
    } else {
      allIssues = allIssues.concat(issues);
      page++;
    }
  }

  console.log(`Found ${allIssues.length} existing issues`);
  return new Set(allIssues.map(issue => issue.title));
}

async function createIssue(repo, issue) {
  const [owner, repoName] = repo.split('/');
  return await makeGitHubRequest('POST', `/repos/${owner}/${repoName}/issues`, {
    title: issue.title,
    body: issue.body,
    labels: issue.labels
  });
}

async function main() {
  console.log('=== Backlog Issue Automation ===\n');

  // Validate options
  if (!options.token) {
    console.error('Error: GitHub token is required. Set GITHUB_TOKEN environment variable or use --token flag.');
    process.exit(1);
  }

  if (!options.repo) {
    console.error('Error: Could not detect repository. Use --repo flag to specify it (e.g., owner/repo).');
    process.exit(1);
  }

  console.log(`Repository: ${options.repo}`);
  console.log(`Backlog file: ${options.backlogFile}`);
  console.log(`Dry run: ${options.dryRun ? 'Yes' : 'No'}\n`);

  // Read and parse backlog file
  const backlogPath = path.resolve(options.backlogFile);
  if (!fs.existsSync(backlogPath)) {
    console.error(`Error: Backlog file not found: ${backlogPath}`);
    process.exit(1);
  }

  console.log('Reading backlog file...');
  const backlogContent = fs.readFileSync(backlogPath, 'utf8');
  const backlog = parseYAML(backlogContent);

  console.log(`Found ${backlog.issues.length} issues in backlog\n`);

  if (options.dryRun) {
    console.log('=== DRY RUN - No issues will be created ===\n');
    backlog.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.title}`);
      console.log(`   Labels: ${issue.labels.join(', ')}`);
      console.log(`   Body length: ${issue.body.length} characters\n`);
    });
    console.log(`\nTotal: ${backlog.issues.length} issues would be created`);
    return;
  }

  // Get existing issues to avoid duplicates
  const existingTitles = await getExistingIssues(options.repo);

  // Create issues
  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const issue of backlog.issues) {
    if (existingTitles.has(issue.title)) {
      console.log(`⏭️  Skipping (exists): ${issue.title}`);
      skipped++;
      continue;
    }

    try {
      console.log(`📝 Creating: ${issue.title}`);
      await createIssue(options.repo, issue);
      created++;
      console.log(`✅ Created successfully\n`);
      
      // Add a small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Failed to create: ${issue.title}`);
      console.error(`   Error: ${error.message}\n`);
      failed++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`✅ Created: ${created}`);
  console.log(`⏭️  Skipped (already exists): ${skipped}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total processed: ${backlog.issues.length}`);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
