/**
 * Service Worker - Basic PWA functionality
 *
 * Provides:
 * - App shell caching for offline capability
 * - Static asset caching
 * - Network-first strategy for API calls
 *
 * Note: This is a basic service worker. For production,
 * consider using Workbox for more advanced features.
 */

const CACHE_NAME = 'simulator-v1';
const STATIC_CACHE_NAME = 'simulator-static-v1';

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  // Add critical CSS/JS paths here after build
];

// Assets to cache on first request
const RUNTIME_CACHE_PATTERNS = [
  /\.(js|css|woff2|woff|ttf)$/,
  /\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
];

// Install event - precache critical assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Precaching app shell');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extension requests
  if (url.protocol === 'chrome-extension:') return;

  // Skip cross-origin requests except for CDN assets
  if (url.origin !== self.location.origin) {
    // Allow caching for known CDN domains
    const allowedOrigins = [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
    ];
    if (!allowedOrigins.some((origin) => url.hostname.includes(origin))) {
      return;
    }
  }

  // API calls - network first, no cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({ error: 'Offline' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      })
    );
    return;
  }

  // Static assets - cache first, then network
  const isStaticAsset = RUNTIME_CACHE_PATTERNS.some((pattern) =>
    pattern.test(url.pathname)
  );

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached, but also update cache in background
          event.waitUntil(
            fetch(request).then((networkResponse) => {
              if (networkResponse.ok) {
                caches.open(STATIC_CACHE_NAME).then((cache) => {
                  cache.put(request, networkResponse);
                });
              }
            }).catch(() => {})
          );
          return cachedResponse;
        }

        // Not in cache - fetch and cache
        return fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML pages - network first with cache fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          // Cache successful responses
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback to cached page or offline page
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/');
          });
        })
    );
    return;
  }

  // Default - try network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
