if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('../sw.js', { scope: '/' })
		.then(reg => {
			console.log("Service worker registration successful: " + reg.scope);
		})
		.catch(error => {
			console.log("Registration failed: " + error)
		})
}

import idb from 'idb';
// Names of the two caches used in this version of the service worker.
// Change to v2, etc. when you update any of the local resources, which will
// in turn trigger the install event again.
const PRECACHE = 'precache-v1';
const RUNTIME = 'runtime';

// A list of local resources we always want to be cached.
const PRECACHE_URLS = [
    '/index.html',
    '/restaurant.html',
    '/', // Alias for index.html
    '/css/styles.css',
    '/images/',
    '/js/main.js',
    '/js/dbhelper.js',
    '/js/restaurant_info.js'
];

// The install handler takes care of precaching the resources we always need.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(PRECACHE)
            .then(cache => cache.addAll(PRECACHE_URLS))
            .then(self.skipWaiting())
    );
});

// The activate handler takes care of cleaning up old caches.
self.addEventListener('activate', event => {
    const currentCaches = [PRECACHE, RUNTIME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return cacheNames.filter(cacheName => !currentCaches.includes(cacheName));
        }).then(cachesToDelete => {
            return Promise.all(cachesToDelete.map(cacheToDelete => {
                return caches.delete(cacheToDelete);
            }));
        }).then(() => self.clients.claim())
    );
});

// The fetch handler serves responses for same-origin resources from a cache.
// If no response is found, it populates the runtime cache with the response
// from the network before returning it to the page.
self.addEventListener('fetch', event => {
    var requestUrl = new URL(event.request.url);

    if (requestUrl.origin === location.origin) {
        if (requestUrl.pathname === '/') {
            event.respondWith(caches.match('/index.html'))
            return;
        }
        if (requestUrl.pathname.startsWith('/images/')) {
            event.respondWith(servePhoto(event.request))
            return;
        }
        if (requestUrl.pathname.startsWith('/restaurant.html')) {
            event.respondWith(caches.match('/restaurant.html'))
            return;
        }
    }

    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    )
});

function servePhoto(request) {
    var storageUrl = request.url.replace(/-\d+px\.jpg$/, '');

    return caches.open(PRECACHE).then(cache => {
        return cache.match(storageUrl).then(response => {
            if (response) return response;

            return fetch(request).then(networkResponse => {
                cache.put(storageUrl, networkResponse.clone());
                return networkResponse;
            });
        });
    });
}