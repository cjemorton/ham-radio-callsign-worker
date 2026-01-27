# Ham Radio Callsign Worker

A Cloudflare Worker service for ham radio callsign lookups, database management, and administrative functions.

> 📋 **For a comprehensive architectural overview, development roadmap, and implementation details, see [ARCHITECTURE.md](./ARCHITECTURE.md)**

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
- [Logging](#logging)
- [Data Update Workflow](#data-update-workflow)
- [Security](#security)
- [Monitoring](#monitoring)
- [Performance Considerations](#performance-considerations)
- [Progressive Web App (PWA) Integration](#progressive-web-app-pwa-integration)
- [Rate Limiting](#rate-limiting)
- [External Database Synchronization](#external-database-synchronization)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)
- [Acknowledgments](#acknowledgments)

## Project Background

This project implements a serverless API for ham radio callsign data management and lookups using Cloudflare Workers. The service is designed to be fast, globally distributed, and highly available, leveraging Cloudflare's edge network to provide low-latency responses worldwide.

### Purpose

The Ham Radio Callsign Worker serves several key purposes:

1. **Callsign Lookups**: Fast, efficient lookups of amateur radio callsigns with detailed information
2. **Database Management**: Administrative functions for maintaining and updating callsign databases
3. **Data Synchronization**: Intelligent data fetching, validation, and differential updates from external sources
4. **Multi-Tier Caching**: Distributed caching across Cloudflare infrastructure and optional external caches
5. **Data Export**: Capabilities for exporting callsign data in various formats
6. **Health Monitoring**: Endpoint monitoring and system health reporting

### Key Features

- **On-Demand Data Updates**: Automatic and manual triggers for fetching latest callsign data
- **Intelligent Diffing**: Only updates changed records to minimize database operations
- **Validation & Integrity**: Hash-based validation and schema verification for all data
- **Fallback & Recovery**: Automatic rollback to last known good data on validation failures
- **Distributed Sync**: Optional synchronization to external SQL databases and Redis caches
- **Comprehensive Logging**: Structured JSONL logs with audit trails stored in R2
- **Progressive Web App Support**: API designed for integration with PWAs and mobile applications

### Target Audience

- Amateur radio operators looking up callsign information
- Ham radio applications and services needing callsign data
- Database administrators managing callsign records
- Developers integrating callsign lookups into their applications
- Organizations requiring distributed callsign database synchronization

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

The architecture follows a multi-tier design with Cloudflare Workers at the core, supported by Cloudflare's data services and optional external synchronization targets.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Applications                         │
│            (Web Apps, Mobile Apps, PWAs, IoT Devices)           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Cloudflare Edge Network                        │
│                  (Global CDN & DDoS Protection)                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Ham Radio Callsign Worker (Core)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           API Router & Request Handler                   │   │
│  │  - Authentication & Authorization                        │   │
│  │  - Rate Limiting & CORS                                  │   │
│  │  - Structured Logging                                    │   │
│  └────────────────┬────────────────────────────┬────────────┘   │
│                   │                            │                │
│  ┌────────────────▼────────────┐  ┌────────────▼─────────────┐  │
│  │   User API Endpoints        │  │  Admin API Endpoints     │  │
│  │  - Query (/api/v1/callsign) │  │  - Update (/admin/update)│  │
│  │  - Search (/api/v1/search)  │  │  - Rebuild               │  │
│  │  - Export (/api/v1/export)  │  │  - Rollback              │  │
│  │  - Health (/health)         │  │  - Logs & Metadata       │  │
│  └────────────────┬────────────┘  └────────────┬─────────────┘  │
│                   │                            │                │
│  ┌────────────────▼────────────────────────────▼─────────────┐  │
│  │              Business Logic Layer                         │  │
│  │  ┌───────────────┐  ┌──────────────┐  ┌────────────────┐ │  │
│  │  │Configuration  │  │Data Fetch &  │  │ Diff & Patch   │ │  │
│  │  │Manager        │  │Validation    │  │ Engine         │ │  │
│  │  └───────────────┘  └──────────────┘  └────────────────┘ │  │
│  │  ┌───────────────┐  ┌──────────────┐  ┌────────────────┐ │  │
│  │  │Callsign Query │  │Export        │  │Slave Sync      │ │  │
│  │  │& Search       │  │Generator     │  │Propagation     │ │  │
│  │  └───────────────┘  └──────────────┘  └────────────────┘ │  │
│  └───────────────────────────┬──────────────────────────────┘  │
└────────────────────────────┬─┼──────────────────────────────────┘
                             │ │
         ┌───────────────────┼─┼───────────────────┐
         │                   │ │                   │
         ▼                   ▼ ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Cloudflare KV   │  │ Cloudflare D1   │  │ Cloudflare R2   │
│   Namespaces    │  │    Database     │  │  Object Storage │
│                 │  │                 │  │                 │
│ • Config Store  │  │ • Callsign Data │  │ • Data Exports  │
│ • Cache Layer   │  │ • Indexes       │  │ • Backup Files  │
│ • Metadata      │  │ • Version Info  │  │ • Audit Logs    │
└─────────────────┘  └─────────────────┘  │ • Diff Reports  │
                                           │ • Event Logs    │
                                           └─────────────────┘

      Optional External Synchronization (Phase 6)
      ┌───────────────────────────────────────────┐
      │                                           │
      ▼                                           ▼
┌─────────────────┐                    ┌─────────────────┐
│  External SQL   │                    │ External Redis  │
│   Databases     │                    │     Caches      │
│                 │                    │                 │
│ • Slave Sync    │                    │ • Distributed   │
│ • Read Replicas │                    │   Caching       │
│ • Analytics     │                    │ • Session Store │
└─────────────────┘                    └─────────────────┘

                   Data Source (External)
                   ┌─────────────────┐
                   │  Origin Server  │
                   │                 │
                   │ • ZIP Archives  │
                   │ • Source Data   │
                   │ • Updates       │
                   └─────────────────┘
```

**Data Flow**:
1. **Query Flow**: Client → Edge Network → Worker → D1/KV Cache → Response
2. **Update Flow**: Admin → Worker → Fetch ZIP → Validate → Diff → Patch D1 → Sync Slaves → Log to R2
3. **Configuration Flow**: KV Config Store → Worker Configuration Module → Runtime Behavior
4. **Monitoring Flow**: All Operations → Structured Logs → R2 Storage → Admin Endpoints

## High-Level Design & Requirements

This project follows a phased development approach as outlined in [Issue #4](https://github.com/cjemorton/ham-radio-callsign-worker/issues/4). Each phase builds upon the previous one to create a robust, production-ready callsign lookup service.

### Phase 1: Project Initialization ✅ (Completed)

**Status**: Complete

- [x] Initialize Cloudflare Worker project with TypeScript
- [x] Set up Wrangler 3 configuration
- [x] Establish directory structure
- [x] Create comprehensive README
- [x] Add meta files (.gitignore, LICENSE, CONTRIBUTING.md)
- [x] Basic health and version endpoints

### Phase 2: API and Endpoint Layer ✅ (Completed)

**Status**: Complete | **Reference**: [Issue #1](https://github.com/cjemorton/ham-radio-callsign-worker/issues/1)

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
  - `POST /admin/fetch` - Trigger on-demand fetch/extract/validate ✅
  
- **Monitoring**
  - `GET /admin/logs` - View system logs ✅
  - `GET /admin/metadata` - View database metadata ✅
  - `GET /admin/stats` - System statistics ✅
  - `GET /admin/diffs` - View diff history ✅

#### Cross-Cutting Concerns

- **Authentication**: API key-based for admin endpoints (JWT support flagged for future) ✅
- **Rate Limiting**: Applied to all endpoints (100/min user, 20/min admin) ✅
- **CORS**: Configurable cross-origin resource sharing ✅
- **Error Handling**: Consistent error response format ✅
- **Logging**: Structured logging for all requests ✅
- **Documentation**: Comprehensive API documentation with examples ✅

### Phase 3: Configuration and Infrastructure Setup

**Status**: Planned | **Reference**: [Issue #5](https://github.com/cjemorton/ham-radio-callsign-worker/issues/5)

**Objective**: Establish the configuration management system for dynamic, centralized control of all worker behavior and data sources.

#### Key Deliverables:

- [ ] **Configuration Module Development**
  - Implement configuration loading/refresh from a single namespaced JSON object in Cloudflare KV
  - Support dynamic reloading without redeployment
  
- [ ] **Infrastructure Configuration Storage**
  - Origin ZIP URL and file naming configuration
  - Expected data schema and validation rules
  - Backup and fallback endpoint configurations
  - Slave SQL/Redis connection configurations
  - Feature flags (JWT, canary deployments, etc.)
  
- [ ] **Configuration Management**
  - Version tracking and hash validation for configurations
  - Configuration rollback capability (admin function)
  - Configuration health/version endpoint
  
- [ ] **Documentation**
  - Document required configuration structure and schema
  - Provide configuration examples and best practices
  - Document configuration update procedures

This phase establishes the foundation for all subsequent data operations by providing a centralized, version-controlled configuration system.

### Phase 4: Data Fetch, Extraction, and Validation Engine

**Status**: Planned | **Reference**: [Issue #12](https://github.com/cjemorton/ham-radio-callsign-worker/issues/12)

**Objective**: Build the core engine for on-demand data fetching, extraction, and validation from external sources.

#### Key Deliverables:

- [ ] **Data Fetching Engine**
  - Fetch ZIP files from KV-configured origin URLs
  - Trigger fetches based on staleness detection or on-demand requests
  - Implement retry logic with exponential backoff
  
- [ ] **Extraction and Validation**
  - Extract target files from ZIP archives
  - Validate file presence and integrity using hash validation
  - Verify header/schema match against KV configuration
  - Content validation against expected data format
  
- [ ] **Error Handling and Fallback**
  - Comprehensive error logging for fetch/validation failures
  - Fallback to last known good data on validation failures
  - Store event logs, metadata, and diffs in R2 (JSONL format with rotation)
  
- [ ] **Staging and Deployment Features**
  - Staging/canary deployment support via configuration flags
  - Admin endpoints for manual data refresh triggers
  
- [ ] **Documentation**
  - Document fetch/extract/validate workflow
  - Provide troubleshooting guide for common failure scenarios
  - Update README with endpoint documentation

### Phase 5: Data Diffing, Patching, and Recovery

**Status**: Planned | **Reference**: [Issue #11](https://github.com/cjemorton/ham-radio-callsign-worker/issues/11)

**Objective**: Implement intelligent differential updates to minimize database operations and enable safe rollbacks.

#### Key Deliverables:

- [ ] **Differential Analysis**
  - Compare newly extracted data with previous version by hash and record keys
  - Identify records to add, update, and remove
  - Generate comprehensive diff reports
  
- [ ] **Efficient Database Patching**
  - Patch Cloudflare D1 database with only changed records
  - Minimize write operations for better performance
  - Transactional updates to ensure data consistency
  
- [ ] **Metadata and Reporting**
  - Calculate and store diff reports in R2
  - Track update statistics (records added/modified/removed)
  - Maintain version history with timestamps
  
- [ ] **Recovery and Rollback**
  - Safe rollback to last known good version
  - Admin-triggered or automatic fallback on validation failures
  - Data backup before each update operation
  
- [ ] **Documentation**
  - Document diff/patch/recovery process
  - Provide logging approach and troubleshooting steps
  - Update README with rollback procedures

### Phase 6: Slave Synchronization and External Cache Layer

**Status**: Planned | **Reference**: [Issue #10](https://github.com/cjemorton/ham-radio-callsign-worker/issues/10)

**Objective**: Enable synchronization with external SQL databases and Redis caches for distributed deployments.

#### Key Deliverables:

- [ ] **Dynamic Slave Configuration**
  - Load slave SQL/Redis endpoints from KV configuration
  - Support multiple slave targets with independent configurations
  - Hot-reload slave configurations without service interruption
  
- [ ] **Propagation Engine**
  - Propagate delta updates to all configured slaves after master updates
  - Implement minimal change propagation (only changed records)
  - Parallel synchronization to multiple targets
  
- [ ] **Health Tracking and Monitoring**
  - Track sync events and last-sync metadata for each slave
  - Monitor slave endpoint health and availability
  - Generate sync status reports
  
- [ ] **Error Handling**
  - Graceful fallback when slave endpoints are unavailable
  - Log errors without blocking core worker functionality
  - Implement retry logic with configurable parameters
  
- [ ] **Canary Deployments**
  - Support canary rollout via admin-configured flags
  - Gradual slave activation for testing
  
- [ ] **Documentation**
  - Document slave configuration structure
  - Provide setup guide for SQL/Redis slaves
  - Update README with synchronization workflow details

### Phase 7: Logging, Audit, and Monitoring Infrastructure

**Status**: Planned | **Reference**: [Issue #8](https://github.com/cjemorton/ham-radio-callsign-worker/issues/8)

**Objective**: Establish comprehensive logging, audit trails, and monitoring capabilities for operational visibility.

#### Key Deliverables:

- [ ] **Structured Logging System**
  - Implement JSONL-formatted logs stored in R2
  - Event-level and error-level logging with appropriate detail
  - Automatic log rotation to manage storage
  
- [ ] **Audit Trails**
  - Track all data updates, configuration changes, and admin actions
  - Maintain version history with full audit metadata
  - Store diff reports for each update cycle
  
- [ ] **Monitoring Endpoints**
  - Metadata endpoints for viewing status, version, and logs
  - Health check endpoints with detailed component status
  - Performance metrics and statistics endpoints
  
- [ ] **Operational Procedures**
  - Log inspection and retrieval tools
  - Log rotation and archival procedures
  - Error/fallback/recovery event handling documentation
  
- [ ] **Documentation**
  - Document logging structure and format
  - Provide log analysis and troubleshooting guide
  - Update README with all monitoring procedures

### Phase 8: Testing, E2E Verification, and PWA Integration

**Status**: Planned | **Reference**: [Issue #7](https://github.com/cjemorton/ham-radio-callsign-worker/issues/7)

**Objective**: Establish comprehensive testing infrastructure and provide integration examples for client applications.

#### Key Deliverables:

- [ ] **Testing Infrastructure**
  - Modular unit test suites for each component
  - Integration tests for API endpoints and workflows
  - End-to-end test harness for update+query cycles
  - Leverage Cloudflare testing frameworks (Miniflare, Wrangler dev)
  
- [ ] **Component-Specific Tests**
  - KV configuration loading and validation tests
  - Fetch/validation engine tests with mock data
  - Diffing and patching logic tests
  - Endpoint authentication and authorization tests
  
- [ ] **Edge Case Testing**
  - Manual test flows for data edge cases
  - Failure and fallback scenario testing
  - Recovery and rollback verification
  - Rate limiting and security tests
  
- [ ] **Integration Examples**
  - Sample scripts for cache/DB synchronization
  - Query examples for all storage layers
  - API usage examples and best practices
  
- [ ] **Progressive Web App (PWA) Integration**
  - PWA integration guide and documentation
  - Sample PWA implementation with API usage
  - Offline caching strategies
  - Real-time update notifications
  
- [ ] **Documentation**
  - Comprehensive testing guide
  - API integration examples
  - PWA development guide
  - Update README with testing and integration information

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

#### POST /admin/fetch

Trigger the on-demand fetch, extraction, and validation engine. This endpoint orchestrates the complete data pipeline:
1. Fetches ZIP file from the configured origin URL
2. Extracts the target file from the ZIP
3. Validates data integrity (hash, schema, headers)
4. Falls back to last known good data if validation fails
5. Logs all events to R2 storage

This is the primary endpoint for manually triggering data updates with full validation and fallback logic.

**Request:**
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"skipValidation": false, "stagingMode": false}' \
  https://your-worker.workers.dev/admin/fetch
```

**Request Body (optional):**
```json
{
  "skipValidation": false,
  "stagingMode": false
}
```

- `skipValidation` (optional, default: false): Skip data validation step
- `stagingMode` (optional, default: false): Enable staging/canary mode (stub)

**Response (Success):**
```json
{
  "success": true,
  "data": {
    "message": "Fetch-extract-validate workflow completed successfully",
    "status": "completed",
    "metadata": {
      "timestamp": "2026-01-26T12:00:00.000Z",
      "duration": 2500,
      "fetchTriggered": true,
      "validationPassed": true,
      "fallbackUsed": false,
      "warnings": []
    },
    "data": {
      "version": "2026-01-26T12-00-00-000Z",
      "recordCount": 1000000,
      "hash": "a1b2c3d4e5f6g7h8..."
    }
  },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Response (Validation Failed - Fallback Used):**
```json
{
  "success": true,
  "data": {
    "message": "Fetch-extract-validate workflow completed successfully",
    "status": "fallback_used",
    "metadata": {
      "timestamp": "2026-01-26T12:00:00.000Z",
      "duration": 3000,
      "fetchTriggered": true,
      "validationPassed": false,
      "fallbackUsed": true,
      "warnings": [
        "Validation failed, attempting fallback",
        "Using fallback data from 2026-01-25T10-00-00-000Z"
      ]
    },
    "data": {
      "version": "2026-01-25T10-00-00-000Z",
      "recordCount": 999000,
      "hash": "x9y8z7w6v5u4t3s2..."
    }
  },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Response (Failure):**
```json
{
  "error": "Fetch Failed",
  "message": "Failed to complete fetch-extract-validate workflow",
  "details": {
    "status": "failed",
    "errors": [
      "Failed to fetch ZIP after 3 attempts: Network timeout",
      "Validation failed and no fallback data available"
    ],
    "warnings": [],
    "duration": 45000
  },
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Workflow completed successfully (may include fallback)
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Workflow failed

**Processing Steps:**

The fetch endpoint executes the following steps:

1. **Staleness Check**: Determines if data needs updating (can be overridden with on-demand flag)
2. **Configuration Retrieval**: Loads data source configuration from KV
3. **ZIP Fetch**: Downloads ZIP file from origin URL with retries
4. **File Validation**: Verifies target file exists in ZIP
5. **Extraction**: Extracts target file content from ZIP
6. **Data Validation**: 
   - Validates hash integrity (if expected hash provided)
   - Validates schema/header match
   - Counts records
7. **Fallback Logic**: On validation failure, attempts to use last known good data
8. **Success Path**: Stores validated data as new "last good data"
9. **Event Logging**: All steps logged to R2 in JSONL format with daily rotation

**Event Logs:**

All processing events are logged to R2 at `events/logs-YYYY-MM-DD.jsonl` with the following event types:
- `fetch`: ZIP download events
- `extract`: File extraction events
- `validate`: Data validation events
- `fallback`: Fallback activation events
- `error`: Error events with stack traces

Each log entry includes:
- Unique event ID
- Timestamp
- Event type and status
- Duration and data size metrics
- Error details and metadata

**R2 Storage Structure:**
```
/events/
  logs-2026-01-26.jsonl         # Daily event logs (JSONL)
/metadata/
  processing-{version}.json     # Processing metadata per version
/diffs/
  diff-{version}-{timestamp}.json  # Data differentials
/fallback/
  last-good-data-{version}.txt  # Last known good data
```

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

#### GET /api/v1/config/health

Get the health status of the configuration system.

**Request:**
```bash
curl https://your-worker.workers.dev/api/v1/config/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "2024-01-26T12:00:00.000Z",
    "hash": "abc123def456...",
    "lastUpdated": "2024-01-26T12:00:00.000Z",
    "kvAvailable": true
  },
  "timestamp": "2024-01-26T12:00:00.000Z"
}
```

**Response Fields:**
- `status`: Configuration health status - `healthy`, `degraded`, or `unavailable`
- `version`: Current configuration version (ISO timestamp)
- `hash`: SHA-256 hash of the current configuration
- `lastUpdated`: When the configuration was last updated
- `kvAvailable`: Whether the CONFIG_KV namespace is available
- `validationErrors` (optional): Array of validation errors if status is degraded

**Status Codes:**
- `200 OK`: Health check successful
- `503 Service Unavailable`: Configuration system unavailable

---

#### GET /api/v1/config/version

Get version information for the current configuration.

**Request:**
```bash
curl https://your-worker.workers.dev/api/v1/config/version
```

**Response:**
```json
{
  "success": true,
  "data": {
    "version": "2024-01-26T12:00:00.000Z",
    "hash": "abc123def456...",
    "timestamp": "2024-01-26T12:00:00.000Z",
    "description": "Updated data source URL"
  },
  "timestamp": "2024-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Version information retrieved
- `404 Not Found`: No configuration found
- `429 Too Many Requests`: Rate limit exceeded

---

#### POST /admin/config/refresh

Force reload the configuration from KV storage.

**Request:**
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  https://your-worker.workers.dev/admin/config/refresh
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Configuration refreshed successfully",
    "version": "2024-01-26T12:00:00.000Z",
    "hash": "abc123def456...",
    "timestamp": "2024-01-26T12:00:00.000Z"
  },
  "timestamp": "2024-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Configuration refreshed
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded

---

#### POST /admin/config/update

Update the system configuration.

**Request:**
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d @config.json \
  https://your-worker.workers.dev/admin/config/update
```

**Request Body:**
```json
{
  "data": {
    "dataSource": {
      "originZipUrl": "https://data.fcc.gov/download/pub/uls/complete/l_amat.zip",
      "zipFileName": "l_amat.zip",
      "extractedFileName": "AM.dat",
      "expectedSchema": {
        "fields": ["record_type", "callsign", "name", "..."],
        "delimiter": "|",
        "hasHeader": false
      }
    },
    "backupEndpoints": {
      "primary": "https://data.fcc.gov/download/pub/uls/complete/l_amat.zip",
      "secondary": "https://backup.example.com/l_amat.zip"
    },
    "features": {
      "jwtAuth": false,
      "canaryDeployment": false,
      "advancedSearch": true,
      "dataExport": true,
      "externalSync": false
    },
    "rateLimits": {
      "user": {
        "requestsPerMinute": 100,
        "burstSize": 10
      },
      "admin": {
        "requestsPerMinute": 20,
        "burstSize": 5
      }
    },
    "cache": {
      "ttl": 3600,
      "maxEntries": 10000
    }
  },
  "updatedBy": "admin@example.com",
  "description": "Updated data source configuration"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Configuration updated successfully",
    "version": "2024-01-26T12:30:00.000Z",
    "hash": "def789ghi012...",
    "timestamp": "2024-01-26T12:30:00.000Z"
  },
  "timestamp": "2024-01-26T12:30:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Configuration updated
- `400 Bad Request`: Invalid configuration data
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded

---

#### GET /admin/config/versions

List all available configuration versions in history.

**Request:**
```bash
curl -H "X-API-Key: your-api-key" \
  https://your-worker.workers.dev/admin/config/versions
```

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 5,
    "versions": [
      {
        "version": "2024-01-26T12:30:00.000Z",
        "hash": "def789ghi012...",
        "timestamp": "2024-01-26T12:30:00.000Z",
        "updatedBy": "admin@example.com",
        "description": "Updated data source configuration"
      },
      {
        "version": "2024-01-25T10:00:00.000Z",
        "hash": "abc123def456...",
        "timestamp": "2024-01-25T10:00:00.000Z",
        "updatedBy": "admin@example.com",
        "description": "Initial configuration"
      }
    ]
  },
  "timestamp": "2024-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Version list retrieved
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded

---

#### POST /admin/config/rollback

Rollback the configuration to a previous version.

**Request:**
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"version": "2024-01-25T10:00:00.000Z"}' \
  https://your-worker.workers.dev/admin/config/rollback
```

**Request Body:**
```json
{
  "version": "2024-01-25T10:00:00.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Configuration rolled back successfully",
    "version": "2024-01-25T10:00:00.000Z",
    "hash": "abc123def456...",
    "timestamp": "2024-01-25T10:00:00.000Z"
  },
  "timestamp": "2024-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Rollback successful
- `400 Bad Request`: Invalid version or version not found
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded

---

#### GET /admin/config/current

Get the complete current configuration.

**Request:**
```bash
curl -H "X-API-Key: your-api-key" \
  https://your-worker.workers.dev/admin/config/current
```

**Response:**
```json
{
  "success": true,
  "data": {
    "data": {
      "dataSource": { ... },
      "backupEndpoints": { ... },
      "features": { ... },
      "rateLimits": { ... },
      "cache": { ... }
    },
    "version": {
      "version": "2024-01-26T12:00:00.000Z",
      "hash": "abc123def456...",
      "timestamp": "2024-01-26T12:00:00.000Z",
      "updatedBy": "admin@example.com",
      "description": "Current active configuration"
    }
  },
  "timestamp": "2024-01-26T12:00:00.000Z"
}
```

**Status Codes:**
- `200 OK`: Configuration retrieved
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded

---

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

### Overview

The Ham Radio Callsign Worker uses a multi-layered configuration approach combining static Wrangler configuration with dynamic KV-based runtime configuration. The configuration system has been implemented with full support for versioning, rollback, and health monitoring.

### Environment Variables

Configuration is managed through `wrangler.toml` and environment-specific variables:

- `ENVIRONMENT`: Deployment environment (development, staging, production)
- `LOG_LEVEL`: Logging verbosity (debug, info, warn, error)

### Cloudflare Bindings

The following Cloudflare resources are configured as placeholders in `wrangler.toml`:

- **KV Namespaces**:
  - `CALLSIGN_CACHE`: For caching callsign lookup results
  - `METADATA_STORE`: For system metadata and dynamic configuration (Phase 3)
  
- **D1 Database**:
  - `CALLSIGN_DB`: Main database for callsign data

- **R2 Bucket**:
  - `DATA_EXPORTS`: For storing data exports, backups, and audit logs

To activate these bindings, uncomment the relevant sections in `wrangler.toml` and configure the resource IDs through the Cloudflare dashboard.

### Dynamic Configuration

The system now includes a comprehensive KV-based configuration system with the following capabilities:

#### Configuration Structure

The dynamic configuration is stored as a single namespaced JSON object in KV (`CONFIG_KV` namespace), containing:

- **Data Source Configuration**
  - Origin ZIP URL for data fetching
  - ZIP file name and structure
  - Extracted file name and expected format
  - Update frequency and staleness thresholds

- **Validation Rules**
  - Expected data schema and headers
  - Hash validation requirements
  - Content validation rules

- **Infrastructure Endpoints**
  - Backup data source URLs
  - Fallback endpoints for redundancy

- **External Sync Configuration**
  - SQL database connections (host, credentials, table name)
  - Redis cache endpoints (host, port, password, database)
  - Enable/disable flags for each sync target

- **Feature Flags**
  - `jwtAuth`: Enable/disable JWT authentication
  - `canaryDeployment`: Enable/disable canary deployment mode
  - `advancedSearch`: Enable/disable advanced search features
  - `dataExport`: Enable/disable data export functionality
  - `externalSync`: Enable/disable external database synchronization

#### Configuration Management Features

The configuration system includes:

- **Version Control**: All configuration changes are versioned with SHA-256 hashes and ISO timestamps
- **Rollback Capability**: Admin endpoint (`POST /admin/config/rollback`) to revert to any previous configuration version
- **Hot Reload**: Refresh configuration (`POST /admin/config/refresh`) without worker redeployment
- **Health Monitoring**: Health endpoint (`GET /api/v1/config/health`) validates configuration and checks KV availability
- **Audit Trail**: Track all configuration changes with `updatedBy` and `description` fields
- **History Management**: Maintains up to 10 previous configuration versions in KV
- **Validation**: Comprehensive validation ensures configuration integrity before saving

#### Using the Configuration System

**Setting Up CONFIG_KV**

1. Create a KV namespace in Cloudflare dashboard or via Wrangler:
   ```bash
   wrangler kv:namespace create "CONFIG_KV"
   wrangler kv:namespace create "CONFIG_KV" --preview
   ```

2. Update `wrangler.toml` with your namespace IDs:
   ```toml
   [[kv_namespaces]]
   binding = "CONFIG_KV"
   id = "your_config_kv_namespace_id"
   preview_id = "your_preview_config_kv_namespace_id"
   ```

**Default Configuration**

If CONFIG_KV is not available or no configuration exists, the system uses a default configuration with:
- FCC amateur radio data source (l_amat.zip)
- All feature flags disabled except `advancedSearch` and `dataExport`
- Standard rate limits (100 req/min for users, 20 req/min for admins)
- 1-hour cache TTL

**Updating Configuration**

Use the `POST /admin/config/update` endpoint to update configuration:

```bash
curl -X POST   -H "X-API-Key: your-api-key"   -H "Content-Type: application/json"   -d '{
    "data": {
      "dataSource": { ... },
      "features": { ... },
      ...
    },
    "updatedBy": "admin@example.com",
    "description": "Enable JWT authentication"
  }'   https://your-worker.workers.dev/admin/config/update
```

**Monitoring Configuration Health**

Check configuration health via the public endpoint:

```bash
curl https://your-worker.workers.dev/api/v1/config/health
```

This returns:
- Configuration status (healthy/degraded/unavailable)
- Current version and hash
- KV availability
- Any validation errors

See the [API Endpoints](#api-endpoints) section for complete documentation of all configuration endpoints.

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

### Current Testing Infrastructure

The project uses Vitest as the testing framework with tests located in the `test/` directory.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

### Test Structure

Tests are organized by module with the `.test.ts` extension. Each module should have corresponding test files that verify:
- Core functionality
- Edge cases
- Error handling
- Input validation

### Writing Tests

Follow these guidelines when writing tests:

1. Use descriptive test names that explain what is being tested
2. Test both success and error cases
3. Mock external dependencies (KV, D1, R2, external APIs)
4. Aim for high code coverage on business logic
5. Use test fixtures for consistent test data

**Example Test Structure**:
```typescript
import { describe, it, expect } from 'vitest';

describe('Callsign Lookup', () => {
  it('should return callsign data for valid callsign', async () => {
    // Test implementation
  });

  it('should return 404 for non-existent callsign', async () => {
    // Test implementation
  });

  it('should validate callsign format', () => {
    // Test implementation
  });
});
```

### Comprehensive Testing Strategy (Phase 8)

Phase 8 ([Issue #7](https://github.com/cjemorton/ham-radio-callsign-worker/issues/7)) will establish comprehensive testing infrastructure:

#### Unit Testing

**Component-Level Tests**:
- **Configuration Module**: KV config loading, validation, versioning
- **Fetch Engine**: ZIP download, extraction, retry logic
- **Validation Engine**: Hash validation, schema checking, content validation
- **Diff Engine**: Record comparison, change detection
- **Patch Engine**: Database updates, transaction handling
- **Sync Engine**: Slave propagation, health tracking
- **API Handlers**: Request parsing, response formatting, error handling

**Test Coverage Goals**:
- Business logic: 90%+ coverage
- API endpoints: 100% coverage
- Error paths: Complete coverage

#### Integration Testing

**Multi-Component Tests**:
- End-to-end API request flows
- Database read/write operations
- KV configuration loading and usage
- R2 log storage and retrieval
- Authentication and authorization
- Rate limiting behavior

**Test Scenarios**:
- Successful callsign lookup
- Search with various query types
- Data export generation
- Admin update workflow
- Rollback procedures
- Failure recovery

#### End-to-End Testing

**Complete Workflow Tests**:
- Full update cycle: fetch → validate → diff → patch → sync → log
- User query cycle: request → cache check → DB lookup → response
- Admin workflow: authentication → operation → logging
- Failure scenarios: validation failure → fallback → recovery

**Test Harness**:
- Cloudflare Workers testing frameworks (Miniflare, Wrangler dev)
- Mock external data sources
- Simulated update scenarios
- Performance benchmarks

#### Edge Case Testing

**Manual Test Flows** (to be documented):
- Empty database scenarios
- Corrupted data handling
- Network failures and retries
- Concurrent update operations
- Large dataset handling
- Rate limit boundary conditions
- Invalid configuration handling

#### Load and Performance Testing

- **Concurrent Requests**: Test under high load
- **Response Times**: Benchmark query performance
- **Memory Usage**: Monitor resource consumption
- **Database Performance**: Test query optimization
- **Cache Efficiency**: Measure cache hit rates

#### Security Testing

- **Authentication**: Verify API key validation
- **Authorization**: Test role-based access
- **Input Validation**: SQL injection, XSS attempts
- **Rate Limiting**: Verify rate limit enforcement
- **Data Integrity**: Ensure validation prevents corruption

#### Testing Tools and Frameworks

- **Vitest**: Primary test runner
- **Miniflare**: Local Cloudflare Workers simulation
- **Wrangler Dev**: Development environment testing
- **Mock Libraries**: For external dependencies
- **Coverage Tools**: Code coverage reporting

#### Sample Scripts and Examples

Phase 8 will provide:
- Sample test suites for each component
- Mock data generators
- Test fixtures for common scenarios
- Integration test examples
- Performance test scripts
- Security test cases

See [Issue #7](https://github.com/cjemorton/ham-radio-callsign-worker/issues/7) for complete testing specifications.

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

The worker uses structured logging with configurable log levels. The logging infrastructure will be significantly enhanced in Phase 7 ([Issue #8](https://github.com/cjemorton/ham-radio-callsign-worker/issues/8)).

### Current Logging

**Log Levels**:
- `debug`: Detailed debugging information
- `info`: General informational messages
- `warn`: Warning messages
- `error`: Error messages

Log level is configured via the `LOG_LEVEL` environment variable in `wrangler.toml`.

### Planned Logging Infrastructure (Phase 7)

The comprehensive logging system will include:

#### Structured JSONL Logs

- **Format**: JSON Lines (JSONL) for easy parsing and analysis
- **Storage**: R2 bucket with automatic rotation
- **Levels**: Event-level and error-level categorization
- **Content**:
  - Request/response metadata
  - Data update events
  - Configuration changes
  - Admin actions
  - Error stack traces
  - Performance metrics

#### Log Categories

1. **Event Logs**: Normal operations (queries, updates, sync events)
2. **Error Logs**: Failures, exceptions, and validation errors
3. **Audit Logs**: Admin actions, configuration changes, rollbacks
4. **Diff Reports**: Detailed reports of data changes during updates
5. **Version History**: Complete version trail with timestamps

#### Log Management

- **Rotation**: Automatic rotation to manage storage costs
- **Retention**: Configurable retention periods
- **Retrieval**: Admin endpoints for log inspection
- **Search**: Query logs by timestamp, level, or event type

#### Monitoring Endpoints

- `GET /admin/logs?limit=100&level=error` - Retrieve filtered logs
- `GET /admin/metadata` - View database and system metadata
- `GET /admin/stats` - System statistics and metrics

See [Issue #8](https://github.com/cjemorton/ham-radio-callsign-worker/issues/8) for complete specifications.

## Data Update Workflow

The worker implements a sophisticated data update workflow with fetch, extraction, validation, and differential patching engines fully implemented.

### Update Trigger Mechanisms

1. **Scheduled Updates**: Periodic checks based on staleness detection (configurable max age)
2. **On-Demand Updates**: Admin-triggered via `/admin/fetch` or `/admin/update` endpoints
3. **Webhook Updates**: External trigger support (future enhancement)

### Update Process Flow

```
1. Trigger Detection (Schedule or Admin Request)
         ↓
2. Staleness Check
   - Query last update timestamp from METADATA_STORE
   - Compare against configured max age (default: 24 hours)
   - Skip if data is fresh (unless on-demand override)
         ↓
3. Configuration Retrieval
   - Load data source configuration from CONFIG_KV
   - Extract origin URL, target file, expected schema
         ↓
4. Fetch ZIP from Origin (✅ IMPLEMENTED)
   - Retrieve from KV-configured URL
   - Retry logic with exponential backoff (max 3 attempts)
   - 30-second timeout per attempt
   - Log fetch events to R2
         ↓
5. Extract and Validate (✅ IMPLEMENTED)
   - Validate file presence in ZIP
   - Extract target file from ZIP (supports uncompressed files)
   - Calculate SHA-256 hash of content
   - Validate hash against expected value (if provided)
   - Verify schema/header match against expected fields
   - Check delimiter and structure
   - Count records
   - Log extraction and validation events to R2
         ↓
6. Validation Decision Point
   ├─ [PASS] → Continue to Diff Calculation
   │
   └─ [FAIL] → Fallback Logic (✅ IMPLEMENTED)
               - Attempt to retrieve last good data from R2
               - If available: Use fallback data and warn
               - If unavailable: Return error
               - Log fallback event to R2
         ↓
7. Diff Calculation (✅ IMPLEMENTED)
   - Compare new data with last known good data
   - Identify added, modified, and deleted records
   - Calculate record-level changes by primary key (callsign)
   - Detect hash changes for quick comparison
   - Store diff report in R2 with metadata
         ↓
8. Database Patching (✅ IMPLEMENTED)
   - Create patch operations (INSERT, UPDATE, DELETE)
   - Initialize D1 database tables if needed
   - Apply patches in batches (100 records per batch)
   - Use D1 transactions for atomic updates
   - Create database snapshot for rollback
   - Skip patching if no changes detected
         ↓
9. Store as Last Good Data (✅ IMPLEMENTED)
   - Save content to R2 with version metadata
   - Update fallback metadata in KV
   - Store database snapshot reference
   - Update last fetch timestamp
         ↓
10. Slave Synchronization (Phase 6 - Issue #10 - PLANNED)
   - Propagate changes to external SQL/Redis
   - Parallel sync to all configured slaves
         ↓
11. Event Logging and Metadata (✅ IMPLEMENTED)
   - Store event logs in R2 (JSONL format with daily rotation)
   - Store processing metadata per version
   - Store diff reports with change summaries
   - Store validation results
   - Track fallback status
         ↓
12. Success Response or Error
    - Return detailed status with metadata
    - Include diff summary (added/modified/deleted counts)
    - Include warnings if fallback was used
```

### Implemented Features

#### ✅ Fetch Engine (`src/engine/fetch.ts`)
- Fetches ZIP files from KV-configured origin URLs
- Implements retry logic with exponential backoff
- Timeout protection (30s per attempt, 3 max retries)
- Staleness detection based on configurable max age
- Updates last fetch timestamp in METADATA_STORE

#### ✅ Extraction Engine (`src/engine/extract.ts`)
- Simple ZIP parser for extracting files
- Validates file presence before extraction
- Supports uncompressed (stored) files
- Lists all files in ZIP for debugging
- UTF-8 text decoding

#### ✅ Validation Engine (`src/engine/validate.ts`)
- SHA-256 hash calculation and validation
- Schema validation with configurable delimiters
- Header/field matching
- Record counting
- Comprehensive error and warning reporting

#### ✅ Fallback Engine (`src/engine/fallback.ts`)
- Stores last known good data in R2
- Maintains fallback metadata in KV
- Automatic fallback on validation failure
- Retrieves and uses fallback data when needed
- Admin operations to check/clear fallback status

#### ✅ Diff Engine (`src/engine/diff.ts`)
- Compares new data with previous version by hash
- Record-level diffing by primary key (callsign)
- Identifies added, modified, and deleted records
- Optimized hash-based quick comparison
- Stores diff reports in R2 with metadata
- Supports configurable delimiters and schemas
- Handles first import (null old content)

#### ✅ Database Patching Engine (`src/engine/database.ts`)
- Initializes D1 database tables on demand
- Creates patch operations (INSERT, UPDATE, DELETE)
- Batch processing for efficient D1 operations (100 records per batch)
- Transactional updates using D1 batch API
- Database snapshot creation for rollback
- Record count tracking
- Rollback to previous snapshot capability
- Version-based snapshot management

#### ✅ R2 Logging Engine (`src/engine/logger.ts`)
- JSONL event log format
- Daily log rotation (logs-YYYY-MM-DD.jsonl)
- Event types: fetch, extract, validate, fallback, error
- Metadata and diff storage
- Unique event IDs with timestamps

### R2 Storage Structure

```
/events/
  logs-2026-01-26.jsonl         # Daily event logs (JSONL format)
  logs-2026-01-27.jsonl
/metadata/
  processing-{version}.json     # Processing metadata per version
/diffs/
  diff-{version}.json           # ✅ Data differentials with change summaries
/fallback/
  last-good-data-{version}.txt  # Last known good data for rollback
```

### Diffing and Patching

- **✅ Hash-Based Comparison**: Quick detection of changes via SHA-256 hash
- **✅ Record-Level Diffing**: Identifies added, modified, and deleted records by primary key
- **✅ Differential Updates**: Only changed records sent to D1 database
- **✅ Batch Processing**: Efficient batch operations (100 records per batch)
- **✅ Transaction Support**: Atomic updates using D1 batch API
- **✅ Diff Reports**: Detailed change reports stored in R2 with metadata

### Validation and Fallback

- **✅ Hash Validation**: Every data file validated against SHA-256 hash
- **✅ Schema Validation**: Headers and structure verified before processing
- **✅ Content Validation**: Delimiter, field count, and structure checks
- **✅ Automatic Fallback**: On validation failure, uses last known good data
- **✅ Manual Rollback**: Admin endpoint to revert to specific database snapshot
- **✅ Version Tracking**: Database snapshots stored with version metadata

### Rollback and Recovery

The system implements comprehensive rollback capabilities:

1. **Automatic Rollback on Validation Failure**
   - If new data fails validation, automatically uses last known good data
   - No manual intervention required
   - Logged with warnings for admin visibility

2. **Manual Rollback via Admin Endpoint**
   ```bash
   # Rollback to latest snapshot
   curl -X POST https://worker.example.com/admin/rollback \
     -H "Authorization: Bearer YOUR_API_KEY"

   # Rollback to specific version
   curl -X POST https://worker.example.com/admin/rollback \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"version": "2026-01-26T12-00-00-000Z"}'
   ```

3. **Database Snapshots**
   - Created after each successful update
   - Stored with version, timestamp, hash, and record count
   - Referenced in METADATA_STORE for quick access
   - Data backed up in R2 for restoration

### Admin Endpoints for Diff and Rollback

- **`POST /admin/rollback`** - Rollback database to previous version
  - Optional `version` parameter to rollback to specific snapshot
  - Returns rollback status and records restored
  
- **`GET /admin/diffs`** - View diff history
  - Query parameter: `limit` (default: 10, max: 100)
  - Returns list of diffs with change summaries
  
- **`GET /admin/metadata`** - View database metadata
  - Returns current version, record count, and snapshot info

### Error Handling

- **✅ Comprehensive Logging**: All operations logged with timestamps and context
- **✅ Graceful Degradation**: Fallback to last good data on validation failure
- **✅ Event Tracking**: All events stored in R2 with unique IDs
- **✅ Error Details**: Stack traces and metadata captured for debugging
- **✅ Admin Visibility**: Errors accessible via admin endpoints
- **✅ Diff Logging**: Change summaries logged with each update

### Logging Approach for Diff Operations

The system implements comprehensive logging for all diff and patching operations:

#### Diff Event Logging
- **Location**: R2 bucket under `/diffs/diff-{version}.json`
- **Format**: JSON with detailed change information
- **Content**:
  ```json
  {
    "hasChanges": true,
    "added": ["AA1AA", "BB2BB"],
    "modified": ["CC3CC"],
    "deleted": ["DD4DD"],
    "unchanged": 1000,
    "summary": {
      "addedCount": 2,
      "modifiedCount": 1,
      "deletedCount": 1,
      "unchangedCount": 1000,
      "totalOldRecords": 1002,
      "totalNewRecords": 1003
    },
    "metadata": {
      "oldVersion": "2026-01-26T12-00-00-000Z",
      "newVersion": "2026-01-27T12-00-00-000Z",
      "oldHash": "abc123...",
      "newHash": "def456...",
      "timestamp": "2026-01-27T12:00:00.000Z"
    }
  }
  ```

#### Processing Event Logging
- **Location**: R2 bucket under `/events/logs-YYYY-MM-DD.jsonl`
- **Format**: JSONL (JSON Lines) for efficient log streaming
- **Event Types**:
  - `fetch`: Data fetch operations
  - `extract`: ZIP extraction operations
  - `validate`: Data validation operations
  - `diff`: Diff calculation operations (NEW)
  - `patch`: Database patching operations (NEW)
  - `fallback`: Fallback operations
  - `error`: Error events

#### Metadata Logging
- **Location**: R2 bucket under `/metadata/processing-{version}.json`
- **Content**: Includes diff summary in metadata
  ```json
  {
    "version": "2026-01-27T12-00-00-000Z",
    "timestamp": "2026-01-27T12:00:00.000Z",
    "duration": 5432,
    "fetchSize": 1048576,
    "recordCount": 1003,
    "hash": "def456...",
    "diff": {
      "added": 2,
      "modified": 1,
      "deleted": 1
    }
  }
  ```

#### Console Logging
- All diff operations logged to console with structured JSON
- Log levels: `info`, `warn`, `error`
- Includes operation context and performance metrics
- Example:
  ```json
  {
    "timestamp": "2026-01-27T12:00:00.000Z",
    "level": "info",
    "message": "Diff calculation completed",
    "details": {
      "hasChanges": true,
      "added": 2,
      "modified": 1,
      "deleted": 1,
      "unchanged": 1000,
      "duration": 125
    }
  }
  ```

### Configuration

The fetch-extract-validate workflow is configured via CONFIG_KV:

```json
{
  "dataSource": {
    "originZipUrl": "https://data.fcc.gov/download/pub/uls/complete/l_amat.zip",
    "zipFileName": "l_amat.zip",
    "extractedFileName": "AM.dat",
    "expectedSchema": {
      "fields": ["record_type", "unique_system_identifier", "..."],
      "delimiter": "|",
      "hasHeader": false
    }
  },
  "features": {
    "canaryDeployment": false,
    ...
  }
}
```

### Usage Examples

**Trigger On-Demand Fetch:**
```bash
curl -X POST \
  -H "X-API-Key: your-api-key" \
  https://your-worker.workers.dev/admin/fetch
```

**Check Fallback Status:**
```bash
# Use the getFallbackStatus function from src/engine/fallback.ts
```

**View Event Logs:**
```bash
# Logs are stored in R2 at events/logs-YYYY-MM-DD.jsonl
# Retrieve via R2 API or admin endpoint (future)
```

## Rate Limiting

Rate limiting is implemented to protect the API from abuse and ensure fair usage across all clients.

### Rate Limits

The following rate limits are enforced:

- **User Endpoints**: 100 requests per minute per IP address
  - `/api/v1/callsign/:callsign`
  - `/api/v1/search`
  - `/api/v1/export`
  - `/health`
  - `/version`

- **Admin Endpoints**: 20 requests per minute per API key
  - `/admin/update`
  - `/admin/rebuild`
  - `/admin/rollback`
  - `/admin/logs`
  - `/admin/metadata`
  - `/admin/stats`

- **Export Endpoints**: 10 requests per hour per API key (planned)
  - Enhanced limits for resource-intensive export operations

### Rate Limit Headers

Every API response includes rate limit information in the headers:

- `X-RateLimit-Limit`: Maximum number of requests allowed in the current window
- `X-RateLimit-Remaining`: Number of requests remaining in the current window
- `X-RateLimit-Reset`: Unix timestamp when the rate limit resets

**Example Headers**:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1706270400
```

### Rate Limit Exceeded Response

When rate limited, clients receive a `429 Too Many Requests` response:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later.",
  "timestamp": "2026-01-26T12:00:00.000Z",
  "details": {
    "limit": 100,
    "reset": 1706270400,
    "retryAfter": 45
  }
}
```

### Implementation Details

- **Per-IP Limiting**: User endpoints limited by client IP address
- **Per-Key Limiting**: Admin endpoints limited by API key
- **Sliding Window**: Uses sliding window algorithm for accurate limiting
- **Distributed Tracking**: Rate limit state managed via KV or Durable Objects
- **Bypass Options**: Admin keys can have elevated limits (configurable)

### Best Practices for Clients

1. **Monitor Headers**: Check rate limit headers in responses
2. **Implement Backoff**: Use exponential backoff when approaching limits
3. **Cache Responses**: Cache callsign lookups to reduce API calls
4. **Batch Operations**: Group related queries when possible
5. **Respect Retry-After**: Honor the `Retry-After` header when rate limited

## External Database Synchronization

The slave synchronization engine enables distributed deployments where the Cloudflare Worker acts as the authoritative data source, propagating updates to one or more external storage systems.

### Overview

After each successful master database (D1) update, the system automatically propagates differential updates to configured slave endpoints. This happens asynchronously and never blocks the main update workflow.

**Key Features**:
- Automatic propagation after successful D1 updates
- Differential updates only (added, modified, deleted records)
- Parallel synchronization to all enabled slaves
- Health tracking per slave endpoint
- Graceful degradation on slave failures
- Canary rollout support for gradual deployments

### Use Cases

- **Read Replicas**: Distribute read load across multiple SQL databases
- **Geographic Distribution**: Place data closer to regional users
- **Legacy System Integration**: Sync with existing database infrastructure
- **Analytics**: Separate analytical database for reporting
- **Distributed Caching**: Redis caches in multiple regions

### Architecture

```
Cloudflare Worker (Master)
         │
         ├─── Update Detection
         │         │
         │         ▼
         │    Diff Calculation
         │         │
         │         ▼
         ├─── D1 Database Update (Primary)
         │         │
         │         ▼
         └─── Slave Synchronization Engine
                   │
                   ├──→ Slave SQL #1 (Region A)
                   ├──→ Slave SQL #2 (Region B)
                   ├──→ Redis Cache #1
                   └──→ Redis Cache #2
```

### Configuration

Slave endpoints are configured in the KV configuration store. Use the admin API to update configuration:

#### Configuration Structure

```json
{
  "features": {
    "externalSync": true,
    "canaryDeployment": false
  },
  "externalSync": {
    "sql": {
      "enabled": true,
      "endpoints": [
        {
          "id": "region-a-sql",
          "type": "postgresql",
          "endpoint": "postgres://host:5432/callsigns",
          "tableName": "callsigns",
          "enabled": true,
          "priority": 1
        },
        {
          "id": "region-b-sql",
          "type": "mysql",
          "endpoint": "mysql://host:3306/callsigns",
          "tableName": "callsigns",
          "enabled": true,
          "priority": 2
        }
      ]
    },
    "redis": {
      "enabled": true,
      "endpoints": [
        {
          "id": "cache-a",
          "endpoint": "redis://host:6379",
          "ttl": 86400,
          "keyPrefix": "callsign:",
          "enabled": true
        }
      ]
    }
  }
}
```

#### Configuration Fields

**SQL Endpoint Fields**:
- `id` (required): Unique identifier for the slave
- `type` (required): Database type - `postgresql`, `mysql`, `mariadb`, `sqlite`, or `mssql`
- `endpoint` (required): Connection string or URL
- `tableName` (optional): Target table name (defaults to `callsigns`)
- `enabled` (required): Enable/disable this endpoint
- `priority` (optional): Priority level (1 = primary, 2+ = secondary)

**Redis Endpoint Fields**:
- `id` (required): Unique identifier for the cache
- `endpoint` (required): Redis connection URL
- `ttl` (optional): Time-to-live in seconds (default: 3600)
- `keyPrefix` (optional): Prefix for all keys (default: `callsign:`)
- `enabled` (required): Enable/disable this endpoint

### Setup Process

#### Step 1: Enable External Sync Feature

Update your configuration via the admin API:

```bash
# Get current configuration
curl -H "X-API-Key: your-key" \
  https://your-worker.workers.dev/admin/config

# Update configuration to enable external sync
curl -X POST -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "features": {
      "externalSync": true
    }
  }' \
  https://your-worker.workers.dev/admin/config
```

#### Step 2: Configure Slave Endpoints

Add your SQL and Redis endpoints to the configuration:

```bash
curl -X POST -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "externalSync": {
      "sql": {
        "enabled": true,
        "endpoints": [
          {
            "id": "primary-postgres",
            "type": "postgresql",
            "endpoint": "postgres://user:pass@host:5432/db",
            "enabled": true,
            "priority": 1
          }
        ]
      },
      "redis": {
        "enabled": true,
        "endpoints": [
          {
            "id": "primary-cache",
            "endpoint": "redis://user:pass@host:6379",
            "ttl": 3600,
            "enabled": true
          }
        ]
      }
    }
  }' \
  https://your-worker.workers.dev/admin/config
```

#### Step 3: Trigger a Database Update

Force an update to test the synchronization:

```bash
curl -X POST -H "X-API-Key: your-key" \
  https://your-worker.workers.dev/admin/update
```

The response will include `slaveSyncResult` showing synchronization status:

```json
{
  "success": true,
  "data": {
    "slaveSyncResult": {
      "totalSlaves": 2,
      "successCount": 2,
      "failureCount": 0,
      "results": [
        {
          "success": true,
          "slaveId": "primary-postgres",
          "type": "sql",
          "appliedOperations": 150,
          "duration": 234,
          "timestamp": "2024-01-15T10:30:00Z"
        },
        {
          "success": true,
          "slaveId": "primary-cache",
          "type": "redis",
          "appliedOperations": 150,
          "duration": 87,
          "timestamp": "2024-01-15T10:30:00Z"
        }
      ]
    }
  }
}
```

### Synchronization Process

The synchronization happens automatically after each successful master database update:

1. **Update Trigger**: D1 database update completes successfully
2. **Load Configuration**: Retrieve active slave endpoints from KV
3. **Create Operations**: Build patch operations (INSERT, UPDATE, DELETE)
4. **Parallel Propagation**: Send delta updates to all enabled slaves
5. **Apply Changes**: Execute operations on each slave endpoint
6. **Health Tracking**: Record sync status, duration, and metrics
7. **Error Handling**: Log failures without blocking main workflow

### Propagation Strategy

**Differential Updates Only**:
- Transmit only added, modified, or deleted records
- Minimize network traffic and database operations
- Full records included in each operation for slave independence

**Parallel Execution**:
- Sync to all slaves simultaneously (non-blocking)
- Independent failure handling for each slave
- Continue on partial failures
- No inter-slave dependencies

**Operation Types**:
- `INSERT`: Add new callsign records
- `UPDATE`: Modify existing callsign data
- `DELETE`: Remove deleted callsigns

### Health Monitoring

The system tracks health metrics for each slave endpoint:

**Tracked Metrics**:
- Last successful sync timestamp
- Last sync duration (milliseconds)
- Last sync record count
- Consecutive failure count
- Status: `healthy`, `degraded`, or `failed`
- Last error message (if any)

**Health Status Rules**:
- `healthy`: No recent failures
- `degraded`: 1-2 consecutive failures
- `failed`: 3+ consecutive failures

Health data is stored in the METADATA_STORE KV namespace with a 7-day expiration.

### Error Handling

**Graceful Degradation**:
- Main worker operation **never blocked** by slave failures
- Each slave sync is independent
- Errors logged with full context
- System continues with partial success

**Failure Scenarios Handled**:
- Network connectivity issues
- Authentication failures  
- Slave database unavailable
- Connection timeouts
- Operation failures

**Logging**:
All sync operations and failures are logged with:
- Slave ID and type
- Operation counts
- Duration metrics
- Error messages
- Full stack traces (on errors)

### Canary Deployments

The canary deployment feature allows gradual rollout of new slave endpoints:

#### How It Works

When `features.canaryDeployment` is `false`:
- Only priority 1 slaves receive updates
- Priority 2+ slaves are skipped
- Used to test new slaves safely

When `features.canaryDeployment` is `true`:
- All enabled slaves receive updates
- Full rollout to all endpoints

#### Example Workflow

**Phase 1: Add New Slave (Canary Off)**
```json
{
  "features": { "canaryDeployment": false },
  "externalSync": {
    "sql": {
      "endpoints": [
        { "id": "existing", "priority": 1, "enabled": true },
        { "id": "new-slave", "priority": 2, "enabled": true }
      ]
    }
  }
}
```
Result: Only `existing` receives updates, `new-slave` is ready but idle.

**Phase 2: Test New Slave**
Monitor `new-slave` infrastructure, verify it's ready, then enable canary:

```json
{
  "features": { "canaryDeployment": true }
}
```
Result: Both slaves now receive updates.

**Phase 3: Promote to Primary**
Once stable, adjust priorities:
```json
{
  "endpoints": [
    { "id": "existing", "priority": 2 },
    { "id": "new-slave", "priority": 1 }
  ]
}
```

### Implementation Details

The slave sync engine is implemented in `src/engine/slave-sync.ts` with the following key functions:

- `syncToSlaves()`: Main orchestrator for all slave syncs
- `syncToSqlSlave()`: Handles SQL database synchronization
- `syncToRedisSlave()`: Handles Redis cache synchronization  
- `updateSyncHealth()`: Updates health tracking metrics
- `getSyncHealth()`: Retrieves health status for all slaves
- `clearSyncHealth()`: Clears health data for a slave

### Current Limitations

**Note**: The current implementation provides the framework and structure for slave synchronization, but does not include actual database/Redis connectivity:

- SQL sync simulates operations (connection logic to be implemented)
- Redis sync simulates operations (connection logic to be implemented)
- Actual implementation will require appropriate client libraries or HTTP APIs
- Connection pooling and transaction management to be added
- Credential management system to be implemented

To implement actual connectivity, you'll need to:
1. Add appropriate database drivers or HTTP API clients
2. Implement connection management and pooling
3. Add credential storage/retrieval (use Cloudflare Secrets)
4. Implement proper transaction handling
5. Add retry logic with exponential backoff

### Best Practices

1. **Start Small**: Begin with one slave endpoint in canary mode
2. **Monitor Health**: Regularly check slave sync status via logs
3. **Test Configuration**: Validate endpoints before enabling
4. **Use Priorities**: Leverage priority levels for controlled rollout
5. **Network Security**: Always use encrypted connections (TLS/SSL)
6. **Credential Security**: Store credentials securely (never in config JSON)
7. **Capacity Planning**: Ensure slaves can handle update volume
8. **Independent Backups**: Maintain backups independent of sync

### Troubleshooting

**Problem**: Slave not receiving updates
- Check `externalSync.{sql|redis}.enabled` is `true`
- Check `features.externalSync` is `true`
- Check endpoint `enabled` field is `true`
- Check slave priority and canary mode settings

**Problem**: All syncs failing
- Verify endpoint URLs are correct
- Check network connectivity from Worker
- Verify credentials (when implemented)
- Check logs for specific error messages

**Problem**: Partial sync failures
- Check health metrics for failing slaves
- Review error messages in logs
- Verify slave capacity and performance
- Check for schema mismatches

See [Issue #10](https://github.com/cjemorton/ham-radio-callsign-worker/issues/10) for complete specifications.

## Security

### Current Security Measures

- CORS headers for API access control
- Input validation on all endpoints
- Secure headers in responses
- API key authentication for admin endpoints (implemented)
- Rate limiting to prevent abuse

### Authentication & Authorization

#### API Key Authentication (Current)

Admin endpoints require authentication via API key:

```bash
# Using X-API-Key header
curl -H "X-API-Key: your-api-key" https://your-worker.workers.dev/admin/stats

# Using Authorization Bearer token
curl -H "Authorization: Bearer your-api-key" https://your-worker.workers.dev/admin/stats
```

**Setting Up Admin API Key**:
```bash
wrangler secret put ADMIN_API_KEY
# Enter your secret API key when prompted
```

#### JWT Authentication (Planned - Phase 3+)

JWT support is planned as a feature flag in the configuration system:
- Token-based authentication for API consumers
- Refresh token mechanism
- Role-based access control (RBAC)
- Token expiration and renewal

### Data Security

- **Hash Validation**: All data updates validated against cryptographic hashes
- **Schema Validation**: Data structure verified before processing
- **Integrity Checks**: Multi-stage validation before database updates
- **Backup Strategy**: Automatic backups before any data modification
- **Audit Trail**: Complete history of all data changes

### Input Validation & Sanitization

- Request parameter validation
- SQL injection prevention (parameterized queries)
- XSS protection in responses
- Content-Type validation
- Size limits on all inputs

### Network Security

- **TLS/HTTPS**: All traffic encrypted via Cloudflare's edge
- **DDoS Protection**: Built-in Cloudflare DDoS mitigation
- **Rate Limiting**: Multi-tier rate limiting (user and admin endpoints)
- **CORS Configuration**: Controlled cross-origin access
- **Security Headers**: 
  - Content-Security-Policy
  - X-Content-Type-Options
  - X-Frame-Options
  - Strict-Transport-Security

### Secrets Management

- **Environment Secrets**: Stored via Wrangler secrets (never in code)
- **Configuration Encryption**: Sensitive config values encrypted at rest
- **Key Rotation**: Support for periodic API key rotation
- **Least Privilege**: Minimal permissions for all operations

### Security Best Practices

1. **No Secrets in Code**: All sensitive data in Wrangler secrets or KV
2. **Input Validation**: Validate all inputs before processing
3. **Error Handling**: Avoid exposing internal details in error messages
4. **Logging**: Log security events without exposing sensitive data
5. **Regular Audits**: Periodic security reviews and updates

## Monitoring

### Current Health Checks

The `/health` endpoint provides basic system status with the following information:
- Service status
- API version
- Environment identifier
- Timestamp

**Example Response**:
```json
{
  "status": "ok",
  "service": "ham-radio-callsign-worker",
  "version": "0.1.0",
  "environment": "production",
  "timestamp": "2026-01-26T12:00:00.000Z"
}
```

### Planned Monitoring Enhancements (Phase 7)

The monitoring infrastructure will be significantly enhanced in [Issue #8](https://github.com/cjemorton/ham-radio-callsign-worker/issues/8):

#### Component Health Checks

- **Database Connectivity**: D1 database availability and response time
- **KV Namespace Availability**: Configuration and cache store health
- **R2 Bucket Access**: Export and log storage verification
- **External Slaves** (Phase 6): SQL/Redis endpoint health status

#### Metrics Collection

**Automatic Metrics** (via Cloudflare Dashboard):
- Request count and rate
- Error rate and types
- CPU time and execution duration
- Memory usage
- Bandwidth consumption
- Geographic distribution

**Custom Metrics** (via Admin Endpoints):
- Database record count and growth
- Cache hit/miss ratio
- Update frequency and success rate
- Average query response time
- Slave synchronization lag
- Data freshness indicators

#### Admin Monitoring Endpoints

1. **`GET /admin/stats`** - System Statistics
   - Request volume and patterns
   - Endpoint usage breakdown
   - Rate limiting statistics
   - Uptime and availability

2. **`GET /admin/metadata`** - Database Metadata
   - Current database version
   - Record count and size
   - Last update timestamp
   - Cache statistics

3. **`GET /admin/logs`** - Log Retrieval
   - Filtered log access (by level, time, event type)
   - Recent error summary
   - Update event history

#### Alerting & Notifications

**Planned Features**:
- Threshold-based alerts (error rate, response time, etc.)
- Update failure notifications
- Validation error alerts
- Slave synchronization failure warnings
- Storage quota alerts

#### Observability

- **Structured Logs**: JSONL format in R2 for analysis
- **Event Tracking**: All significant operations logged
- **Audit Trail**: Complete history of admin actions
- **Performance Metrics**: Response times, execution duration
- **Error Tracking**: Detailed error logs with context

#### Monitoring Best Practices

1. **Regular Health Checks**: Automated monitoring of `/health` endpoint
2. **Log Review**: Periodic review of error and audit logs
3. **Metrics Analysis**: Track trends in usage and performance
4. **Capacity Planning**: Monitor growth and plan scaling
5. **Incident Response**: Use logs and metrics for troubleshooting

## Performance Considerations

### Edge Computing Benefits

- **Global Distribution**: Leverage Cloudflare's 300+ data centers worldwide
- **Low Latency**: Serve requests from the nearest edge location
- **Auto-Scaling**: Automatic scaling based on demand
- **Zero Cold Starts**: V8 isolates provide instant response

### Caching Strategy

**Multi-Tier Caching**:
1. **Edge Cache**: Cloudflare CDN caching for static responses
2. **KV Cache**: Frequently accessed callsign data
3. **D1 Database**: Primary data store with optimized queries
4. **External Caches** (Phase 6): Optional Redis for distributed caching

### Database Optimization

- **Indexed Queries**: Proper indexing on D1 database tables
- **Query Efficiency**: Optimized SQL queries for fast lookups
- **Differential Updates**: Only update changed records to minimize write operations
- **Batch Operations**: Bulk inserts/updates for efficiency

### Data Transfer Optimization

- **Compression**: Gzip/Brotli compression for API responses
- **Minimal Payloads**: Return only requested data
- **Pagination**: Large result sets paginated to reduce response size
- **Efficient Formats**: JSON for APIs, CSV for exports

### Search Algorithm Optimization

- **Full-Text Search**: Efficient text search implementation
- **Index Usage**: Leverage database indexes for fast lookups
- **Result Limiting**: Cap result counts to prevent resource exhaustion
- **Query Caching**: Cache common search queries

### Monitoring and Optimization

- **Response Time Tracking**: Monitor and optimize slow endpoints
- **Resource Usage**: Track CPU and memory consumption
- **Query Analysis**: Identify and optimize expensive queries
- **Continuous Improvement**: Regular performance reviews and optimizations

## Progressive Web App (PWA) Integration

Phase 8 ([Issue #7](https://github.com/cjemorton/ham-radio-callsign-worker/issues/7)) includes comprehensive support for PWA integration:

### API Design for PWAs

The Ham Radio Callsign Worker API is designed with PWA requirements in mind:

- **RESTful Design**: Standard HTTP methods and status codes
- **CORS Support**: Cross-origin access for web applications
- **JSON Responses**: Easy consumption by JavaScript applications
- **Consistent Error Handling**: Predictable error responses
- **Versioned API**: `/api/v1/` prefix for version management

### PWA Integration Guide

#### Basic Setup

```javascript
// Example: Fetching callsign data in a PWA
async function lookupCallsign(callsign) {
  try {
    const response = await fetch(
      `https://your-worker.workers.dev/api/v1/callsign/${callsign}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Callsign lookup failed:', error);
    throw error;
  }
}
```

#### Offline Support

PWAs can cache API responses for offline access:

```javascript
// Service Worker: Cache API responses
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/v1/callsign/')) {
    event.respondWith(
      caches.open('callsign-cache').then((cache) => {
        return fetch(event.request)
          .then((response) => {
            cache.put(event.request, response.clone());
            return response;
          })
          .catch(() => cache.match(event.request))
      })
    );
  }
});
```

#### Real-Time Updates

PWAs can poll for updates or use webhooks (future enhancement):

```javascript
// Example: Check for data freshness
async function checkForUpdates() {
  const response = await fetch('https://your-worker.workers.dev/admin/metadata', {
    headers: { 'X-API-Key': 'your-admin-key' }
  });
  
  const metadata = await response.json();
  const lastUpdate = new Date(metadata.data.database.lastUpdated);
  
  // Compare with local storage and refresh if needed
  if (shouldRefresh(lastUpdate)) {
    await refreshLocalData();
  }
}
```

#### Search Implementation

```javascript
// Example: Search functionality for PWA
async function searchCallsigns(query) {
  const response = await fetch(
    `https://your-worker.workers.dev/api/v1/search?q=${encodeURIComponent(query)}`
  );
  
  const data = await response.json();
  return data.data.results;
}
```

### PWA Best Practices

1. **Cache Strategy**: Cache frequently accessed callsigns locally
2. **Offline Mode**: Provide meaningful offline experience
3. **Progressive Enhancement**: Core functionality works without advanced features
4. **Background Sync**: Sync data updates in the background
5. **Performance**: Minimize API calls with smart caching
6. **Error Handling**: Graceful degradation on network failures

### Sample PWA Features

The project will provide examples for:
- **Callsign Lookup Interface**: Search and display callsign information
- **Offline Mode**: Access recently viewed callsigns offline
- **Update Notifications**: Alert users to new data availability
- **Export Functionality**: Download callsign data for offline use
- **Location-Based Search**: Find callsigns by geographic area

See [Issue #7](https://github.com/cjemorton/ham-radio-callsign-worker/issues/7) for complete PWA integration specifications and sample implementations.

## Roadmap

The development roadmap is organized into phases aligned with GitHub issues for tracking progress. Each phase builds upon previous work to create a robust, production-ready system.

### Development Phases

| Phase | Status | Description | Related Issue |
|-------|--------|-------------|---------------|
| **Phase 1** | ✅ Complete | Project initialization and scaffolding | - |
| **Phase 2** | ✅ Complete | API endpoint implementation | [#1](https://github.com/cjemorton/ham-radio-callsign-worker/issues/1) |
| **Phase 3** | 📋 Planned | Configuration and infrastructure setup | [#5](https://github.com/cjemorton/ham-radio-callsign-worker/issues/5) |
| **Phase 4** | 📋 Planned | Data fetch, extraction, and validation engine | [#12](https://github.com/cjemorton/ham-radio-callsign-worker/issues/12) |
| **Phase 5** | 📋 Planned | Data diffing, patching, and recovery | [#11](https://github.com/cjemorton/ham-radio-callsign-worker/issues/11) |
| **Phase 6** | 📋 Planned | Slave synchronization and external cache layer | [#10](https://github.com/cjemorton/ham-radio-callsign-worker/issues/10) |
| **Phase 7** | 📋 Planned | Logging, audit, and monitoring infrastructure | [#8](https://github.com/cjemorton/ham-radio-callsign-worker/issues/8) |
| **Phase 8** | 📋 Planned | Testing, E2E verification, and PWA integration | [#7](https://github.com/cjemorton/ham-radio-callsign-worker/issues/7) |

### Tracking Progress

- **GitHub Issues**: Each phase corresponds to one or more GitHub issues for detailed tracking
- **Project Board**: View the [project board](https://github.com/cjemorton/ham-radio-callsign-worker/projects) for current status and priorities
- **Milestones**: Major phases are organized into milestones for release planning

### Current Focus

**Phase 3** is the next priority, establishing the configuration management system that will enable all subsequent data operations. See [Issue #5](https://github.com/cjemorton/ham-radio-callsign-worker/issues/5) for details.

### Development Workflow

This project follows a modular development approach as outlined in [Issue #4](https://github.com/cjemorton/ham-radio-callsign-worker/issues/4):

1. **Issue Creation**: Each major feature/phase has a corresponding GitHub issue
2. **Modular Development**: Features are developed independently with clear interfaces
3. **Progressive Enhancement**: Each phase builds upon previous work without breaking existing functionality
4. **Documentation-First**: README and code documentation are updated with each phase
5. **Testing Integration**: Tests are added incrementally as features are developed
6. **Review & Refinement**: Regular reviews ensure alignment with architectural vision

### Issue Reference Guide

| Issue # | Title | Phase | Status |
|---------|-------|-------|--------|
| [#1](https://github.com/cjemorton/ham-radio-callsign-worker/issues/1) | API Endpoint Implementation | 2 | ✅ Complete |
| [#4](https://github.com/cjemorton/ham-radio-callsign-worker/issues/4) | Architecture Overview & Development Plan | Documentation | ✅ Complete |
| [#5](https://github.com/cjemorton/ham-radio-callsign-worker/issues/5) | KV Configuration and Management | 3 | 📋 Planned |
| [#7](https://github.com/cjemorton/ham-radio-callsign-worker/issues/7) | Testing & PWA Integration | 8 | 📋 Planned |
| [#8](https://github.com/cjemorton/ham-radio-callsign-worker/issues/8) | Logging, Audit, and Monitoring | 7 | 📋 Planned |
| [#10](https://github.com/cjemorton/ham-radio-callsign-worker/issues/10) | Slave SQL/Redis Sync Engine | 6 | 📋 Planned |
| [#11](https://github.com/cjemorton/ham-radio-callsign-worker/issues/11) | Data Diffing & Recovery | 5 | 📋 Planned |
| [#12](https://github.com/cjemorton/ham-radio-callsign-worker/issues/12) | Fetch, Extraction & Validation | 4 | 📋 Planned |

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

**Status**: 🚧 Active Development | **Version**: 0.1.0 | **Last Updated**: 2026-01-26
