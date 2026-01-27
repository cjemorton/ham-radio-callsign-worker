#!/usr/bin/env node
/**
 * Trigger Data Update
 * 
 * This script triggers an administrative data update operation
 * Requires: ADMIN_API_KEY environment variable
 * Usage: ADMIN_API_KEY=your-key node trigger-update.js
 */

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

async function triggerUpdate() {
  if (!ADMIN_API_KEY) {
    console.error('Error: ADMIN_API_KEY environment variable is required');
    console.error('Usage: ADMIN_API_KEY=your-key node trigger-update.js');
    process.exit(1);
  }

  try {
    console.log('Triggering data update...');
    
    const response = await fetch(`${WORKER_URL}/api/v1/admin/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ADMIN_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error(`Error ${response.status}:`, error.message || error.error);
      process.exit(1);
    }
    
    const data = await response.json();
    
    console.log('\nUpdate triggered successfully!');
    console.log('====================');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.message) {
      console.log(`\nStatus: ${data.message}`);
    }
  } catch (error) {
    console.error('Update trigger failed:', error.message);
    process.exit(1);
  }
}

// Main
triggerUpdate();
