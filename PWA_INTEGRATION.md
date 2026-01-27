# Progressive Web App (PWA) Integration Guide

This guide provides comprehensive instructions for integrating the Ham Radio Callsign Worker API with Progressive Web Applications (PWAs), including offline support, caching strategies, and example implementations.

## Table of Contents

- [Overview](#overview)
- [API Design for PWAs](#api-design-for-pwas)
- [Getting Started](#getting-started)
- [Basic Integration](#basic-integration)
- [Offline Support](#offline-support)
- [Caching Strategies](#caching-strategies)
- [Service Worker Examples](#service-worker-examples)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Best Practices](#best-practices)
- [Complete Example PWA](#complete-example-pwa)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The Ham Radio Callsign Worker API is designed with PWA requirements in mind, providing:

- **RESTful Design**: Standard HTTP methods and predictable endpoints
- **CORS Support**: Cross-origin resource sharing for web applications
- **JSON Responses**: Easy consumption by JavaScript applications
- **Consistent Error Handling**: Predictable error response format
- **Versioned API**: `/api/v1/` prefix for version management
- **Rate Limiting**: Fair usage with clear rate limit headers

### Benefits of PWA Integration

- **Offline Access**: Cache callsign data for offline lookups
- **Fast Performance**: Instant responses from cached data
- **Low Latency**: Edge computing for quick initial loads
- **Progressive Enhancement**: Works on all devices and networks
- **App-Like Experience**: Install as standalone app

## API Design for PWAs

### API Structure

```
https://your-worker.workers.dev/
├── /health              # Health check (no auth required)
├── /version             # API version information
├── /api/v1/
│   ├── /callsign/:id    # Lookup specific callsign
│   ├── /search          # Search callsigns
│   └── /export          # Export data (future)
└── /admin/              # Admin endpoints (auth required)
```

### Response Format

All API responses follow a consistent JSON format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-01-27T00:00:00.000Z"
}
```

**Error Response:**
```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "timestamp": "2026-01-27T00:00:00.000Z"
}
```

## Getting Started

### Prerequisites

- Modern web browser with Service Worker support
- HTTPS (required for Service Workers in production)
- Basic knowledge of JavaScript/TypeScript
- Understanding of PWA concepts

### Quick Start

1. **Create a basic HTML page:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ham Radio Callsign Lookup</title>
  <link rel="manifest" href="/manifest.json">
</head>
<body>
  <h1>Callsign Lookup</h1>
  <input type="text" id="callsign-input" placeholder="Enter callsign (e.g., K1ABC)">
  <button onclick="lookupCallsign()">Search</button>
  <div id="result"></div>

  <script src="/app.js"></script>
</body>
</html>
```

2. **Create manifest.json:**

```json
{
  "name": "Ham Radio Callsign Lookup",
  "short_name": "Callsign Lookup",
  "description": "Look up amateur radio callsigns",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#2196F3",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

3. **Register Service Worker:**

```javascript
// In your main app.js
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(registration => {
      console.log('Service Worker registered:', registration);
    })
    .catch(error => {
      console.error('Service Worker registration failed:', error);
    });
}
```

## Basic Integration

### Fetching Callsign Data

```javascript
const API_BASE = 'https://your-worker.workers.dev';

async function lookupCallsign(callsign) {
  try {
    const response = await fetch(
      `${API_BASE}/api/v1/callsign/${callsign.toUpperCase()}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    } else {
      throw new Error(data.message || 'Unknown error');
    }
  } catch (error) {
    console.error('Callsign lookup failed:', error);
    throw error;
  }
}

// Usage
lookupCallsign('K1ABC')
  .then(result => {
    console.log('Callsign info:', result);
    displayResult(result);
  })
  .catch(error => {
    displayError(error.message);
  });
```

### Search Functionality

```javascript
async function searchCallsigns(query, options = {}) {
  const params = new URLSearchParams({
    q: query,
    limit: options.limit || 10,
  });
  
  try {
    const response = await fetch(
      `${API_BASE}/api/v1/search?${params.toString()}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.success ? data.data.results : [];
  } catch (error) {
    console.error('Search failed:', error);
    return [];
  }
}

// Usage
searchCallsigns('smith', { limit: 20 })
  .then(results => {
    console.log(`Found ${results.length} results`);
    displaySearchResults(results);
  });
```

## Offline Support

### Service Worker Basics

```javascript
// sw.js - Service Worker
const CACHE_NAME = 'callsign-cache-v1';
const API_BASE = 'https://your-worker.workers.dev';

// Install event: Pre-cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        '/',
        '/app.js',
        '/styles.css',
        '/manifest.json',
        '/icon-192.png',
        '/icon-512.png',
      ]);
    })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
  );
});

