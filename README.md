# Ham Radio Callsign Worker

A Cloudflare Worker service for ham radio callsign lookups, database management, and administrative functions.

## Table of Contents

- [Project Background](#project-background)
- [Architectural Vision](#architectural-vision)
- [High-Level Design & Requirements](#high-level-design--requirements)
- [Getting Started](#getting-started)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

## Project Background

This project implements a serverless API for ham radio callsign data management and lookups using Cloudflare Workers. The service is designed to be fast, globally distributed, and highly available, leveraging Cloudflare's edge network to provide low-latency responses worldwide.

### Purpose

The Ham Radio Callsign Worker serves several key purposes:

1. **Callsign Lookups**: Fast, efficient lookups of amateur radio callsigns with detailed information
2. **Database Management**: Administrative functions for maintaining and updating callsign databases
3. **Data Export**: Capabilities for exporting callsign data in various formats
4. **Health Monitoring**: Endpoint monitoring and system health reporting

### Target Audience

- Amateur radio operators looking up callsign information
- Ham radio applications and services needing callsign data
- Database administrators managing callsign records
- Developers integrating callsign lookups into their applications

## Architectural Vision

The system is built on Cloudflare's serverless platform with the following architectural principles:

### Core Technologies

- **Cloudflare Workers**: Serverless compute platform running on V8 isolates
- **TypeScript**: Strongly-typed language for improved developer experience and code quality
- **Wrangler 3**: Latest CLI tooling for Cloudflare Workers development and deployment
- **Cloudflare D1**: SQLite-based database for callsign data storage
- **Cloudflare KV**: Key-value store for caching and metadata
- **Cloudflare R2**: Object storage for data exports and backups

### Design Principles

1. **Edge-First**: Leverage Cloudflare's global network for low-latency responses
2. **Serverless**: No infrastructure management, automatic scaling
3. **Type Safety**: TypeScript throughout for compile-time error detection
4. **API-First**: RESTful API design with comprehensive documentation
5. **Security**: API key authentication, rate limiting, and input validation
6. **Observability**: Structured logging and monitoring capabilities
7. **Maintainability**: Clean code, comprehensive tests, clear documentation

### System Architecture

```
┌─────────────────┐
│   Client Apps   │
│  (Web, Mobile)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Cloudflare     │
│  Edge Network   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│     Ham Radio Callsign Worker           │
│  ┌──────────────────────────────────┐   │
│  │  API Router & Request Handler    │   │
│  └──────────────┬───────────────────┘   │
│                 │                        │
│  ┌──────────────┴───────────────────┐   │
│  │                                  │   │
│  │  User Endpoints  Admin Endpoints │   │
│  │  - Query         - Force Update  │   │
│  │  - Search        - Rebuild       │   │
│  │  - Export        - Rollback      │   │
│  │  - Health        - Logs          │   │
│  │                                  │   │
│  └──────────────┬───────────────────┘   │
└─────────────────┼───────────────────────┘
                  │
     ┌────────────┼────────────┐
     │            │            │
     ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│   D1    │  │   KV    │  │   R2    │
│Database │  │ Storage │  │ Storage │
└─────────┘  └─────────┘  └─────────┘
```

## High-Level Design & Requirements

### Phase 1: Project Initialization ✅ (Current Phase)

- [x] Initialize Cloudflare Worker project with TypeScript
- [x] Set up Wrangler 3 configuration
- [x] Establish directory structure
- [x] Create comprehensive README
- [x] Add meta files (.gitignore, LICENSE, CONTRIBUTING.md)
- [x] Basic health and version endpoints

### Phase 2: API and Endpoint Layer ✅ (Completed)

Based on [Issue #1](https://github.com/cjemorton/ham-radio-callsign-worker/issues/1):

#### User Endpoints (Public API)

- **Query Endpoints**
  - `GET /api/v1/callsign/:callsign` - Look up specific callsign ✅
  - `GET /api/v1/search?q={query}` - Search callsigns by various fields ✅
  - `GET /api/v1/export?format={format}` - Database export functionality ✅
  
- **Utility Endpoints**
  - `GET /health` - System health check ✅
  - `GET /version` - API version information ✅

#### Admin Endpoints (Authenticated)

- **Database Management**
  - `POST /admin/update` - Force database update ✅
  - `POST /admin/rebuild` - Full database rebuild ✅
  - `POST /admin/rollback` - Rollback to previous version ✅
  
- **Monitoring**
  - `GET /admin/logs` - View system logs ✅
  - `GET /admin/metadata` - View database metadata ✅
  - `GET /admin/stats` - System statistics ✅

#### Cross-Cutting Concerns

- **Authentication**: API key-based for admin endpoints (JWT support flagged for future) ✅
- **Rate Limiting**: Applied to all endpoints (100/min user, 20/min admin) ✅
- **CORS**: Configurable cross-origin resource sharing ✅
- **Error Handling**: Consistent error response format ✅
- **Logging**: Structured logging for all requests ✅
- **Documentation**: Comprehensive API documentation with examples ✅

### Phase 3: Data Layer & Storage

- D1 database schema design for callsign data
- KV namespace setup for caching frequently accessed data
- KV namespace for metadata and configuration
- R2 bucket configuration for exports and backups
- Data migration and seeding utilities

### Phase 4: Business Logic

- Callsign lookup and validation logic
- Search and query processing
- Data export generation (JSON, CSV, etc.)
- Database update and synchronization logic

### Phase 5: Security & Rate Limiting

- API key authentication system
- JWT authentication preparation
- Rate limiting implementation
- Input validation and sanitization
- Security headers and CORS configuration

### Phase 6: Testing & Quality

- Unit tests for all modules
- Integration tests for API endpoints
- Load testing and performance optimization
- Security auditing

### Phase 7: Documentation & Deployment

- OpenAPI/Swagger specification
- API usage examples and tutorials
- Deployment documentation
- Monitoring and alerting setup

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Cloudflare account (free tier is sufficient for development)
- Wrangler CLI installed globally: `npm install -g wrangler`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/cjemorton/ham-radio-callsign-worker.git
   cd ham-radio-callsign-worker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Authenticate with Cloudflare:
   ```bash
   wrangler login
   ```

4. Run development server:
   ```bash
   npm run dev
   ```

The worker will be available at `http://localhost:8787`

## API Endpoints

### Overview

The Ham Radio Callsign Worker provides a RESTful API with two main categories of endpoints:

1. **User Endpoints** (`/api/v1/*`): Public-facing endpoints for callsign lookups and searches
2. **Admin Endpoints** (`/admin/*`): Administrative functions requiring API key authentication

All endpoints return JSON responses and include CORS headers for cross-origin access.

### Authentication

#### User Endpoints
User endpoints are publicly accessible but rate-limited to prevent abuse.

#### Admin Endpoints
Admin endpoints require authentication via API key. Provide your API key in one of two ways:

**Option 1: X-API-Key Header**
```bash
curl -H "X-API-Key: your-api-key-here" https://your-worker.workers.dev/admin/stats
```

**Option 2: Authorization Bearer Token**
```bash
curl -H "Authorization: Bearer your-api-key-here" https://your-worker.workers.dev/admin/stats
```

**Setting Up Admin API Key**

The admin API key must be configured as a secret in your Cloudflare Worker:

```bash
wrangler secret put ADMIN_API_KEY
# Enter your secret API key when prompted
```

### Rate Limiting

All endpoints are rate-limited to ensure fair usage:

- **User Endpoints**: 100 requests per minute per IP address
- **Admin Endpoints**: 20 requests per minute per API key

Rate limit information is included in response headers:
- `X-RateLimit-Limit`: Maximum number of requests allowed
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Timestamp when the rate limit resets

When rate limited, you'll receive a `429 Too Many Requests` response with details about when you can retry.

### User Endpoints

#### GET /health

Health check endpoint for monitoring service availability.

**Request:**
```bash
curl https://your-worker.workers.dev/health
```

**Response:**
```json
{
  "status": "ok",
  "service": "ham-radio-callsign-worker",
  "version": "0.1.0",
  "environment": "production",
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Service is healthy

---

#### GET /version

Returns API version information.

**Request:**
```bash
curl https://your-worker.workers.dev/version
```

**Response:**
```json
{
  "version": "0.1.0",
  "api_version": "v1",
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Success

---

#### GET /api/v1/callsign/:callsign

Look up information for a specific amateur radio callsign.

**Request:**
```bash
curl https://your-worker.workers.dev/api/v1/callsign/K1ABC
```

**Path Parameters:**
- `callsign` (required): The amateur radio callsign to look up (e.g., K1ABC, W2XYZ)

**Response:**
```json
{
  "success": true,
  "data": {
    "callsign": "K1ABC",
    "name": "John Doe",
    "license_class": "Extra",
    "state": "CA",
    "country": "USA",
    "grid_square": "CM97"
  },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Callsign found
- `400 Bad Request`: Invalid callsign format
- `404 Not Found`: Callsign not found
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: Database not available

**Example Error Response:**
```json
{
  "error": "Bad Request",
  "message": "Invalid callsign format",
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

---

#### GET /api/v1/search

Search for callsigns using various criteria.

**Request:**
```bash
curl "https://your-worker.workers.dev/api/v1/search?q=smith"
```

**Query Parameters:**
- `q` (required): Search query (searches across callsign, name, city, state, etc.)

**Response:**
```json
{
  "success": true,
  "data": {
    "query": "smith",
    "count": 2,
    "results": [
      {
        "callsign": "K1ABC",
        "name": "Alice Smith",
        "license_class": "General",
        "state": "MA"
      },
      {
        "callsign": "W2XYZ",
        "name": "Bob Smith",
        "license_class": "Extra",
        "state": "NY"
      }
    ]
  },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Search successful
- `400 Bad Request`: Missing or invalid query parameter
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: Database not available

---

#### GET /api/v1/export

Export the callsign database in various formats.

**Request:**
```bash
curl "https://your-worker.workers.dev/api/v1/export?format=json"
```

**Query Parameters:**
- `format` (optional): Export format - `json` or `csv` (default: `json`)

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Export functionality will generate a downloadable file",
    "format": "json",
    "status": "pending",
    "note": "This is a placeholder. Full implementation requires R2 bucket configuration."
  },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Export initiated
- `400 Bad Request`: Invalid format
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: Export storage not available

---

### Admin Endpoints

All admin endpoints require authentication via API key.

#### POST /admin/update

Force an immediate database update from the data source.

**Request:**
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  https://your-worker.workers.dev/admin/update
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Database update initiated",
    "status": "pending",
    "timestamp": "2026-01-26T12:00:00.000Z",
    "note": "This is a placeholder. Full implementation requires database update logic."
  },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Update initiated
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: Database not available

---

#### POST /admin/rebuild

Perform a full database rebuild from scratch.

**Request:**
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  https://your-worker.workers.dev/admin/rebuild
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Database rebuild initiated",
    "status": "pending",
    "timestamp": "2026-01-26T12:00:00.000Z",
    "note": "This is a placeholder. Full implementation requires database rebuild logic."
  },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Rebuild initiated
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: Database not available

---

#### POST /admin/rollback

Rollback the database to a previous version.

**Request:**
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"version": "1.2.3"}' \
  https://your-worker.workers.dev/admin/rollback
```

**Request Body (optional):**
```json
{
  "version": "1.2.3"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Database rollback initiated",
    "targetVersion": "1.2.3",
    "status": "pending",
    "timestamp": "2026-01-26T12:00:00.000Z",
    "note": "This is a placeholder. Full implementation requires database versioning logic."
  },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Rollback initiated
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: Database not available

---

#### GET /admin/logs

View system logs with optional filtering.

**Request:**
```bash
curl -H "X-API-Key: your-api-key" \
  "https://your-worker.workers.dev/admin/logs?limit=50&level=error"
```

**Query Parameters:**
- `limit` (optional): Maximum number of log entries to return (default: 100)
- `level` (optional): Filter by log level - `debug`, `info`, `warn`, `error`

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 3,
    "limit": 100,
    "logs": [
      {
        "timestamp": "2026-01-26T12:00:00.000Z",
        "level": "info",
        "message": "Service started",
        "details": {
          "version": "0.1.0"
        }
      },
      {
        "timestamp": "2026-01-26T11:59:00.000Z",
        "level": "info",
        "message": "Health check passed"
      },
      {
        "timestamp": "2026-01-26T11:58:00.000Z",
        "level": "warn",
        "message": "Rate limit warning",
        "details": {
          "clientIp": "192.168.1.1"
        }
      }
    ],
    "note": "This is placeholder data. Full implementation requires log storage."
  },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Logs retrieved
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded

---

#### GET /admin/metadata

View database metadata and statistics.

**Request:**
```bash
curl -H "X-API-Key: your-api-key" \
  https://your-worker.workers.dev/admin/metadata
```

**Response:**
```json
{
  "success": true,
  "data": {
    "database": {
      "version": "1.0.0",
      "recordCount": 1000000,
      "lastUpdated": "2026-01-25T12:00:00.000Z",
      "size": "250MB"
    },
    "cache": {
      "hitRate": 0.85,
      "entryCount": 50000
    },
    "note": "This is placeholder data. Full implementation requires metadata storage."
  },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Metadata retrieved
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded
- `503 Service Unavailable`: Metadata store not available

---

#### GET /admin/stats

View comprehensive system statistics.

**Request:**
```bash
curl -H "X-API-Key: your-api-key" \
  https://your-worker.workers.dev/admin/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "requests": {
      "total": 150000,
      "last24h": 5000,
      "avgResponseTime": 45
    },
    "endpoints": {
      "/api/v1/callsign": 120000,
      "/api/v1/search": 25000,
      "/api/v1/export": 500,
      "/health": 4500
    },
    "rateLimit": {
      "blocked": 250,
      "allowed": 149750
    },
    "uptime": "15d 6h 32m",
    "note": "This is placeholder data. Full implementation requires analytics storage."
  },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Statistics retrieved
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded

---

### Response Format

All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Error Response:**
```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "timestamp": "2026-01-26T12:00:00.000Z",
  "details": { ... }
}
```

### CORS Support

All endpoints include CORS headers to allow cross-origin requests:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key`

To handle preflight requests, send an `OPTIONS` request to any endpoint.

### Error Codes

| Status Code | Description |
|-------------|-------------|
| `200 OK` | Request successful |
| `400 Bad Request` | Invalid request parameters |
| `401 Unauthorized` | Missing or invalid authentication |
| `404 Not Found` | Resource not found |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server error |
| `503 Service Unavailable` | Service temporarily unavailable |

---

## Configuration

### Environment Variables

Configuration is managed through `wrangler.toml` and environment-specific variables:

- `ENVIRONMENT`: Deployment environment (development, staging, production)
- `LOG_LEVEL`: Logging verbosity (debug, info, warn, error)

### Cloudflare Bindings

The following Cloudflare resources are configured as placeholders in `wrangler.toml`:

- **KV Namespaces**:
  - `CALLSIGN_CACHE`: For caching callsign lookup results
  - `METADATA_STORE`: For system metadata and configuration

- **D1 Database**:
  - `CALLSIGN_DB`: Main database for callsign data

- **R2 Bucket**:
  - `DATA_EXPORTS`: For storing data exports and backups

To activate these bindings, uncomment the relevant sections in `wrangler.toml` and configure the resource IDs through the Cloudflare dashboard.

## Development

### Project Structure

```
ham-radio-callsign-worker/
├── src/                    # Source code
│   └── index.ts           # Worker entry point
├── test/                  # Test files
│   └── index.test.ts      # Test suite
├── scripts/               # Utility scripts
├── wrangler.toml          # Wrangler configuration
├── tsconfig.json          # TypeScript configuration
├── package.json           # Node.js dependencies
├── README.md              # This file
├── CONTRIBUTING.md        # Contribution guidelines
└── LICENSE                # License information
```

### Available Scripts

- `npm run dev` - Start local development server
- `npm run deploy` - Deploy to Cloudflare Workers
- `npm test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run build` - Type-check TypeScript
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run cf-typegen` - Generate TypeScript types from Wrangler config

### Code Style

This project uses:
- **TypeScript** for type safety
- **ESLint** for code linting
- **Prettier** for code formatting

Run `npm run format` before committing to ensure consistent code style.

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Test Structure

Tests are located in the `test/` directory and use Vitest as the testing framework. Each module should have corresponding test files with the `.test.ts` extension.

### Writing Tests

Follow these guidelines when writing tests:

1. Use descriptive test names
2. Test both success and error cases
3. Mock external dependencies (KV, D1, R2)
4. Aim for high code coverage on business logic

## Deployment

### Development Deployment

```bash
npm run dev
```

This starts a local development server on `http://localhost:8787`

### Production Deployment

1. Update `wrangler.toml` with production settings
2. Deploy to Cloudflare:
   ```bash
   npm run deploy
   ```

### Environment-Specific Deployments

```bash
# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production
```

## Logging

The worker uses structured logging with configurable log levels:

- `debug`: Detailed debugging information
- `info`: General informational messages
- `warn`: Warning messages
- `error`: Error messages

Log level is configured via the `LOG_LEVEL` environment variable in `wrangler.toml`.

## Rate Limiting

Rate limiting will be implemented to protect the API from abuse. Planned limits:

- **User Endpoints**: 100 requests/minute per IP
- **Admin Endpoints**: 20 requests/minute per API key
- **Export Endpoints**: 10 requests/hour per API key

Implementation details will be added in Phase 5.

## Security

### Current Security Measures

- CORS headers for API access control
- Input validation on all endpoints
- Secure headers in responses

### Planned Security Enhancements

- API key authentication for admin endpoints
- JWT token support for future authentication
- Rate limiting across all endpoints
- Request validation and sanitization
- SQL injection prevention
- XSS protection

## Monitoring

### Health Checks

The `/health` endpoint provides basic system status. Future enhancements will include:

- Database connectivity checks
- KV namespace availability
- R2 bucket access verification
- Response time metrics

### Metrics

Cloudflare Workers provides built-in metrics:
- Request count
- Error rate
- CPU time
- Bandwidth usage

Access these through the Cloudflare Dashboard.

## Performance Considerations

- Leverage Cloudflare's global CDN for low-latency responses
- Use KV for caching frequently accessed data
- Optimize D1 queries with proper indexing
- Implement efficient search algorithms
- Monitor and optimize cold start times

## Roadmap

1. **Phase 1** ✅: Project initialization and scaffolding
2. **Phase 2** ✅: API endpoint implementation (Issue #1) - **COMPLETED**
3. **Phase 3**: Data layer and storage setup
4. **Phase 4**: Business logic implementation
5. **Phase 5**: Security and rate limiting enhancements
6. **Phase 6**: Testing and quality assurance
7. **Phase 7**: Documentation and production deployment

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Run linter (`npm run lint`)
6. Format code (`npm run format`)
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues, questions, or contributions, please:
- Open an issue on GitHub
- Review existing issues and discussions
- Follow the contribution guidelines

## Acknowledgments

- Cloudflare Workers platform and community
- Amateur radio community
- Contributors and maintainers

---

**Status**: 🚧 Active Development | **Version**: 0.1.0 | **Last Updated**: 2024-01-26
