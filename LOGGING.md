# Logging, Audit, and Monitoring Guide

This guide provides comprehensive information about the logging, audit, and monitoring infrastructure in the Ham Radio Callsign Worker.

## Table of Contents

- [Overview](#overview)
- [Log Structure](#log-structure)
- [Logging Endpoints](#logging-endpoints)
- [Log Rotation](#log-rotation)
- [Monitoring and Status](#monitoring-and-status)
- [Error Handling and Recovery](#error-handling-and-recovery)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

The Ham Radio Callsign Worker implements a comprehensive logging system with the following features:

- **Structured JSONL Logs**: All events are logged in JSON Lines format for easy parsing
- **R2 Storage**: Logs are stored in Cloudflare R2 buckets for durability and scalability
- **Daily Rotation**: Logs are automatically rotated daily to manage storage costs
- **Event-Level Logging**: Different event types (fetch, extract, validate, fallback, error)
- **Retention Management**: Configurable retention periods with automatic cleanup
- **Admin Endpoints**: RESTful API endpoints for log inspection and management

## Log Structure

### Log File Organization

Logs are stored in R2 with the following structure:

```
R2 Bucket (DATA_EXPORTS)
├── events/
│   ├── logs-2024-01-15.jsonl      # Daily event logs
│   ├── logs-2024-01-16.jsonl
│   └── archive/                    # Archived old logs
│       └── logs-2023-12-01.jsonl
├── diffs/
│   ├── diff-v1.2.3-2024-01-15T10-30-00.json
│   └── diff-v1.2.4-2024-01-16T14-20-00.json
└── metadata/
    ├── status.json
    └── version.json
```

### JSONL Format

Each line in a log file is a complete JSON object representing a single event:

```jsonl
{"eventId":"1705318920000-abc123","timestamp":"2024-01-15T10:30:00.000Z","type":"fetch","status":"success","details":{"message":"Data fetched successfully","duration":1234,"dataSize":5242880}}
{"eventId":"1705318980000-def456","timestamp":"2024-01-15T10:35:00.000Z","type":"validate","status":"success","details":{"message":"Validation passed","recordCount":50000}}
{"eventId":"1705319040000-ghi789","timestamp":"2024-01-15T10:40:00.000Z","type":"error","status":"failure","details":{"message":"Error in database update","error":"Connection timeout","stackTrace":"..."}}
```

### Event Types

#### 1. Fetch Events
Logged when data is fetched from external sources.

```json
{
  "eventId": "1705318920000-abc123",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "type": "fetch",
  "status": "success",
  "details": {
    "message": "Data fetched successfully from origin",
    "duration": 1234,
    "dataSize": 5242880,
    "url": "https://example.com/data.zip"
  }
}
```

#### 2. Extract Events
Logged during data extraction from ZIP files.

```json
{
  "eventId": "1705318950000-bcd234",
  "timestamp": "2024-01-15T10:32:30.000Z",
  "type": "extract",
  "status": "success",
  "details": {
    "message": "Data extracted successfully",
    "fileName": "callsigns.csv",
    "size": 4500000,
    "encoding": "utf-8"
  }
}
```

#### 3. Validate Events
Logged during data validation.

```json
{
  "eventId": "1705318980000-cde345",
  "timestamp": "2024-01-15T10:35:00.000Z",
  "type": "validate",
  "status": "success",
  "details": {
    "message": "Validation passed",
    "recordCount": 50000,
    "hashMatch": true,
    "schemaMatch": true
  }
}
```

#### 4. Fallback Events
Logged when fallback data is used.

```json
{
  "eventId": "1705319010000-efg456",
  "timestamp": "2024-01-15T10:37:30.000Z",
  "type": "fallback",
  "status": "warning",
  "details": {
    "message": "Using fallback data due to validation failure",
    "reason": "Schema mismatch in new data",
    "fallbackVersion": "v1.2.3",
    "fallbackTimestamp": "2024-01-14T10:00:00.000Z"
  }
}
```

#### 5. Error Events
Logged when errors occur.

```json
{
  "eventId": "1705319040000-fgh567",
  "timestamp": "2024-01-15T10:40:00.000Z",
  "type": "error",
  "status": "failure",
  "details": {
    "message": "Error in database update: Connection timeout",
    "error": "Connection timeout",
    "stackTrace": "Error: Connection timeout\n    at ...",
    "metadata": {
      "operation": "database_update",
      "recordsProcessed": 1000
    }
  }
}
```

## Logging Endpoints

### View Event Logs

**Endpoint**: `GET /admin/logs/events`

**Authentication**: Required (Admin API key)

**Query Parameters**:
- `limit` (optional, default: 100): Maximum number of log entries to return
- `date` (optional, format: YYYY-MM-DD): Specific date to retrieve logs for (defaults to today)
- `level` (optional): Filter by log level
- `type` (optional): Filter by event type (fetch, extract, validate, fallback, error)

**Example Request**:
```bash
curl -H "X-API-Key: YOUR_ADMIN_API_KEY" \
  "https://your-worker.example.com/admin/logs/events?limit=50&date=2024-01-15&type=error"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "count": 3,
    "total": 3,
    "limit": 50,
    "date": "2024-01-15",
    "logs": [
      {
        "eventId": "1705319040000-fgh567",
        "timestamp": "2024-01-15T10:40:00.000Z",
        "type": "error",
        "status": "failure",
        "details": {
          "message": "Error in database update",
          "error": "Connection timeout"
        }
      }
    ],
    "metadata": {
      "logFile": "logs-2024-01-15.jsonl",
      "size": 1024000,
      "lastModified": "2024-01-15T23:59:00.000Z"
    }
  },
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

### List Log Files

**Endpoint**: `GET /admin/logs/files`

**Authentication**: Required (Admin API key)

**Query Parameters**:
- `limit` (optional, default: 100): Maximum number of files to return

**Example Request**:
```bash
curl -H "X-API-Key: YOUR_ADMIN_API_KEY" \
  "https://your-worker.example.com/admin/logs/files?limit=30"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "count": 15,
    "truncated": false,
    "files": [
      {
        "name": "logs-2024-01-15.jsonl",
        "path": "events/logs-2024-01-15.jsonl",
        "size": 1024000,
        "uploaded": "2024-01-15T23:59:00.000Z",
        "etag": "abc123def456"
      }
    ]
  },
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

### Get Log Statistics

**Endpoint**: `GET /admin/logs/stats`

**Authentication**: Required (Admin API key)

**Example Request**:
```bash
curl -H "X-API-Key: YOUR_ADMIN_API_KEY" \
  "https://your-worker.example.com/admin/logs/stats"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "totalFiles": 30,
    "totalSize": 52428800,
    "oldestLog": "2023-12-16",
    "newestLog": "2024-01-15",
    "filesByDate": {
      "2023-12-16": 1,
      "2023-12-17": 1,
      "2024-01-15": 1
    }
  },
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

## Log Rotation

### Automatic Rotation

Logs are automatically rotated daily. Each day's events are written to a new file named `logs-YYYY-MM-DD.jsonl`. This happens automatically when events are logged using the `writeEventLog` function in `src/engine/logger.ts`.

### Manual Rotation and Cleanup

**Endpoint**: `POST /admin/logs/rotate`

**Authentication**: Required (Admin API key)

**Request Body** (optional):
```json
{
  "retentionDays": 30,
  "archiveDays": 7,
  "performArchive": true
}
```

**Parameters**:
- `retentionDays` (optional, default: 30): Number of days to keep logs before deletion
- `archiveDays` (optional, default: 7): Number of days before archiving logs
- `performArchive` (optional, default: false): Whether to archive old logs before deletion

**Example Request**:
```bash
curl -X POST \
  -H "X-API-Key: YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"retentionDays": 30, "performArchive": true, "archiveDays": 7}' \
  "https://your-worker.example.com/admin/logs/rotate"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "message": "Log rotation completed",
    "retentionDays": 30,
    "expiredFilesFound": 5,
    "deleted": 5,
    "archived": 3,
    "errors": []
  },
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

### Retention Policy

**Default Retention**: 30 days

Log files older than the retention period are automatically deleted during rotation. You can configure this by:

1. Using the `/admin/logs/rotate` endpoint with custom `retentionDays`
2. Setting up a scheduled CRON trigger to run rotation automatically

### Archiving Strategy

Before deletion, logs can be archived to a separate prefix (`events/archive/`) for long-term storage:

1. Logs older than `archiveDays` are moved to `events/archive/`
2. Archived logs are not deleted until they exceed the `retentionDays` period
3. This allows you to keep recent logs easily accessible while archiving older ones

## Monitoring and Status

### System Status

**Endpoint**: `GET /admin/status`

**Authentication**: Required (Admin API key)

**Example Request**:
```bash
curl -H "X-API-Key: YOUR_ADMIN_API_KEY" \
  "https://your-worker.example.com/admin/status"
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2024-01-15T12:00:00.000Z",
    "services": {
      "database": true
    },
    "database": {
      "available": true,
      "version": "v1.2.3",
      "recordCount": 50000,
      "lastUpdated": "2024-01-15T10:00:00.000Z"
    },
    "storage": {
      "r2Available": true,
      "kvAvailable": true
    },
    "logs": {
      "eventsLogged": true,
      "lastLogFile": "logs-2024-01-15.jsonl"
    }
  },
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

### System Metadata

**Endpoint**: `GET /admin/metadata`

**Authentication**: Required (Admin API key)

Provides detailed metadata about the database and system state.

### Diff History

**Endpoint**: `GET /admin/diffs`

**Authentication**: Required (Admin API key)

**Query Parameters**:
- `limit` (optional, default: 10): Maximum number of diff reports to return

View historical diff reports showing changes between data updates.

## Error Handling and Recovery

### Error Detection

Errors are automatically logged to R2 with full context:

1. **Event ID**: Unique identifier for tracking
2. **Timestamp**: When the error occurred
3. **Error Message**: Human-readable description
4. **Stack Trace**: Full stack trace for debugging
5. **Context**: Additional metadata about the operation

### Fallback Mechanism

When data validation fails, the system automatically falls back to the last known good data:

1. **Detection**: Validation fails (schema mismatch, hash mismatch, etc.)
2. **Fallback**: System retrieves last good data from R2
3. **Logging**: Fallback event is logged with reason
4. **Warning**: Response includes warning about fallback usage
5. **Recovery**: Next successful update replaces fallback data

### Recovery Procedures

#### 1. View Recent Errors

```bash
curl -H "X-API-Key: YOUR_ADMIN_API_KEY" \
  "https://your-worker.example.com/admin/logs/events?type=error&limit=20"
```

#### 2. Check Fallback Status

```bash
curl -H "X-API-Key: YOUR_ADMIN_API_KEY" \
  "https://your-worker.example.com/admin/metadata"
```

#### 3. Manual Update Trigger

If automatic updates fail, trigger a manual update:

```bash
curl -X POST \
  -H "X-API-Key: YOUR_ADMIN_API_KEY" \
  "https://your-worker.example.com/admin/fetch"
```

#### 4. Rollback to Previous Version

If new data causes issues, rollback to a previous version:

```bash
curl -X POST \
  -H "X-API-Key: YOUR_ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"version": "v1.2.2"}' \
  "https://your-worker.example.com/admin/rollback"
```

#### 5. Check System Status

After recovery, verify system health:

```bash
curl -H "X-API-Key: YOUR_ADMIN_API_KEY" \
  "https://your-worker.example.com/admin/status"
```

## Best Practices

### 1. Regular Monitoring

- Check `/admin/status` daily or set up automated monitoring
- Review error logs weekly: `/admin/logs/events?type=error`
- Monitor diff reports to understand data changes: `/admin/diffs`

### 2. Log Retention

- Keep at least 30 days of logs for troubleshooting
- Archive logs older than 7 days for long-term storage
- Run rotation weekly or monthly depending on volume

### 3. Alert Configuration

Set up alerts for:
- System status changes from "healthy" to "degraded"
- Multiple consecutive error events
- Fallback activation
- Failed database updates

### 4. Backup and Recovery

- Database snapshots are automatically created on updates
- R2 stores fallback data for recovery
- Test rollback procedures regularly

### 5. Security

- Protect admin API keys
- Use HTTPS for all API requests
- Rotate API keys periodically
- Audit admin endpoint access logs

## Troubleshooting

### No Logs Appearing

**Problem**: Event logs endpoint returns empty results

**Solution**:
1. Check R2 bucket configuration in `wrangler.toml`
2. Verify `DATA_EXPORTS` binding is set up
3. Check R2 bucket permissions
4. Trigger a manual update to generate logs: `POST /admin/fetch`

### High Log Volume

**Problem**: Log files growing too large

**Solution**:
1. Reduce log retention period
2. Run rotation more frequently
3. Enable archiving: `POST /admin/logs/rotate` with `performArchive: true`
4. Consider filtering logs by level in production

### Missing Events

**Problem**: Some events not appearing in logs

**Solution**:
1. Check for R2 write errors in console logs
2. Verify network connectivity to R2
3. Check R2 storage limits and quotas
4. Review error logs: `/admin/logs/events?type=error`

### Slow Log Retrieval

**Problem**: Log endpoints responding slowly

**Solution**:
1. Reduce `limit` parameter in requests
2. Use date filtering to access specific days
3. Consider implementing log aggregation
4. Archive old logs to reduce active log size

### Failed Rotation

**Problem**: Log rotation fails with errors

**Solution**:
1. Check R2 bucket permissions (delete and write)
2. Review rotation errors in response
3. Manually delete old files if needed
4. Verify retention configuration is reasonable

### Fallback Loop

**Problem**: System repeatedly falling back to old data

**Solution**:
1. Check recent error logs: `/admin/logs/events?type=error`
2. Review validation failures in logs
3. Verify data source is accessible
4. Check schema configuration in CONFIG_KV
5. Manually trigger fetch with validation skip if needed (temporary)

## Additional Resources

- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture overview
- [README.md](../README.md) - General documentation
- [API Documentation](../README.md#api-endpoints) - Complete API reference
- [Configuration Guide](../README.md#configuration) - Configuration options