// Fetch event: Handle requests
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.origin === API_BASE || url.origin.includes('workers.dev')) {
    event.respondWith(handleApiRequest(request));
  } else {
    // Handle static assets
    event.respondWith(handleStaticRequest(request));
  }
});

async function handleApiRequest(request) {
  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful GET requests
    if (request.method === 'GET' && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page or error
    return new Response(
      JSON.stringify({
        error: 'Offline',
        message: 'No network connection and data not cached',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function handleStaticRequest(request) {
  // Cache first strategy for static assets
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  // Not in cache, fetch from network
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    // Return offline fallback
    return new Response('Offline', { status: 503 });
  }
}
```

## Caching Strategies

### 1. Network First, Cache Fallback

Best for dynamic data that should be as fresh as possible:

```javascript
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    return await caches.match(request);
  }
}
```

### 2. Cache First, Network Fallback

Best for static resources and infrequently changing data:

```javascript
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}
```

### 3. Stale While Revalidate

Best for data that can be slightly outdated:

```javascript
async function staleWhileRevalidateStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  const fetchPromise = fetch(request).then(response => {
    const cache = caches.open(CACHE_NAME);
    cache.then(c => c.put(request, response.clone()));
    return response;
  });
  
  return cachedResponse || fetchPromise;
}
```

### 4. Network Only

For admin operations and authenticated requests:

```javascript
async function networkOnlyStrategy(request) {
  return await fetch(request);
}
```

## Service Worker Examples

### Complete Service Worker with All Strategies

```javascript
// sw.js
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const API_CACHE = `api-${CACHE_VERSION}`;
const API_BASE = 'https://your-worker.workers.dev';

// Cache static assets on install
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll([
        '/',
        '/app.js',
        '/styles.css',
        '/offline.html',
      ]);
    })
  );
});

// Clean up old caches on activate
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key.includes('-v') && !key.includes(CACHE_VERSION))
          .map(key => caches.delete(key))
      );
    })
  );
});

// Handle fetch requests
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Determine strategy based on request
  if (url.pathname.startsWith('/api/v1/callsign/')) {
    // Callsign lookups: Network first with cache fallback
    event.respondWith(networkFirst(request, API_CACHE));
  } else if (url.pathname.startsWith('/api/v1/search')) {
    // Search: Stale while revalidate
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
  } else if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) {
    // Other API requests: Network only
    event.respondWith(fetch(request));
  } else {
    // Static assets: Cache first
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || offlineResponse();
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
    return response;
  } catch (error) {
    return offlineResponse();
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);
  
  const fetchPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        const cache = caches.open(cacheName);
        cache.then(c => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => cached);
  
  return cached || fetchPromise;
}

