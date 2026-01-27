#!/usr/bin/env node
/**
 * Check Worker Status
 * 
 * This script checks the health and status of the worker
 * Usage: node check-status.js
 */

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';

async function checkStatus() {
  try {
    console.log('Checking worker status...\n');
    
    // Check health endpoint
    console.log('Health Check:');
    console.log('====================');
    const healthResponse = await fetch(`${WORKER_URL}/health`);
    
    if (!healthResponse.ok) {
      console.error(`Health check failed with status ${healthResponse.status}`);
    } else {
      const healthData = await healthResponse.json();
      console.log(JSON.stringify(healthData, null, 2));
    }
    
    // Check status endpoint
    console.log('\nStatus Check:');
    console.log('====================');
    const statusResponse = await fetch(`${WORKER_URL}/api/v1/status`);
    
    if (!statusResponse.ok) {
      console.error(`Status check failed with status ${statusResponse.status}`);
    } else {
      const statusData = await statusResponse.json();
      console.log(JSON.stringify(statusData, null, 2));
      
      if (statusData.version) {
        console.log(`\nAPI Version: ${statusData.version}`);
      }
      if (statusData.lastUpdate) {
        console.log(`Last Update: ${statusData.lastUpdate}`);
      }
      if (statusData.recordCount !== undefined) {
        console.log(`Total Records: ${statusData.recordCount.toLocaleString()}`);
      }
    }
    
    // Check rate limit info
    console.log('\nRate Limit Info:');
    console.log('====================');
    const testResponse = await fetch(`${WORKER_URL}/api/v1/callsign/TEST`);
    const limit = testResponse.headers.get('X-RateLimit-Limit');
    const remaining = testResponse.headers.get('X-RateLimit-Remaining');
    const reset = testResponse.headers.get('X-RateLimit-Reset');
    
    if (limit) {
      console.log(`Limit: ${limit} requests per window`);
      console.log(`Remaining: ${remaining}`);
      if (reset) {
        const resetDate = new Date(parseInt(reset) * 1000);
        console.log(`Resets at: ${resetDate.toISOString()}`);
      }
    } else {
      console.log('No rate limit headers found');
    }
    
    console.log('\n✓ Worker is operational');
  } catch (error) {
    console.error('Status check failed:', error.message);
    process.exit(1);
  }
}

// Main
checkStatus();
