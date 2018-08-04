import idb from 'idb';

const PRECACHE = 'precache-v1';
const RUNTIME = 'runtime';

// A list of local resources we always want to be cached.
const PRECACHE_URLS = [
    '/index.html',
    '/restaurant.html',
    '/', // Alias for index.html
    '/styles/styles.css',
    '/scripts/main.js',
    '/scripts/dbhelper.js',
    '/scripts/restaurant_info.js'
];

var dbPromise = idb.open('mws-restaurants', 3, upgradeDb => {
    switch (upgradeDb.oldVersion) {
        case 0:
            upgradeDb.createObjectStore("restaurants", { keyPath: "id" });
        case 1:
            {
                const reviewsStore = upgradeDb.createObjectStore("reviews", { keyPath: "id" });
                reviewsStore.createIndex("restaurant_id", "restaurant_id");
            }
        case 2:
            upgradeDb.createObjectStore("pendingReviews", {
                keyPath: "id",
                autoIncrement: true
            });
    }
})

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

    if (requestUrl.port === "1337") {
        console.log('requestUrl: ' + requestUrl);

        if (event.request.method !== "GET") {
            return fetch(event.request)
                .then(fetchResponse => fetchResponse.json())
                .then(json => {
                    return json
                });
        }

        if (requestUrl.pathname.indexOf("reviews") !== -1) {
            const parts = requestUrl.pathname.split("/");
            const restaurant_id = parts[parts.length - 1] === "reviews" ? "-1" : requestUrl.searchParams.get("restaurant_id");
            console.log('restaurant_id: ' + restaurant_id);
            event.respondWith(
                dbPromise.then(db => {
                    var tx = db.transaction('reviews');
                    var reviewsStore = tx.objectStore('reviews');
                    return reviewsStore.index("restaurant_id").getAll(restaurant_id);
                }).then(data => {
                    console.log("data(" + restaurant_id + "): " + data);
                    if (data !== null && data.length > 0) {
                        console.log("data from database: " + data);
                        const mapResponse = data.map(review => review.data);
                        return mapResponse;
                    }
                    else {
                        return fetch(event.request)
                            .then(fetchResponse => fetchResponse.json())
                            .then(json => {
                                console.log(json);
                                return dbPromise.then(db => {

                                    const tx = db.transaction("reviews", "readwrite");
                                    var reviewsStore = tx.objectStore('reviews');

                                    var i;
                                    for (i = 0; i < json.length; i++) {
                                        reviewsStore.put({
                                            id: json[i].id + "",
                                            restaurant_id: json[i]["restaurant_id"],
                                            data: json[i]
                                        });
                                    }

                                    return json;
                                });
                            });
                    }
                }).then(finalResponse => {
                    console.log("final response: " + finalResponse)
                    return new Response(JSON.stringify(finalResponse));
                }).catch(error => {
                    console.log("error: " + error);
                    return new Response("Error fetching data", { status: 500 });
                }));
        } else {
            const parts = requestUrl.pathname.split("/");
            const id = parts[parts.length - 1] === "restaurants" ? "-1" : parts[parts.length - 1];
            // console.log('id: ' + id);
            event.respondWith(
                dbPromise.then(db => {
                    var tx = db.transaction('restaurants');
                    var restaurantsStore = tx.objectStore('restaurants');
                    return restaurantsStore.get(id);
                }).then(data => {
                    console.log("data(" + id + "): " + data);
                    return ((data && data.data) || fetch(event.request)
                        .then(fetchResponse => fetchResponse.json())
                        .then(json => {
                            console.log(json);
                            return dbPromise.then(db => {

                                const tx = db.transaction("restaurants", "readwrite");
                                var restaurantsStore = tx.objectStore('restaurants');
                                restaurantsStore.put({
                                    id: id,
                                    data: json
                                });
                                if (id == -1) {
                                    var i;
                                    for (i = 0; i < json.length; i++) {
                                        restaurantsStore.put({
                                            id: json[i].id + "",
                                            data: json[i]
                                        });
                                    }
                                }
                                return json;
                            });
                        })
                    );
                }).then(finalResponse => {
                    return new Response(JSON.stringify(finalResponse));
                }).catch(error => {
                    return new Response("Error fetching data", { status: 500 });
                }));
        }

    } else {
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
    }

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