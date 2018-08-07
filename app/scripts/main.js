let restaurants,
    neighborhoods,
    cuisines
var newMap
var markers = []


/**
 * Fetch all neighborhoods and set their HTML.
 */
function fetchNeighborhoods() {
    DBHelper.fetchNeighborhoods((error, neighborhoods) => {
        if (error) { // Got an error
            console.error(error);
        } else {
            self.neighborhoods = neighborhoods;
            fillNeighborhoodsHTML();
        }
    });
}

/**
 * Set neighborhoods HTML.
 */
function fillNeighborhoodsHTML(neighborhoods = self.neighborhoods) {
    const select = document.getElementById('neighborhoods-select');
    neighborhoods.forEach(neighborhood => {
        const option = document.createElement('option');
        option.innerHTML = neighborhood;
        option.value = neighborhood;
        select.append(option);
    });
}

/**
 * Fetch all cuisines and set their HTML.
 */
function fetchCuisines() {
    DBHelper.fetchCuisines((error, cuisines) => {
        if (error) { // Got an error!
            console.error(error);
        } else {
            self.cuisines = cuisines;
            fillCuisinesHTML();
        }
    });
}

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
    fetchNeighborhoods();
    fetchCuisines();
    updateRestaurants();
});

/**
 * Set cuisines HTML.
 */
function fillCuisinesHTML(cuisines = self.cuisines) {
    const select = document.getElementById('cuisines-select');

    cuisines.forEach(cuisine => {
        const option = document.createElement('option');
        option.innerHTML = cuisine;
        option.value = cuisine;
        select.append(option);
    });
}

/**
 * Initialize google static map, called from HTML.
 */

function initializeMap(restaurants) {
    let url = 'https://maps.googleapis.com/maps/api/staticmap?center=40.715216,-73.987501&zoom=12&size=600x350&scale=2&maptype=roadmap';


    let mapImg = document.getElementById('map-img');
    if (mapImg == null) {
        let elementById = document.getElementById('map-container');
        mapImg = document.createElement('img');
        mapImg.id = 'map-img';
        elementById.append(mapImg);
    }

    if (restaurants != null) {

        restaurants.forEach(restaurant => {
            let label = restaurant.name.charAt(0);
            url = url + '&markers=color:red%7Clabel:' + label + '%7C' + restaurant.latlng.lat + ',' + restaurant.latlng.lng;
        });
    }


    url = url + '&key=AIzaSyBb39XqJKBTDU7M9zXMctKaazu6pLtCINs';
    mapImg.alt = 'Location of the restaurants shown on map.'
    mapImg.src = url;
}

/**
 * Update page and map for current restaurants.
 */
function updateRestaurants() {
    const cSelect = document.getElementById('cuisines-select');
    const nSelect = document.getElementById('neighborhoods-select');

    const cIndex = cSelect.selectedIndex;
    const nIndex = nSelect.selectedIndex;

    const cuisine = cSelect[cIndex].value;
    const neighborhood = nSelect[nIndex].value;

    DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
        if (error) { // Got an error!
            console.error(error);
        } else {
            resetRestaurants(restaurants);
            fillRestaurantsHTML();
            initializeMap(restaurants);
        }
    })
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
function resetRestaurants(restaurants) {
    // Remove all restaurants
    self.restaurants = [];
    const ul = document.getElementById('restaurants-list');
    ul.innerHTML = '';

    // Remove all map markers
    self.markers.forEach(m => m.setMap(null));
    self.markers = [];
    self.restaurants = restaurants;
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
function fillRestaurantsHTML(restaurants = self.restaurants) {
    const ul = document.getElementById('restaurants-list');
    restaurants.forEach(restaurant => {
        ul.append(createRestaurantHTML(restaurant));
    });
}

/**
 * Create restaurant HTML.
 */
function createRestaurantHTML(restaurant) {
    const li = document.createElement('li');

    const image = document.createElement('img');
    image.className = 'restaurant-img';
    image.alt = 'An image of ' + restaurant.name + '.';
    image.src = DBHelper.imageUrlForRestaurantSmall(restaurant);
    li.append(image);


    const name = document.createElement('h3');
    name.innerHTML = restaurant.name;
    li.append(name);

    const fav_button = document.createElement('button');
    fav_button.setAttribute('aria-label', 'select' + restaurant.name + ' as favorite');
    fav_button.className = 'fav-icon';
    fav_button.text = 'fav';
    // fav_image.style('background-color', "red");
    if (restaurant.is_favorite) {
        fav_button.setAttribute('aria-label', 'unselect ' + restaurant.name + ' as favorite');
        fav_button.alt = restaurant.name + ' is one of favorites.';
        fav_button.style.background = 'url(\'/images/star-yellow.svg\') no-repeat';
    } else {
        fav_button.setAttribute('aria-label', 'select ' + restaurant.name + ' as favorite');
        fav_button.alt = restaurant.name + ' is not one of favorites.';
        fav_button.style.background = 'url(\'/images/star.svg\') no-repeat';
    }
    fav_button.id = 'list-fav-image-' + restaurant.id;
    li.append(fav_button);
    fav_button.onclick = event => handleFavoriteClick(restaurant, !restaurant.is_favorite);

    const neighborhood = document.createElement('p');
    neighborhood.innerHTML = restaurant.neighborhood;
    li.append(neighborhood);

    const address = document.createElement('p');
    address.innerHTML = restaurant.address;
    li.append(address);


    const more = document.createElement('button');
    more.className = 'detailsButton';
    more.innerHTML = 'View Details';
    more.setAttribute('aria-label', restaurant.name + ' Restaurant View Details');

    more.onclick = function () {
        const url = DBHelper.urlForRestaurant(restaurant);
        window.location = url;
    }
    li.append(more)

    return li
}

const handleFavoriteClick = (restaurant, newState) => {
    // Update properties of the restaurant data object
    const favorite = document.getElementById('list-fav-image-' + restaurant.id);
    restaurant['is_favorite'] = newState;
    var imageId = 'list-fav-image-';
    DBHelper.handleFavoriteClick(imageId, restaurant.id, restaurant, newState);
    favorite.onclick = event => handleFavoriteClick(restaurant, !restaurant['is_favorite']);
};

