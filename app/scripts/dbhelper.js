/**
 * Common database helper functions.
 */
import idb from 'idb';

var dbPromise = idb.open('mws-restaurants', 3, upgradeDb => {
    switch (upgradeDb.oldVersion) {
        case 0:
            upgradeDb.createObjectStore('restaurants', {keyPath: 'id'});
        case 1: {
            const reviewsStore = upgradeDb.createObjectStore('reviews', {keyPath: 'id'});
            reviewsStore.createIndex('restaurant_id', 'restaurant_id');
        }
        case 2:
            upgradeDb.createObjectStore('pending', {
                keyPath: 'id',
                autoIncrement: true
            });
    }
})

class DBHelper {

    /**
     * Database URL.
     * Change this to restaurants.json file location on your server.
     */
    static get DATABASE_URL() {
        const port = 1337 // Change this to your server port
        return `http://localhost:${port}/restaurants`;
    }

    static get DATABASE_URL_REVIEW() {
        const port = 1337 // Change this to your server port
        return `http://localhost:${port}/reviews`;
    }

    /**
     * Fetch all restaurants.
     */
    static fetchRestaurants(callback) {
        fetch(DBHelper.DATABASE_URL)
            .then(response => response.json())
            .then((restaurants) => {
                callback(null, restaurants);
            })
            .catch(e => {
                callback(`Request failed. Returned status of ${e}`, null);
            });
    }

    /**
     * Fetch a restaurant by its ID.
     */
    static fetchRestaurantById(id, callback) {
        fetch(DBHelper.DATABASE_URL + '/' + id)
            .then(response => response.json())
            .then((restaurant) => {
                fetch(DBHelper.DATABASE_URL_REVIEW + '/?restaurant_id=' + id)
                    .then(response => response.json())
                    .then((reviews) => {
                        restaurant.reviews = reviews;
                        callback(null, restaurant);
                    })
                    .catch(e => {
                        callback(null, restaurant);
                    });
            })
            .catch(e => {
                callback('Restaurant does not exist', null);
            });
    }

    /**
     * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
     */
    static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                let results = restaurants;

