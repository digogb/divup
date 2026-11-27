const CACHE_NAME = 'divup-v24';
const urlsToCache = [
    '/',
    '/index.html',
    '/css/styles.css?v=24',
    '/js/app.js?v=24',
    '/js/api.js?v=24',
    '/js/components.js?v=24',
    '/js/theme.js?v=24',
    '/assets/icons/icon-192.png?v=24',
    '/assets/icons/icon.svg?v=24'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(err => console.log('Cache failed:', err))
    );
    self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', event => {
    // API e área de admin: sempre da rede, nunca em cache
    const { pathname } = new URL(event.request.url);
    if (pathname.startsWith('/api/') || pathname === '/admin' || pathname.includes('/admin.')) {
        return;
    }
    
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Clone the response
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, responseClone);
                    });
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
