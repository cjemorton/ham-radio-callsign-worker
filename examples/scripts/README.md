# Ham Radio Callsign Worker - Example Scripts

This directory contains example Node.js scripts demonstrating how to interact with the Ham Radio Callsign Worker API.

## Prerequisites

- Node.js 18+ (scripts use native `fetch` API)
- A running instance of the Ham Radio Callsign Worker (default: `http://localhost:8787`)

## Configuration

All scripts support the following environment variable:

- `WORKER_URL` - Base URL of the worker (default: `http://localhost:8787`)

Admin scripts additionally require:

- `ADMIN_API_KEY` - API key for administrative operations

## Scripts

### 1. query-callsign.js

Query information for a specific callsign.

**Usage:**
```bash
node query-callsign.js <callsign>
```

**Examples:**
```bash
node query-callsign.js K1ABC
node query-callsign.js W2XYZ

# Using a different worker URL
WORKER_URL=https://example.com node query-callsign.js N3QRS
```

**Features:**
- Rate limit monitoring
- Formatted JSON output
- Error handling

---

### 2. search-callsigns.js

Search for callsigns using query parameters.

**Usage:**
```bash
node search-callsigns.js <query>
```

**Examples:**
```bash
# Search by name
node search-callsigns.js name=Smith

# Search by city
node search-callsigns.js city=Seattle

# Search by state
node search-callsigns.js state=WA

# Multiple parameters
node search-callsigns.js state=WA city=Seattle

# With pagination
node search-callsigns.js name=Johnson limit=10 page=2
```

**Features:**
- Multiple query parameters support
- Pagination information
- Rate limit monitoring

---

### 3. check-status.js

Check the health and status of the worker.

**Usage:**
```bash
node check-status.js
```

**Examples:**
```bash
# Check local worker
node check-status.js

# Check remote worker
WORKER_URL=https://example.com node check-status.js
```

**Features:**
- Health check endpoint
- Status information (version, last update, record count)
- Rate limit information
- Worker operational status

**Output includes:**
- Health status
- API version
- Last data update timestamp
- Total record count
- Rate limit configuration

---

### 4. trigger-update.js

Trigger an administrative data update operation.

**Usage:**
```bash
ADMIN_API_KEY=your-key node trigger-update.js
```

**Examples:**
```bash
# Trigger update on local worker
ADMIN_API_KEY=my-secret-key node trigger-update.js

# Trigger update on remote worker
WORKER_URL=https://example.com ADMIN_API_KEY=my-secret-key node trigger-update.js
```

**Requirements:**
- `ADMIN_API_KEY` environment variable must be set
- Proper admin privileges

**Features:**
- Secure admin authentication
- Update status reporting
- Error handling

---

### 5. bulk-query.js

Query multiple callsigns from a file.

**Usage:**
```bash
node bulk-query.js <filename>
```

**File Format:**
```
# One callsign per line
K1ABC
W2XYZ
N3QRS
# Lines starting with # are ignored
```

**Examples:**
```bash
# Create a sample file
cat > callsigns.txt << EOF
K1ABC
W2XYZ
N3QRS
EOF

# Run bulk query
node bulk-query.js callsigns.txt

# With custom delay to avoid rate limiting
DELAY_MS=200 node bulk-query.js callsigns.txt

# Query from remote worker
WORKER_URL=https://example.com node bulk-query.js callsigns.txt
```

**Environment Variables:**
- `WORKER_URL` - Worker URL (default: `http://localhost:8787`)
- `DELAY_MS` - Delay between requests in milliseconds (default: `100`)

**Features:**
- Progress indication
- Rate limit monitoring
- Automatic delay between requests
- Results summary
- JSON output file (e.g., `callsigns-results.json`)

**Output:**
- Real-time progress for each callsign
- Success/error count summary
- Detailed JSON results file

---

## Making Scripts Executable

To run scripts without the `node` prefix:

```bash
# Make all scripts executable
chmod +x *.js

# Now you can run them directly
./query-callsign.js K1ABC
./search-callsigns.js name=Smith
./check-status.js
```

## Rate Limiting

All scripts respect rate limits and display rate limit information:

- `X-RateLimit-Limit` - Maximum requests allowed
- `X-RateLimit-Remaining` - Remaining requests in current window
- `X-RateLimit-Reset` - Time when the limit resets

The `bulk-query.js` script includes automatic delays between requests to help avoid hitting rate limits.

## Error Handling

All scripts include comprehensive error handling:

- Network errors
- API errors (4xx, 5xx responses)
- Rate limit exceeded
- Invalid input
- Missing credentials (for admin operations)

## Development

These scripts are meant as examples and starting points. You can:

- Copy and modify them for your specific use case
- Use them as reference for API integration
- Extend them with additional features
- Integrate them into your own applications

## API Documentation

For complete API documentation, see the main project README and API specification.

## Support

For issues or questions:
1. Check the main project documentation
2. Review the API response error messages
3. Ensure your worker is running and accessible
4. Verify environment variables are set correctly

## License

These example scripts are provided as-is for demonstration purposes.
