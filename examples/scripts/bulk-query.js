#!/usr/bin/env node
/**
 * Bulk Query Callsigns
 * 
 * This script queries multiple callsigns from a file
 * Usage: node bulk-query.js <filename>
 * 
 * File format: One callsign per line
 * Example file content:
 *   K1ABC
 *   W2XYZ
 *   N3QRS
 */

const fs = require('fs');
const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';

// Delay between requests to respect rate limits (in ms)
const DELAY_MS = parseInt(process.env.DELAY_MS) || 100;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function queryCallsign(callsign) {
  const response = await fetch(`${WORKER_URL}/api/v1/callsign/${callsign.toUpperCase()}`);
  
  // Check rate limit
  const remaining = response.headers.get('X-RateLimit-Remaining');
  const limit = response.headers.get('X-RateLimit-Limit');
  
  if (!response.ok) {
    const error = await response.json();
    return {
      callsign,
      success: false,
      error: error.message,
      remaining,
      limit
    };
  }
  
  const data = await response.json();
  return {
    callsign,
    success: data.success,
    data: data.data,
    remaining,
    limit
  };
}

async function bulkQuery(filename) {
  try {
    // Read callsigns from file
    console.log(`Reading callsigns from ${filename}...`);
    const content = fs.readFileSync(filename, 'utf-8');
    const callsigns = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
    
    if (callsigns.length === 0) {
      console.error('No callsigns found in file');
      process.exit(1);
    }
    
    console.log(`Found ${callsigns.length} callsigns to query`);
    console.log(`Delay between requests: ${DELAY_MS}ms\n`);
    
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < callsigns.length; i++) {
      const callsign = callsigns[i];
      process.stdout.write(`[${i + 1}/${callsigns.length}] Querying ${callsign}... `);
      
      try {
        const result = await queryCallsign(callsign);
        results.push(result);
        
        if (result.success) {
          successCount++;
          console.log('✓');
        } else {
          errorCount++;
          console.log(`✗ (${result.error || 'Not found'})`);
        }
        
        // Show rate limit status
        if (result.remaining && result.limit) {
          console.log(`  Rate limit: ${result.remaining}/${result.limit} remaining`);
        }
        
        // Respect rate limits
        if (i < callsigns.length - 1) {
          await sleep(DELAY_MS);
        }
      } catch (error) {
        errorCount++;
        console.log(`✗ (${error.message})`);
        results.push({
          callsign,
          success: false,
          error: error.message
        });
      }
    }
    
    // Summary
    console.log('\n====================');
    console.log('Summary:');
    console.log(`Total: ${callsigns.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
    
    // Write results to file
    const outputFile = filename.replace(/\.[^.]*$/, '') + '-results.json';
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`\nDetailed results written to: ${outputFile}`);
    
  } catch (error) {
    console.error('Bulk query failed:', error.message);
    process.exit(1);
  }
}

// Main
const filename = process.argv[2];
if (!filename) {
  console.error('Usage: node bulk-query.js <filename>');
  console.error('');
  console.error('File format: One callsign per line');
  console.error('');
  console.error('Example:');
  console.error('  echo "K1ABC" > callsigns.txt');
  console.error('  echo "W2XYZ" >> callsigns.txt');
  console.error('  node bulk-query.js callsigns.txt');
  console.error('');
  console.error('Environment variables:');
  console.error('  WORKER_URL - Worker URL (default: http://localhost:8787)');
  console.error('  DELAY_MS - Delay between requests in ms (default: 100)');
  process.exit(1);
}

if (!fs.existsSync(filename)) {
  console.error(`Error: File not found: ${filename}`);
  process.exit(1);
}

bulkQuery(filename);
