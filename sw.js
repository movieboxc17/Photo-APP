const CACHE_NAME = 'pawshot-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-128x128.png',
  '/icons/icon-144x144.png',
  '/icons/icon-152x152.png',
  '/icons/icon-192x192.png',
  '/icons/icon-384x384.png',
  '/icons/icon-512x512.png',
  '/sounds/shutter.mp3',
  '/sounds/focus.mp3',
  '/sounds/success.mp3',
  '/sounds/error.mp3',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&display=swap'
];

// Install event - cache app assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app assets');
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        
        // Clone the request - request streams can only be used once
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(response => {
          // Check for valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response - response streams can only be used once
          const responseToCache = response.clone();
          
          // Cache dynamic assets except for camera streams
          if (!event.request.url.includes('blob:')) {
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
          }
          
          return response;
        });
      })
      .catch(error => {
        console.log('Fetch failed:', error);
        // You could return a custom offline page here
      })
  );
});

// Handle push notifications
self.addEventListener('push', event => {
  const title = 'PawShot';
  const options = {
    body: event.data?.text() || 'New PawShot notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png'
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow('/')
  );
});
