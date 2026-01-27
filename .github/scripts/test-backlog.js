#!/usr/bin/env node

/**
 * Test script for backlog automation
 * 
 * Validates that the backlog YAML file is properly formatted and parseable.
 */

const fs = require('fs');
const path = require('path');

function parseYAML(content) {
  // Simple YAML parser for our specific format
  const lines = content.split('\n');
  const result = { issues: [] };
  let currentIssue = null;
  let currentField = null;
  let inBodyBlock = false;
  let bodyLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('#') || (trimmed === '' && !inBodyBlock)) {
      continue;
    }

    if (trimmed.startsWith('- title:')) {
      if (currentIssue) {
        if (inBodyBlock) {
          currentIssue.body = bodyLines.join('\n').trim();
        }
        result.issues.push(currentIssue);
      }
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

    if (trimmed.startsWith('body:')) {
      inBodyBlock = true;
      bodyLines = [];
      const bodyValue = trimmed.substring(5).trim();
      if (bodyValue && bodyValue !== '|') {
        bodyLines.push(bodyValue.replace(/^["']|["']$/g, ''));
      }
      continue;
    }

    if (inBodyBlock && trimmed.startsWith('labels:')) {
      currentIssue.body = bodyLines.join('\n').trim();
      inBodyBlock = false;
      bodyLines = [];
      currentField = 'labels';
      continue;
    }

    if (inBodyBlock) {
      bodyLines.push(line.substring(6));
      continue;
    }

    if (currentField === 'labels' && trimmed.startsWith('-')) {
      const label = trimmed.substring(1).trim().replace(/^["']|["']$/g, '');
      currentIssue.labels.push(label);
    }
  }

  if (currentIssue) {
    if (inBodyBlock) {
      currentIssue.body = bodyLines.join('\n').trim();
    }
    result.issues.push(currentIssue);
  }

  return result;
}

function validateBacklog(backlog) {
  const errors = [];
  const warnings = [];

  if (!backlog.issues || backlog.issues.length === 0) {
    errors.push('No issues found in backlog');
    return { errors, warnings };
  }

  const titles = new Set();

  backlog.issues.forEach((issue, index) => {
    const issueNum = index + 1;

    // Validate title
    if (!issue.title || issue.title.trim() === '') {
      errors.push(`Issue ${issueNum}: Missing title`);
    } else if (titles.has(issue.title)) {
      errors.push(`Issue ${issueNum}: Duplicate title "${issue.title}"`);
    } else {
      titles.add(issue.title);
    }

    // Validate body
    if (!issue.body || issue.body.trim() === '') {
      warnings.push(`Issue ${issueNum} (${issue.title}): Empty body`);
    } else if (issue.body.length < 50) {
      warnings.push(`Issue ${issueNum} (${issue.title}): Very short body (${issue.body.length} chars)`);
    }

    // Check for key sections in body
    if (issue.body && !issue.body.includes('## Objective')) {
      warnings.push(`Issue ${issueNum} (${issue.title}): Missing "## Objective" section`);
    }
    if (issue.body && !issue.body.includes('## Requirements')) {
      warnings.push(`Issue ${issueNum} (${issue.title}): Missing "## Requirements" section`);
    }
    if (issue.body && !issue.body.includes('## Acceptance Criteria')) {
      warnings.push(`Issue ${issueNum} (${issue.title}): Missing "## Acceptance Criteria" section`);
    }

    // Validate labels
    if (!issue.labels || issue.labels.length === 0) {
      warnings.push(`Issue ${issueNum} (${issue.title}): No labels`);
    } else if (!issue.labels.includes('enhancement') && !issue.labels.includes('bug') && !issue.labels.includes('documentation')) {
      warnings.push(`Issue ${issueNum} (${issue.title}): No type label (enhancement/bug/documentation)`);
    }
  });

  return { errors, warnings };
}

function main() {
  console.log('=== Backlog Validation Test ===\n');

  const backlogPath = path.resolve(__dirname, '../backlog.yaml');
  
  if (!fs.existsSync(backlogPath)) {
    console.error('❌ Backlog file not found:', backlogPath);
    process.exit(1);
  }

  console.log('Reading backlog file:', backlogPath);
  const content = fs.readFileSync(backlogPath, 'utf8');
  
  console.log('Parsing backlog...');
  let backlog;
  try {
    backlog = parseYAML(content);
  } catch (error) {
    console.error('❌ Failed to parse backlog:', error.message);
    process.exit(1);
  }

  console.log(`✅ Parsed ${backlog.issues.length} issues\n`);

  console.log('Validating backlog structure...');
  const { errors, warnings } = validateBacklog(backlog);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach(error => console.log(`  - ${error}`));
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:');
    warnings.forEach(warning => console.log(`  - ${warning}`));
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('\n✅ All validations passed!');
  }

  console.log('\n=== Issue Summary ===');
  
  // Group by category
  const categories = {};
  backlog.issues.forEach(issue => {
    const category = issue.title.split(':')[0].trim();
    if (!categories[category]) {
      categories[category] = 0;
    }
    categories[category]++;
  });

  console.log('\nIssues by category:');
  Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });

  console.log(`\nTotal issues: ${backlog.issues.length}`);

  // Label statistics
  const labelCounts = {};
  backlog.issues.forEach(issue => {
    issue.labels.forEach(label => {
      labelCounts[label] = (labelCounts[label] || 0) + 1;
    });
  });

  console.log('\nMost common labels:');
  Object.entries(labelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([label, count]) => {
      console.log(`  ${label}: ${count}`);
    });

  if (errors.length > 0) {
    console.log('\n❌ Validation failed with errors');
    process.exit(1);
  }

  console.log('\n✅ Validation successful!');
}

main();