                if (cuisine !== 'all') { // filter by cuisine
                    results = results.filter(r => r.cuisine_type === cuisine);
                }
                if (neighborhood !== 'all') { // filter by neighborhood
                    results = results.filter(r => r.neighborhood === neighborhood);
                }
                callback(null, results);
            }
        });
    }

    /**
     * Fetch all neighborhoods with proper error handling.
     */
    static fetchNeighborhoods(callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Get all neighborhoods from all restaurants
                const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
                // Remove duplicates from neighborhoods
                const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) === i)
                callback(null, uniqueNeighborhoods);
            }
        });
    }

    /**
     * Fetch all cuisines with proper error handling.
     */
    static fetchCuisines(callback) {
        // Fetch all restaurants
        DBHelper.fetchRestaurants((error, restaurants) => {
            if (error) {
                callback(error, null);
            } else {
                // Get all cuisines from all restaurants
                const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
                // Remove duplicates from cuisines
                const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) === i)
                callback(null, uniqueCuisines);
            }
        });
    }

    /**
     * Restaurant page URL.
     */
    static urlForRestaurant(restaurant) {
        return (`./restaurant.html?id=${restaurant.id}`);
    }

    /**
     * Restaurant image URL.
     */
    static imageUrlForRestaurantSmall(restaurant) {
        return (`/images/${restaurant.photograph}-300_small.jpg`);
    }

    static imageUrlForRestaurantMedium(restaurant) {
        return (`/images/${restaurant.photograph}-600_medium.jpg`);
    }

    static saveReview(id, name, rating, comment, callback) {
        const btn = document.getElementById('button');
        btn.onclick = null;

        const body = {
            restaurant_id: id,
            name: name,
            rating: rating,
            comments: comment,
            createdAt: Date.now()
        }

        console.log('updating reviews database for new review: ', body);

        dbPromise.then(db => {
            const tx = db.transaction('reviews', 'readwrite');
            const store = tx.objectStore('reviews');
            console.log('putting new review into store');
            store.put({
                id: Date.now(),
                'restaurant_id': id,
                data: body
            });
            console.log('new review saved into database!');
        });

        const url = `${DBHelper.DATABASE_URL_REVIEW}`;
        const method = 'POST';
        DBHelper.createPendingRequest(url, method, body);

        callback(null, null);
    }

    static createPendingRequest(url, method, body) {
        console.log('saving to pending database');
        dbPromise.then(db => {
            const tx = db.transaction('pending', 'readwrite');
            tx.objectStore('pending')
                .put({
                    data: {
                        url,
                        method,
                        body
                    }
                })
        }).catch(error => {
        })
            .then(() => {
                console.log('saved to pending database');
                DBHelper.attemptCommitPending(DBHelper.nextPending);
            });
    }

    static nextPending() {
        //iterate over all pending data
        DBHelper.attemptCommitPending(DBHelper.nextPending);
    }

    static attemptCommitPending(callback) {
        console.log('attemptCommitPending')
        let url;
        let method;
        let body;

        dbPromise.then(db => {
            if (!db.objectStoreNames.length) {
                console.log('DB not available');
                db.close();
                return;
            }

            const tx = db.transaction('pending', 'readwrite');
            tx
                .objectStore('pending')
                .openCursor()
                .then(cursor => {
                    if (!cursor) {
                        return;
                    }

                    console.log('cursor', cursor);
                    const value = cursor.value;
                    url = cursor.value.data.url;
                    method = cursor.value.data.method;
                    body = cursor.value.data.body;

                    if ((!url || !method) || (method === 'POST' && !body)) {
                        // bad record so delete it!
                        cursor
                            .delete()
                            .then(callback());
                        return;
                    }
                    ;

                    const properties = {
                        body: JSON.stringify(body),
                        method: method
                    }
                    console.log('sending post from queue: ', properties);
                    console.log('fetching');
                    fetch(url, properties)
                        .then(response => {
                            if (!response.ok && !response.redirected) {
                                console.log('offline');
                                return;
                            }
                        })
                        .then(() => {
                            const tx_pending = db.transaction('pending', 'readwrite');
                            tx_pending.objectStore('pending')
                                .openCursor()
                                .then(cursor => {
                                    cursor
                                        .delete()
                                        .then(() => {
                                            callback();
                                        })
                                })
                            console.log('deleted pending item from queue');
                        })
                })
                .catch(error => {
                    console.log('Error reading cursor');
                    return;
                })
        })
    }

    static handleFavoriteClick(imageId, id, restaurant, newState) {
        // Block any more clicks on this until the callback
        const fav = document.getElementById(imageId + id);
        fav.onclick = null;

        DBHelper.updateFavorite(id, newState, (error, resultObj) => {
            if (error) {
                console.log('Error updating favorite');
                return;
            }
            // Update the button background for the specified favorite
            const favorite = document.getElementById(imageId + resultObj.id);
            if (resultObj.value) {
                favorite.setAttribute('aria-label', 'unselect ' + restaurant.name + ' as favorite');
                favorite.alt = restaurant.name + ' is one of favorites.';
                favorite.style.background = 'url(\'/images/star-yellow.svg\') no-repeat';
            } else {
                favorite.setAttribute('aria-label', 'select ' + restaurant.name + ' as favorite');
                favorite.alt = restaurant.name + ' is not one of favorites.';
                favorite.style.background = 'url(\'/images/star.svg\') no-repeat';
            }
        });
    }

    static updateFavorite(id, newState, callback) {
        const url = `${DBHelper.DATABASE_URL}/${id}/?is_favorite=${newState}`;
        const method = 'PUT';
        DBHelper.updateCachedRestaurant(id, {'is_favorite': newState});
        DBHelper.createPendingRequest(url, method, null);

        callback(null, {id, value: newState});
    }

    static updateCachedRestaurant(id, updateObj) {

        // restaurant
        dbPromise.then(db => {
            var tx = db.transaction('restaurants', 'readwrite');
            tx.objectStore('restaurants')
                .get(id + '')
                .then(value => {
                    if (!value) {
                        console.log('No cached data found');
                        return;
                    }
                    const restaurantObj = value.data;
                    if (!restaurantObj)
                        return;
                    const keys = Object.keys(updateObj);
                    keys.forEach(k => {
                        restaurantObj[k] = updateObj[k];
                    })

                    dbPromise.then(db => {
                        db.transaction('restaurants', 'readwrite')
                            .objectStore('restaurants')
                            .put({id: id + '', data: restaurantObj});
                        return tx.complete;
                    })
                })
        });

        //-1 all restaurants
        dbPromise.then(db => {
            console.log('Getting db transaction');
            var tx = db.transaction('restaurants', 'readwrite');
            tx.objectStore('restaurants')
                .get('-1')
                .then(value => {
                    if (!value) {
                        console.log('No cached data found');
                        return;
                    }
                    const data = value.data;
                    const restaurantArr = data.filter(r => r.id === id);
                    const restaurantObj = restaurantArr[0];

                    if (!restaurantObj)
                        return;
                    const keys = Object.keys(updateObj);
                    keys.forEach(k => {
                        restaurantObj[k] = updateObj[k];
                    })

                    dbPromise.then(db => {
                        db.transaction('restaurants', 'readwrite')
                            .objectStore('restaurants')
                            .put({id: '-1', data: data});
                        return tx.complete;
                    })
                })
        });

    }
}

window.DBHelper = DBHelper;

