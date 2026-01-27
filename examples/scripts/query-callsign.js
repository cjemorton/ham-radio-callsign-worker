#!/usr/bin/env node
/**
 * Query Callsign Data
 * 
 * This script demonstrates how to query callsign data from the API
 * Usage: node query-callsign.js <callsign>
 */

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';

async function queryCallsign(callsign) {
  try {
    console.log(`Querying callsign: ${callsign}...`);
    
    const response = await fetch(`${WORKER_URL}/api/v1/callsign/${callsign.toUpperCase()}`);
    
    // Check rate limit headers
    const limit = response.headers.get('X-RateLimit-Limit');
    const remaining = response.headers.get('X-RateLimit-Remaining');
    if (limit && remaining) {
      console.log(`Rate limit: ${remaining}/${limit} remaining`);
    }
    
    if (!response.ok) {
      const error = await response.json();
      console.error(`Error ${response.status}:`, error.message);
      process.exit(1);
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('\nCallsign Information:');
      console.log('====================');
      console.log(JSON.stringify(data.data, null, 2));
    } else {
      console.log('No data found');
    }
  } catch (error) {
    console.error('Query failed:', error.message);
    process.exit(1);
  }
}

// Main
const callsign = process.argv[2];
if (!callsign) {
  console.error('Usage: node query-callsign.js <callsign>');
  console.error('Example: node query-callsign.js K1ABC');
  process.exit(1);
}

queryCallsign(callsign);