function offlineResponse() {
  return new Response(
    JSON.stringify({
      error: 'Offline',
      message: 'You are offline and this data is not cached',
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
```

## Error Handling

### Comprehensive Error Handling

```javascript
class CallsignAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // Check for rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new Error(`Rate limited. Retry after ${retryAfter} seconds`);
      }

      // Check for other errors
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection.');
      }
      throw error;
    }
  }

  async lookupCallsign(callsign) {
    return this.request(`/api/v1/callsign/${callsign}`);
  }

  async search(query, limit = 10) {
    return this.request(`/api/v1/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  }
}

// Usage with error handling
const api = new CallsignAPI('https://your-worker.workers.dev');

async function handleCallsignLookup(callsign) {
  try {
    const result = await api.lookupCallsign(callsign);
    displayResult(result);
  } catch (error) {
    if (error.message.includes('Rate limited')) {
      showNotification('Too many requests. Please wait.', 'warning');
    } else if (error.message.includes('Network error')) {
      showNotification('No connection. Showing cached data.', 'info');
      displayCachedResult(callsign);
    } else {
      showNotification(`Error: ${error.message}`, 'error');
    }
  }
}
```

## Rate Limiting

### Handling Rate Limits in PWA

```javascript
class RateLimitedAPI {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.requestQueue = [];
    this.processing = false;
  }

  async request(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ endpoint, options, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;
    const { endpoint, options, resolve, reject } = this.requestQueue.shift();

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      
      // Check rate limit headers
      const limit = response.headers.get('X-RateLimit-Limit');
      const remaining = response.headers.get('X-RateLimit-Remaining');
      const reset = response.headers.get('X-RateLimit-Reset');

      if (response.status === 429) {
        // Rate limited, wait and retry
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        console.log(`Rate limited. Retrying in ${retryAfter} seconds`);
        
        setTimeout(() => {
          this.requestQueue.unshift({ endpoint, options, resolve, reject });
          this.processing = false;
          this.processQueue();
        }, retryAfter * 1000);
      } else {
        resolve(await response.json());
        this.processing = false;
        
        // Continue processing queue
        setTimeout(() => this.processQueue(), 100);
      }
    } catch (error) {
      reject(error);
      this.processing = false;
      this.processQueue();
    }
  }
}
```

## Best Practices

### 1. Use Background Sync

```javascript
// Register background sync
if ('sync' in self.registration) {
  self.registration.sync.register('sync-searches');
}

// In service worker
self.addEventListener('sync', event => {
  if (event.tag === 'sync-searches') {
    event.waitUntil(syncSearchHistory());
  }
});

async function syncSearchHistory() {
  const searches = await getOfflineSearches();
  for (const search of searches) {
    try {
      await fetch(`${API_BASE}/api/v1/search?q=${search.query}`);
      await markSearchSynced(search.id);
    } catch (error) {
      console.error('Failed to sync search:', error);
    }
  }
}
```

### 2. Implement Offline Indicator

```javascript
// Check online/offline status
function updateOnlineStatus() {
  const isOnline = navigator.onLine;
  const indicator = document.getElementById('status-indicator');
  
  if (isOnline) {
    indicator.textContent = 'Online';
    indicator.className = 'status-online';
  } else {
    indicator.textContent = 'Offline';
    indicator.className = 'status-offline';
  }
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
updateOnlineStatus();
```

### 3. Cache Management

```javascript
// Limit cache size
async function limitCacheSize(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    // Remove oldest entries
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map(key => cache.delete(key)));
  }
}

// Call periodically or on service worker activate
self.addEventListener('activate', event => {
  event.waitUntil(limitCacheSize(API_CACHE, 100));
});
```

### 4. Prefetch Popular Data

```javascript
// Prefetch popular callsigns
async function prefetchPopular() {
  const popular = ['K1ABC', 'W2XYZ', 'N3QED']; // From analytics
  const cache = await caches.open(API_CACHE);
  
  for (const callsign of popular) {
    const url = `${API_BASE}/api/v1/callsign/${callsign}`;
    try {
      const response = await fetch(url);
      if (response.ok) {
        cache.put(url, response);
      }
    } catch (error) {
      console.error(`Failed to prefetch ${callsign}`);
    }
  }
}

// Prefetch during idle time
if ('requestIdleCallback' in window) {
  requestIdleCallback(prefetchPopular);
}
```

## Complete Example PWA

See the `examples/pwa` directory for a complete working PWA implementation including:

- Full HTML/CSS/JS application
- Advanced service worker with multiple caching strategies
- Offline support and sync
- Rate limit handling
- Error recovery
- Installation prompt
- Push notifications (optional)

## Deployment

### Hosting Options

1. **Cloudflare Pages**: Seamless integration with Workers
2. **GitHub Pages**: Free static hosting
3. **Netlify**: Easy deployment with CI/CD
4. **Vercel**: Modern web hosting platform

### Deploy to Cloudflare Pages

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler pages publish ./dist
```

### HTTPS Requirement

PWAs require HTTPS in production. Most hosting platforms provide this automatically.

For local development:
```bash
# Use Wrangler dev (includes HTTPS)
npm run dev

# Or use a local HTTPS proxy
npx local-ssl-proxy --source 3001 --target 3000
```

## Troubleshooting

### Service Worker Not Registering

**Problem**: Service worker fails to register

**Solutions**:
- Verify HTTPS (required except on localhost)
- Check browser console for errors
- Ensure sw.js is at root of domain
- Clear browser cache and re-register

### Cache Not Working

**Problem**: Responses not cached

**Solutions**:
- Verify cache names match
- Check service worker is active
- Verify fetch events are being intercepted
- Check DevTools > Application > Cache Storage

### Offline Mode Not Working

**Problem**: App doesn't work offline

**Solutions**:
- Verify service worker caching strategies
- Check that all required assets are cached
- Test in DevTools offline mode
- Verify fallback responses are correct

### Rate Limits Exceeded

**Problem**: Too many 429 responses

**Solutions**:
- Implement request queuing
- Add exponential backoff
- Cache more aggressively
- Batch requests when possible

## Resources

- [MDN PWA Guide](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox](https://developers.google.com/web/tools/workbox) - PWA library by Google
- [PWA Builder](https://www.pwabuilder.com/) - PWA development tool

## Support

For questions or issues with PWA integration:
- Open an issue on GitHub
- Check existing documentation
- Review example PWA implementation

## Contributing

Contributions to improve PWA integration are welcome! Please see CONTRIBUTING.md for guidelines.
