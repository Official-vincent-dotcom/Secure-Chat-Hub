const CACHE_NAME = 'secure-chat-hub-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/main.js',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Opened cache');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  // Skip API requests - always go to network
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }

  // For other requests, try cache first
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((response) => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    }).catch(() => {
      return caches.match('/index.html');
    })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Secure Chat Hub';
  const options = {
    body: data.body || 'New message',
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 192 192%22><rect fill=%22%232563eb%22 width=%22192%22 height=%22192%22/><text x=%2250%25%22 y=%2250%25%22 font-size=%2280%22 font-weight=%22bold%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22white%22>🔐</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 192 192%22><rect fill=%22%232563eb%22 width=%22192%22 height=%22192%22/><text x=%2250%25%22 y=%2250%25%22 font-size=%2280%22 font-weight=%22bold%22 text-anchor=%22middle%22 dominant-baseline=%22middle%22 fill=%22white%22>🔐</text></svg>',
    tag: data.roomId || 'message',
    requireInteraction: false,
    data: {
      roomId: data.roomId,
      senderId: data.senderId,
      timestamp: new Date()
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data;

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if a window with the target URL is already open
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(`/?room=${data.roomId}`);
      }
    })
  );
});

// Background sync for offline messages
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(
      fetch('/api/sync-messages')
        .then((response) => response.json())
        .then((data) => {
          // Notify clients of synced messages
          return self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: 'SYNC_COMPLETE',
                data: data
              });
            });
          });
        })
        .catch((error) => {
          console.error('Sync failed:', error);
        })
    );
  }
});

console.log('Service Worker registered');
