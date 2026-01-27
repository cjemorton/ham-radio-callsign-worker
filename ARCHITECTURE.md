# Ham Radio Callsign Worker - Architecture Overview

## Table of Contents

- [Executive Summary](#executive-summary)
- [Architectural Principles](#architectural-principles)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Core Components](#core-components)
- [Development Roadmap](#development-roadmap)
- [Data Flow and Processing](#data-flow-and-processing)
- [Security Architecture](#security-architecture)
- [Monitoring and Observability](#monitoring-and-observability)
- [Deployment Model](#deployment-model)
- [Integration Patterns](#integration-patterns)

---

## Executive Summary

The Ham Radio Callsign Worker is a serverless API service built on Cloudflare's edge computing platform. It provides fast, globally-distributed ham radio callsign lookups, database management, and administrative functions. The architecture leverages Cloudflare Workers for compute, D1 for relational data storage, KV for configuration and caching, and R2 for object storage (logs, exports, backups).

### Key Architectural Goals

1. **Edge-First Performance**: Deliver sub-100ms response times globally by running on Cloudflare's edge network
2. **Intelligent Data Management**: Implement differential updates to minimize database operations and bandwidth
3. **High Availability**: Design for 99.9%+ uptime with automatic failover and recovery
4. **Modular Development**: Support incremental feature delivery with clear phase boundaries
5. **Operational Excellence**: Comprehensive logging, monitoring, and self-healing capabilities

---

## Architectural Principles

### 1. Serverless-First Design
- Zero infrastructure management
- Automatic scaling from zero to millions of requests
- Pay-per-use cost model
- Global distribution without configuration

### 2. Type Safety and Developer Experience
- TypeScript throughout the codebase
- Strong typing for API contracts and data models
- Compile-time error detection
- Comprehensive JSDoc documentation

### 3. Configuration-as-Data
- All operational parameters stored in Cloudflare KV
- No redeployment required for configuration changes
- Version-controlled configuration with rollback capability
- Dynamic feature flags for gradual rollouts

### 4. Data Integrity and Validation
- Hash-based validation for all data fetches
- Schema verification against expected formats
- Automatic rollback to last known good data on failures
- Comprehensive audit trails for all data changes

### 5. Graceful Degradation
- Fallback mechanisms at every layer
- Never block on optional operations (external sync, caching)
- Detailed error logging without service interruption
- Progressive enhancement for advanced features

---

## System Architecture

### High-Level Component View

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client Applications                         │
│            (Web Apps, Mobile Apps, PWAs, IoT Devices)           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Cloudflare Edge Network                        │
│           (DDoS Protection, SSL/TLS, CDN, Routing)              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Ham Radio Callsign Worker (Core)                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           Request Pipeline                               │   │
│  │  1. CORS & Security Headers                              │   │
│  │  2. Authentication & Authorization                       │   │
│  │  3. Rate Limiting                                        │   │
│  │  4. Request Routing                                      │   │
│  │  5. Structured Logging                                   │   │
│  └────────────────┬────────────────────────────┬────────────┘   │
│                   │                            │                │
│  ┌────────────────▼────────────┐  ┌────────────▼─────────────┐  │
│  │   User API Layer            │  │  Admin API Layer         │  │
│  │                             │  │                          │  │
│  │  • Callsign Lookup          │  │  • Database Updates      │  │
│  │  • Search Operations        │  │  • Rebuild Operations    │  │
│  │  • Export Functions         │  │  • Rollback Control      │  │
│  │  • Health Checks            │  │  • Log Access            │  │
│  │  • Version Info             │  │  • System Metadata       │  │
│  └────────────────┬────────────┘  └────────────┬─────────────┘  │
│                   │                            │                │
│  ┌────────────────▼────────────────────────────▼─────────────┐  │
│  │              Business Logic Layer                         │  │
│  │                                                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │  │
│  │  │Configuration │  │Data Fetch &  │  │ Diff & Patch  │  │  │
│  │  │Manager       │  │Validation    │  │ Engine        │  │  │
│  │  │              │  │Engine        │  │               │  │  │
│  │  └──────────────┘  └──────────────┘  └───────────────┘  │  │
│  │                                                           │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │  │
│  │  │Query & Search│  │Export        │  │Slave Sync     │  │  │
│  │  │Service       │  │Generator     │  │Propagation    │  │  │
│  │  │              │  │              │  │               │  │  │
│  │  └──────────────┘  └──────────────┘  └───────────────┘  │  │
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
│ • Cache Layer   │  │ • Full-text     │  │ • Backup Files  │
│ • Metadata      │  │   Indexes       │  │ • Audit Logs    │
│ • Session Data  │  │ • Version Info  │  │ • Diff Reports  │
└─────────────────┘  └─────────────────┘  │ • Event Logs    │
                                           └─────────────────┘

      Optional External Synchronization (Phase 6)
      ┌───────────────────────────────────────────┐
      │                                           │
      ▼                                           ▼
┌─────────────────┐                    ┌─────────────────┐
│  External SQL   │                    │ External Redis  │
│   Databases     │                    │     Caches      │
│                 │                    │                 │
│ • Read Replicas │                    │ • Distributed   │
│ • Analytics DB  │                    │   Caching       │
│ • Reporting     │                    │ • Session Store │
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

---

## Technology Stack

### Core Platform
- **Cloudflare Workers**: V8-isolate serverless compute platform
- **TypeScript**: v5.3+ for type-safe development
- **Wrangler 3**: CLI tooling for development and deployment

### Data Storage
- **Cloudflare D1**: SQLite-based relational database for callsign records
- **Cloudflare KV**: Distributed key-value store for configuration and caching
- **Cloudflare R2**: S3-compatible object storage for logs, exports, and backups

### Development Tools
- **Vitest**: Unit and integration testing framework
- **ESLint**: Code linting with TypeScript support
- **Prettier**: Code formatting
- **Git**: Version control

### Optional External Integrations
- **PostgreSQL/MySQL**: External SQL databases for synchronization
- **Redis**: External caching layer for distributed deployments

---

## Core Components

### 1. Configuration Manager
**File**: `src/config.ts`

**Responsibilities**:
- Load configuration from KV namespace
- Validate configuration schema
- Provide type-safe configuration access
- Support dynamic reloading
- Handle configuration versioning

**Key Configuration Areas**:
- Data source URLs and credentials
- Database schema definitions
- Feature flags (JWT, canary deployments)
- Rate limiting rules
- External sync endpoints
- Logging levels and retention policies

### 2. Request Router
**File**: `src/router.ts`

**Responsibilities**:
- Route incoming requests to appropriate handlers
- Apply middleware chain (CORS, auth, rate limiting)
- Handle routing errors and 404s
- Support API versioning
- Provide request context to handlers

### 3. Middleware Layer
**File**: `src/middleware.ts`

**Responsibilities**:
- CORS header injection
- Authentication validation (API keys, future JWT)
- Rate limiting enforcement
- Request logging and tracing
- Error boundary handling

### 4. User Handlers
**File**: `src/handlers/user.ts`

**Endpoints**:
- `GET /api/v1/callsign/:callsign` - Single callsign lookup
- `GET /api/v1/search?q={query}` - Search across callsign fields
- `GET /api/v1/export?format={format}` - Database export
- `GET /health` - Health check
- `GET /version` - Version information

### 5. Admin Handlers
**File**: `src/handlers/admin.ts`

**Endpoints**:
- `POST /admin/update` - Force database update from source
- `POST /admin/rebuild` - Full database rebuild
- `POST /admin/rollback` - Rollback to previous version
- `GET /admin/logs` - Access system logs from R2
- `GET /admin/metadata` - View database and system metadata
- `GET /admin/stats` - System statistics and metrics

### 6. Data Fetch & Validation Engine
**Status**: Phase 4 - Planned (Issue #12)

**Responsibilities**:
- Fetch ZIP files from configured origin URLs
- Extract target files from archives
- Validate file integrity using hashes
- Verify schema matches expected format
- Store fetched data for processing

### 7. Diff & Patch Engine
**Status**: Phase 5 - Planned (Issue #11)

**Responsibilities**:
- Compare new data with existing database
- Identify records to add, update, and delete
- Generate minimal change sets
- Apply changes transactionally to D1
- Create diff reports and store in R2

### 8. Slave Synchronization Engine
**Status**: Phase 6 - Planned (Issue #10)

**Responsibilities**:
- Propagate updates to external SQL databases
- Synchronize with Redis caches
- Track sync status for each endpoint
- Handle sync failures gracefully
- Support canary rollout patterns

### 9. Logging & Monitoring
**Status**: Phase 7 - Planned (Issue #8)

**Responsibilities**:
- Structured JSONL logging to R2
- Request/response logging
- Error tracking and alerting
- Performance metrics collection
- Audit trail generation

---

## Development Roadmap

The project follows a phased development approach, with each phase building upon the previous ones. Each phase has clear deliverables and acceptance criteria.

### Phase 1: Project Initialization ✅ **COMPLETED**

**Issue**: #6 (Closed)

**Status**: Complete

**Deliverables**:
- ✅ Repository structure with TypeScript and Wrangler 3
- ✅ Comprehensive README with architectural vision
- ✅ Development environment setup (linting, formatting, testing)
- ✅ Basic health and version endpoints
- ✅ Contributing guidelines and documentation standards

**Acceptance Criteria**:
- Project builds without errors
- Basic endpoints respond correctly
- Documentation is comprehensive and accurate

---

### Phase 2: API and Endpoint Layer ✅ **COMPLETED**

**Issues**: #1, #9, #5 (All Closed)

**Status**: Complete

**Deliverables**:
- ✅ User API endpoints (callsign lookup, search, export)
- ✅ Admin API endpoints (update, rebuild, rollback, logs, metadata)
- ✅ Authentication middleware (API key-based)
- ✅ Rate limiting implementation
- ✅ CORS configuration
- ✅ Error handling and consistent response formats
- ✅ Configuration module with KV integration
- ✅ Comprehensive API documentation

**Acceptance Criteria**:
- All endpoints return proper responses
- Authentication works correctly
- Rate limiting enforces limits
- Error responses follow standard format
- Configuration loads from KV successfully

---

### Phase 3: Configuration and Infrastructure Setup ✅ **COMPLETED**

**Issue**: #5 (Closed)

**Status**: Complete

**Deliverables**:
- ✅ Configuration loading from KV namespace
- ✅ Configuration validation and type safety
- ✅ Support for origin URLs, schema definitions, feature flags
- ✅ Configuration versioning and rollback
- ✅ Configuration health endpoint
- ✅ Documentation of configuration structure

**Acceptance Criteria**:
- Configuration loads dynamically from KV
- Invalid configurations are rejected
- Configuration changes don't require redeployment
- Rollback mechanism works correctly

---

### Phase 4: Data Fetch, Extraction, and Validation Engine 🔄 **IN PROGRESS**

**Issue**: #12 (Open)

**Status**: Planned

**Objective**: Build the core engine for on-demand data fetching, extraction, and validation from external sources.

**Key Deliverables**:

1. **Data Fetching Engine**
   - Fetch ZIP files from KV-configured origin URLs
   - Implement retry logic with exponential backoff
   - Support manual and automatic triggers (staleness detection)
   - Handle network errors and timeouts gracefully

2. **Extraction and Validation**
   - Extract target files from ZIP archives
   - Validate file presence and integrity (hash validation)
   - Verify header/schema match against KV configuration
   - Content validation against expected data format
   - Detect data corruption and format violations

3. **Error Handling and Fallback**
   - Comprehensive error logging for all failure scenarios
   - Fallback to last known good data on validation failures
   - Store event logs and metadata in R2 (JSONL format)
   - Implement log rotation for storage management

4. **Staging and Deployment Features**
   - Staging/canary deployment support via configuration flags
   - Admin endpoints for manual data refresh triggers
   - Preview mode for validation without applying changes

**Acceptance Criteria**:
- Successfully fetch and extract ZIP files from configured sources
- Validation correctly identifies data issues
- Failed validations trigger fallback to previous data
- All events are logged to R2 with proper structure
- Admin can manually trigger updates
- Canary/staging flags work as expected

**Testing Requirements**:
- Unit tests for fetch, extract, and validation functions
- Integration tests with mock ZIP files
- Error scenario testing (network failures, corrupted data, schema mismatches)
- End-to-end test of full fetch-to-validate pipeline

**Documentation Updates**:
- Document fetch/extract/validate workflow
- Provide troubleshooting guide for common failures
- Update README with new endpoints and procedures
- Add configuration examples for data sources

---

### Phase 5: Data Diffing, Patching, and Recovery 🔄 **PLANNED**

**Issue**: #11 (Open)

**Status**: Planned

**Objective**: Implement intelligent differential updates to minimize database operations and enable safe rollbacks.

**Key Deliverables**:

1. **Differential Analysis**
   - Compare newly extracted data with previous version
   - Use hash-based comparison and record keys
   - Identify records to add, update, and remove
   - Generate comprehensive diff reports with statistics

2. **Efficient Database Patching**
   - Patch Cloudflare D1 with only changed records
   - Use transactional updates for data consistency
   - Minimize write operations for performance
   - Batch operations for efficiency
   - Handle large datasets without timeouts

3. **Metadata and Reporting**
   - Calculate update statistics (added/modified/removed counts)
   - Store diff reports in R2 with timestamps
   - Maintain version history with full metadata
   - Track data lineage and provenance

4. **Recovery and Rollback**
   - Safe rollback to last known good version
   - Admin-triggered rollback capability
   - Automatic fallback on validation failures
   - Data backup before each update operation
   - Preserve N previous versions for recovery

**Acceptance Criteria**:
- Diff algorithm correctly identifies all changes
- Only changed records are written to D1
- Diff reports are accurate and complete
- Rollback successfully restores previous state
- Automatic fallback works on validation failures
- No data loss during updates or rollbacks

**Testing Requirements**:
- Unit tests for diff algorithm with various scenarios
- Integration tests for D1 patching operations
- Transaction rollback testing
- Large dataset performance testing
- Rollback mechanism verification

**Documentation Updates**:
- Document diff/patch/recovery process
- Provide logging approach and format specifications
- Update README with rollback procedures
- Add troubleshooting guide for update failures

---

### Phase 6: Slave Synchronization and External Cache Layer 🔄 **PLANNED**

**Issue**: #10 (Open)

**Status**: Planned

**Objective**: Enable synchronization with external SQL databases and Redis caches for distributed deployments.

**Key Deliverables**:

1. **Dynamic Slave Configuration**
   - Load slave SQL/Redis endpoints from KV configuration
   - Support multiple slave targets with independent configs
   - Hot-reload slave configurations without service interruption
   - Connection pooling and management

2. **Propagation Engine**
   - Propagate delta updates to all configured slaves
   - Apply minimal change sets (only changed records)
   - Parallel synchronization to multiple targets
   - Batch updates for efficiency
   - Support different database types (PostgreSQL, MySQL, Redis)

3. **Health Tracking and Monitoring**
   - Track sync events and last-sync metadata
   - Monitor slave endpoint health and availability
   - Generate sync status reports
   - Alert on sync failures
   - Track replication lag

4. **Error Handling**
   - Graceful fallback when slaves are unavailable
   - Log errors without blocking core worker
   - Implement retry logic with configurable backoff
   - Support partial success scenarios
   - Dead letter queue for failed syncs

5. **Canary Deployments**
   - Support canary rollout via admin-configured flags
   - Gradual slave activation for testing
   - Traffic splitting for validation
   - Automatic rollback on canary failures

**Acceptance Criteria**:
- Slave configurations load correctly from KV
- Updates propagate successfully to all configured slaves
- Sync failures don't impact core worker functionality
- Health tracking accurately reflects slave status
- Canary deployments work as configured
- Retry logic handles transient failures

**Testing Requirements**:
- Unit tests for sync logic
- Integration tests with mock SQL/Redis endpoints
- Failure scenario testing (network failures, slave down)
- Performance testing with multiple slaves
- Canary deployment verification

**Documentation Updates**:
- Document slave configuration structure
- Provide setup guide for SQL/Redis slaves
- Update README with synchronization workflow
- Add troubleshooting guide for sync issues

---

### Phase 7: Logging, Audit, and Monitoring Infrastructure 🔄 **PLANNED**

**Issue**: #8 (Open)

**Status**: Planned

**Objective**: Establish comprehensive logging, audit trails, and monitoring capabilities for operational visibility.

**Key Deliverables**:

1. **Structured Logging System**
   - Implement JSONL-formatted logs stored in R2
   - Event-level and error-level logging with appropriate detail
   - Automatic log rotation to manage storage costs
   - Log aggregation and indexing
   - Support for log levels (DEBUG, INFO, WARN, ERROR)

2. **Audit Trails**
   - Track all data updates with full metadata
   - Log configuration changes and who made them
   - Record all admin actions with timestamps
   - Maintain version history with audit metadata
   - Store diff reports for each update cycle
   - Compliance-ready audit logs

3. **Monitoring Endpoints**
   - Enhanced metadata endpoints for viewing status
   - Detailed health checks with component status
   - Performance metrics and statistics endpoints
   - Query performance tracking
   - Resource utilization metrics

4. **Operational Procedures**
   - Log inspection and retrieval tools
   - Log rotation and archival procedures
   - Error analysis workflows
   - Alerting and notification setup
   - Incident response runbooks

**Acceptance Criteria**:
- All significant events are logged in JSONL format
- Logs are stored reliably in R2
- Log rotation prevents storage bloat
- Audit trail is complete and tamper-evident
- Monitoring endpoints provide actionable data
- Operational procedures are documented

**Testing Requirements**:
- Unit tests for logging functions
- Integration tests for R2 log storage
- Log rotation testing
- Audit trail verification
- Performance impact testing

**Documentation Updates**:
- Document logging structure and format
- Provide log analysis guide
- Update README with monitoring procedures
- Add operational runbooks
- Document alert thresholds and responses

---

### Phase 8: Testing, E2E Verification, and PWA Integration 🔄 **PLANNED**

**Issue**: #7 (Open)

**Status**: Planned

**Objective**: Establish comprehensive testing infrastructure and provide integration examples for client applications.

**Key Deliverables**:

1. **Testing Infrastructure**
   - Modular unit test suites for each component
   - Integration tests for API endpoints and workflows
   - End-to-end test harness for update+query cycles
   - Leverage Cloudflare testing frameworks (Miniflare, Wrangler dev)
   - Automated test execution in CI/CD
   - Code coverage reporting

2. **Component-Specific Tests**
   - KV configuration loading and validation tests
   - Fetch/validation engine tests with mock data
   - Diffing and patching logic tests
   - Endpoint authentication and authorization tests
   - Rate limiting verification
   - Database query tests

3. **Edge Case Testing**
   - Manual test flows for data edge cases
   - Failure and fallback scenario testing
   - Recovery and rollback verification
   - Concurrent update handling
   - Large dataset testing
   - Rate limiting and security tests

4. **Integration Examples**
   - Sample scripts for cache/DB synchronization
   - Query examples for all storage layers
   - API client libraries (JavaScript, Python)
   - Best practices for API usage
   - Performance optimization examples

5. **Progressive Web App (PWA) Integration**
   - PWA integration guide and documentation
   - Sample PWA implementation with API usage
   - Offline caching strategies using Service Workers
   - Real-time update notifications
   - Background sync patterns
   - Mobile-first responsive design examples

**Acceptance Criteria**:
- Test coverage exceeds 80% for critical paths
- All tests pass consistently
- Edge cases are handled correctly
- Integration examples work as documented
- PWA example demonstrates offline functionality
- Documentation is comprehensive and accurate

**Testing Requirements**:
- Unit tests for all components
- Integration tests for all endpoints
- End-to-end tests for critical workflows
- Performance benchmarking
- Security testing (OWASP top 10)
- Load testing

**Documentation Updates**:
- Comprehensive testing guide
- API integration examples with code
- PWA development guide
- Update README with testing information
- Add performance tuning guide

---

## Data Flow and Processing

### Query Flow (Read Path)

```
1. Client Request
   ↓
2. Cloudflare Edge (DDoS protection, SSL termination)
   ↓
3. Worker Request Pipeline
   - CORS headers
   - Rate limiting check
   - Request logging
   ↓
4. Router (route to user handler)
   ↓
5. User Handler (callsign lookup)
   ↓
6. Check KV Cache
   - Cache hit → Return cached response
   - Cache miss → Continue to D1
   ↓
7. Query D1 Database
   ↓
8. Store result in KV Cache (with TTL)
   ↓
9. Format JSON Response
   ↓
10. Return to Client
```

**Performance Characteristics**:
- Cache hit: ~10-30ms (edge to edge)
- Cache miss: ~50-150ms (includes D1 query)
- Global distribution: <100ms from any location

### Update Flow (Write Path)

```
1. Admin triggers update (manual or scheduled)
   ↓
2. Worker Admin Handler
   - Authenticate API key
   - Log admin action
   ↓
3. Fetch Data from Origin
   - Download ZIP file
   - Retry on failures
   ↓
4. Extract and Validate
   - Unzip archive
   - Validate file integrity (hash)
   - Verify schema match
   - Validate data format
   ↓
5. Diff Against Current Data
   - Load current D1 snapshot
   - Compare records by key and hash
   - Identify adds/updates/deletes
   - Generate diff report
   ↓
6. Backup Current State
   - Store current version metadata
   - Prepare rollback point
   ↓
7. Apply Changes to D1 (transactional)
   - Insert new records
   - Update changed records
   - Delete removed records
   - Update version metadata
   ↓
8. Propagate to Slaves (if configured)
   - Send delta updates to SQL slaves
   - Update Redis caches
   - Track sync status
   ↓
9. Store Artifacts in R2
   - Diff report
   - Update metadata
   - Audit log entry
   - Event log
   ↓
10. Invalidate KV Cache
    - Clear relevant cache entries
    - Force fresh queries
   ↓
11. Return Update Status to Admin
```

**Error Handling**:
- Validation failure → Abort update, use last known good data
- D1 transaction failure → Rollback, log error, alert admin
- Slave sync failure → Log error, continue (slaves eventually consistent)
- R2 storage failure → Log error, continue (logs are best-effort)

---

## Security Architecture

### Authentication and Authorization

**Current Implementation** (Phases 1-3):
- **API Key Authentication**: Admin endpoints require `X-API-Key` header or `Authorization: Bearer` token
- **Public Endpoints**: User endpoints are public but rate-limited
- **Environment-based Secrets**: API keys stored as Cloudflare Worker secrets

**Future Enhancements**:
- **JWT Support**: Flagged for future implementation (Phase 8+)
- **Role-Based Access Control (RBAC)**: Different permission levels for admin operations
- **OAuth Integration**: Support for third-party authentication providers

### Rate Limiting

**Configuration**:
- **User Endpoints**: 100 requests per minute per IP
- **Admin Endpoints**: 20 requests per minute per API key
- **Configurable Limits**: Stored in KV configuration for dynamic updates

**Implementation**:
- Counter-based using KV with TTL
- Per-endpoint and per-client tracking
- Graceful degradation (allow requests if KV unavailable)

### Input Validation

**Principles**:
- Validate all user inputs (callsigns, search queries, parameters)
- Sanitize data before database queries (SQL injection prevention)
- Type checking using TypeScript
- Schema validation for API requests and responses

**Validation Rules**:
- Callsign format validation (regex-based)
- Query parameter whitelisting
- Content-type verification
- Size limits on request bodies

### Data Integrity

**Measures**:
- Hash validation for all fetched data
- Schema verification before applying updates
- Transactional database updates (all-or-nothing)
- Version tracking and audit trails
- Backup before every update

### DDoS Protection

**Cloudflare Built-in**:
- Layer 3/4 DDoS mitigation
- Rate limiting at edge
- Bot detection and mitigation
- Challenge pages for suspicious traffic

### Secrets Management

**Best Practices**:
- Never commit secrets to git
- Use Cloudflare Worker secrets for API keys
- Store sensitive configuration in encrypted KV
- Rotate secrets regularly
- Audit secret access

---

## Monitoring and Observability

### Logging Strategy

**Log Levels**:
1. **DEBUG**: Detailed diagnostic information (development only)
2. **INFO**: General informational messages (request/response, operations)
3. **WARN**: Warning messages (degraded performance, retries)
4. **ERROR**: Error messages (failures, exceptions)

**Log Structure (JSONL)**:
```json
{
  "timestamp": "2026-01-27T01:08:52.229Z",
  "level": "INFO",
  "component": "fetch-engine",
  "action": "fetch-zip",
  "status": "success",
  "url": "https://example.com/data.zip",
  "size_bytes": 1048576,
  "duration_ms": 234,
  "request_id": "abc123",
  "metadata": {}
}
```

**Log Storage**:
- **Primary**: R2 object storage (cost-effective, durable)
- **Format**: JSONL (newline-delimited JSON)
- **Rotation**: Daily logs with 90-day retention
- **Naming**: `logs/{year}/{month}/{day}/{timestamp}.jsonl`

### Metrics and Monitoring

**Key Metrics**:

1. **Request Metrics**
   - Request rate (requests per second)
   - Response time (p50, p95, p99)
   - Error rate (4xx, 5xx)
   - Cache hit ratio

2. **Database Metrics**
   - Query count and duration
   - Connection pool utilization
   - Database size and growth rate
   - Index usage statistics

3. **Update Metrics**
   - Update frequency and duration
   - Records added/updated/deleted per update
   - Validation success/failure rate
   - Slave sync lag and errors

4. **Resource Metrics**
   - Worker CPU time
   - Memory usage
   - KV operation count
   - R2 storage utilization

**Monitoring Endpoints**:
- `GET /health` - Basic health check (200 OK or 503 Service Unavailable)
- `GET /admin/metadata` - Detailed system metadata
- `GET /admin/stats` - Real-time statistics and metrics

### Alerting

**Alert Conditions**:
- Error rate exceeds threshold (>1% of requests)
- Response time degradation (p95 > 500ms)
- Database update failures
- Slave synchronization failures
- Storage quota warnings (>80% utilization)

**Alert Channels**:
- Email notifications to admins
- Webhook integrations (Slack, PagerDuty)
- Cloudflare dashboard alerts

### Audit Trail

**Tracked Events**:
- All admin actions (who, what, when)
- Configuration changes
- Database updates (version, changes, outcome)
- Authentication attempts (success/failure)
- Rate limit violations

**Audit Log Format**:
```json
{
  "timestamp": "2026-01-27T01:08:52.229Z",
  "event_type": "admin_action",
  "action": "trigger_update",
  "actor": "api_key_abc123",
  "result": "success",
  "metadata": {
    "records_added": 150,
    "records_updated": 23,
    "records_deleted": 5,
    "duration_ms": 12345
  }
}
```

---

## Deployment Model

### Development Environment

**Local Development**:
```bash
# Install dependencies
npm install

# Run local development server (Miniflare)
npm run dev

# Access at http://localhost:8787
```

**Development Features**:
- Hot reload on code changes
- Local KV, D1, and R2 emulation
- Request inspection and debugging
- TypeScript type checking

### Staging Environment

**Configuration**:
- Separate Cloudflare Worker environment
- Isolated KV namespaces, D1 databases, R2 buckets
- Test data and configurations
- Canary deployment testing

**Purpose**:
- Integration testing
- Performance testing
- Validation before production release
- Training and documentation

### Production Environment

**Deployment Process**:
```bash
# Type check
npm run build

# Run tests
npm test

# Deploy to production
npm run deploy
```

**Deployment Strategy**:
- **Blue-Green Deployment**: Zero-downtime releases
- **Gradual Rollout**: Deploy to percentage of edge locations first
- **Automatic Rollback**: Revert on error rate increase
- **Health Checks**: Post-deployment verification

**Environment Variables**:
- `ADMIN_API_KEY`: Admin authentication key (secret)
- `ENVIRONMENT`: `development` | `staging` | `production`
- `LOG_LEVEL`: Logging verbosity level

### Infrastructure as Code

**Wrangler Configuration** (`wrangler.toml`):
```toml
name = "ham-radio-callsign-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
route = "api.example.com/*"
kv_namespaces = [
  { binding = "CONFIG_KV", id = "..." },
  { binding = "CACHE_KV", id = "..." }
]
d1_databases = [
  { binding = "DB", database_id = "..." }
]
r2_buckets = [
  { binding = "STORAGE_BUCKET", bucket_name = "..." }
]
```

### Disaster Recovery

**Backup Strategy**:
- **D1 Database**: Daily automated backups
- **KV Configuration**: Versioned with rollback capability
- **R2 Storage**: Cross-region replication
- **Recovery Time Objective (RTO)**: < 15 minutes
- **Recovery Point Objective (RPO)**: < 24 hours

---

## Integration Patterns

### API Client Integration

**JavaScript/TypeScript Example**:
```typescript
// Simple API client
class CallsignClient {
  constructor(private baseUrl: string, private apiKey?: string) {}

  async lookup(callsign: string) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/callsign/${callsign}`
    );
    return response.json();
  }

  async search(query: string) {
    const response = await fetch(
      `${this.baseUrl}/api/v1/search?q=${encodeURIComponent(query)}`
    );
    return response.json();
  }

  async adminUpdate() {
    const response = await fetch(
      `${this.baseUrl}/admin/update`,
      {
        method: 'POST',
        headers: { 'X-API-Key': this.apiKey! }
      }
    );
    return response.json();
  }
}
```

### Progressive Web App (PWA) Integration

**Service Worker Caching Strategy**:
```javascript
// Cache-first strategy for callsign lookups
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname.startsWith('/api/v1/callsign/')) {
    event.respondWith(
      caches.open('callsign-cache-v1').then((cache) => {
        return cache.match(event.request).then((response) => {
          // Return cached response or fetch from network
          return response || fetch(event.request).then((networkResponse) => {
            // Cache the network response for offline use
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  }
});
```

**Offline Support**:
- Cache API responses for offline access
- Background sync for pending updates
- Optimistic UI updates
- Queue failed requests for retry

### External Database Synchronization

**PostgreSQL Slave Example**:
```sql
-- Table schema for slave database
CREATE TABLE callsigns (
  callsign VARCHAR(10) PRIMARY KEY,
  name VARCHAR(255),
  address TEXT,
  license_class VARCHAR(50),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Upsert query for synchronization
INSERT INTO callsigns (callsign, name, address, license_class)
VALUES ($1, $2, $3, $4)
ON CONFLICT (callsign) 
DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  license_class = EXCLUDED.license_class,
  last_updated = CURRENT_TIMESTAMP;
```

**Redis Cache Example**:
```javascript
// Store callsign lookup in Redis
async function cacheCallsign(redis, callsign, data) {
  const key = `callsign:${callsign.toUpperCase()}`;
  await redis.setex(key, 3600, JSON.stringify(data)); // 1 hour TTL
}

// Retrieve from Redis cache
async function getCallsignFromCache(redis, callsign) {
  const key = `callsign:${callsign.toUpperCase()}`;
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}
```

### Webhook Integration

**Update Notification Webhook**:
```json
POST https://example.com/webhooks/callsign-update
Content-Type: application/json

{
  "event": "database_updated",
  "timestamp": "2026-01-27T01:08:52.229Z",
  "version": "2026-01-27-01",
  "changes": {
    "added": 150,
    "updated": 23,
    "deleted": 5,
    "total": 178
  },
  "metadata": {
    "duration_ms": 12345,
    "source_url": "https://example.com/data.zip",
    "data_hash": "abc123..."
  }
}
```

---

## Best Practices

### Development Workflow

1. **Feature Branches**: Create branch for each feature or fix
2. **Small Commits**: Commit often with clear, descriptive messages
3. **Code Review**: All changes reviewed before merging
4. **Testing**: Write tests alongside code, maintain coverage
5. **Documentation**: Update docs with code changes

### Code Quality

1. **Type Safety**: Leverage TypeScript's type system fully
2. **Error Handling**: Handle all error cases explicitly
3. **Logging**: Log important events and errors with context
4. **Comments**: Explain "why" not "what" in comments
5. **DRY Principle**: Avoid code duplication

### Performance Optimization

1. **Caching**: Use KV cache for frequently accessed data
2. **Batching**: Batch database operations when possible
3. **Indexing**: Maintain proper database indexes
4. **Minimize Round-trips**: Reduce network calls
5. **Lazy Loading**: Load data only when needed

### Security Guidelines

1. **Input Validation**: Never trust user input
2. **Secret Management**: Use Worker secrets, never hardcode
3. **Least Privilege**: Grant minimum necessary permissions
4. **Audit Logging**: Log all security-relevant events
5. **Regular Updates**: Keep dependencies up to date

---

## Troubleshooting Guide

### Common Issues

#### 1. Configuration Not Loading
**Symptom**: Worker fails to start or uses default config
**Causes**:
- KV namespace not bound correctly
- Configuration JSON malformed
- Configuration key not set

**Solution**:
```bash
# Verify KV binding in wrangler.toml
# Check KV namespace contains config
wrangler kv:key get --namespace-id=xxx "config"

# Validate JSON format
```

#### 2. Database Update Failures
**Symptom**: Updates fail with validation errors
**Causes**:
- Data source unreachable
- ZIP file corrupted
- Schema mismatch
- Hash validation failure

**Solution**:
- Check admin logs: `GET /admin/logs`
- Verify source URL in configuration
- Test URL manually with curl
- Check diff report in R2 for details

#### 3. High Response Times
**Symptom**: API responses slower than expected
**Causes**:
- Cache miss rate high
- Database queries inefficient
- Large result sets
- Network latency

**Solution**:
- Check cache hit ratio in stats
- Review query patterns and add indexes
- Implement pagination for large results
- Use database query analysis tools

#### 4. Rate Limiting Issues
**Symptom**: Legitimate requests being blocked
**Causes**:
- Limits too restrictive
- Shared IP addresses (NAT)
- Bot traffic

**Solution**:
- Review rate limit configuration
- Implement IP whitelisting for known clients
- Use API keys for authenticated clients
- Adjust limits in KV configuration

---

## Appendix

### Glossary

- **D1**: Cloudflare's SQLite-based distributed SQL database
- **KV**: Cloudflare's key-value store for low-latency reads
- **R2**: Cloudflare's object storage (S3-compatible)
- **Worker**: Cloudflare's serverless compute platform
- **Edge**: Cloudflare's globally distributed network locations
- **Wrangler**: CLI tool for Cloudflare Workers development
- **JSONL**: JSON Lines format (newline-delimited JSON)
- **TTL**: Time To Live (cache expiration time)

### References

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare KV Documentation](https://developers.cloudflare.com/kv/)
- [Cloudflare R2 Documentation](https://developers.cloudflare.com/r2/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vitest Documentation](https://vitest.dev/)

### Related Issues

- [Issue #5](https://github.com/cjemorton/ham-radio-callsign-worker/issues/5) - Configuration Module (Closed)
- [Issue #7](https://github.com/cjemorton/ham-radio-callsign-worker/issues/7) - Testing & PWA Integration
- [Issue #8](https://github.com/cjemorton/ham-radio-callsign-worker/issues/8) - Logging & Monitoring
- [Issue #10](https://github.com/cjemorton/ham-radio-callsign-worker/issues/10) - Slave Synchronization
- [Issue #11](https://github.com/cjemorton/ham-radio-callsign-worker/issues/11) - Data Diffing & Patching
- [Issue #12](https://github.com/cjemorton/ham-radio-callsign-worker/issues/12) - Data Fetch & Validation

---

**Document Version**: 1.0  
**Last Updated**: 2026-01-27  
**Maintained By**: Project Team  
**Status**: Living Document (Updated with Each Phase)
