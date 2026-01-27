#!/usr/bin/env node
/**
 * Search Callsigns
 * 
 * This script demonstrates how to search for callsigns using query parameters
 * Usage: node search-callsigns.js <query>
 * 
 * Examples:
 *   node search-callsigns.js name=Smith
 *   node search-callsigns.js city=Seattle
 *   node search-callsigns.js state=WA
 */

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787';

async function searchCallsigns(query) {
  try {
    console.log(`Searching callsigns with query: ${query}...`);
    
    const response = await fetch(`${WORKER_URL}/api/v1/search?${query}`);
    
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
    
    if (data.success && data.data && data.data.length > 0) {
      console.log(`\nFound ${data.data.length} results:`);
      console.log('====================');
      data.data.forEach((result, index) => {
        console.log(`\n${index + 1}. ${result.callsign || result.call}`);
        console.log(JSON.stringify(result, null, 2));
      });
      
      if (data.pagination) {
        console.log('\nPagination:');
        console.log(`Page ${data.pagination.page} of ${data.pagination.totalPages}`);
        console.log(`Total results: ${data.pagination.total}`);
      }
    } else {
      console.log('No results found');
    }
  } catch (error) {
    console.error('Search failed:', error.message);
    process.exit(1);
  }
}

// Main
const query = process.argv.slice(2).join('&');
if (!query) {
  console.error('Usage: node search-callsigns.js <query>');
  console.error('');
  console.error('Examples:');
  console.error('  node search-callsigns.js name=Smith');
  console.error('  node search-callsigns.js city=Seattle');
  console.error('  node search-callsigns.js state=WA&limit=10');
  console.error('  node search-callsigns.js "name=John Smith"');
  process.exit(1);
}

searchCallsigns(query);
