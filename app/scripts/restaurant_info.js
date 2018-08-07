let restaurant;
var newMap;

/**
 * Initialize map as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
    // initMap();
    fetchRestaurantFromURL((error, restaurant) => {
        if (error) { // Got an error!
            console.error(error);
        } else {
            fillBreadcrumb();
            initializeMap(restaurant);
        }
    });
});

/**
 * Initialize google static map
 */

function initializeMap(restaurant) {
    let url = 'https://maps.googleapis.com/maps/api/staticmap?center=';

    let mapImg = document.getElementById('map-img');
    if (mapImg == null) {
        let elementById = document.getElementById('map-container');
        mapImg = document.createElement('img');
        mapImg.id = 'map-img';
        elementById.append(mapImg);
    }

    if (restaurant != null) {
        url = url + restaurant.latlng.lat + ',' + restaurant.latlng.lng + '&zoom=12&size=300x600&scale=2&maptype=roadmap';

        let label = restaurant.name.charAt(0);
        url = url + '&markers=color:red%7Clabel:' + label + '%7C' + restaurant.latlng.lat + ',' + restaurant.latlng.lng;
    }

    url = url + '&key=AIzaSyBb39XqJKBTDU7M9zXMctKaazu6pLtCINs';
    mapImg.alt = 'Location of the restaurant shown on map.'
    mapImg.src = url;
}

/**
 * Get current restaurant from page URL.
 */
function fetchRestaurantFromURL(callback) {
    if (self.restaurant) { // restaurant already fetched!
        callback(null, self.restaurant)
        return;
    }
    const id = getParameterByName('id');
    if (!id) { // no id found in URL
        var error = 'No restaurant id in URL';
        callback(error, null);
    } else {
        DBHelper.fetchRestaurantById(id, (error, restaurant) => {
            self.restaurant = restaurant;
            if (!restaurant) {
                console.error(error);
                return;
            }
            fillRestaurantHTML();
            callback(null, restaurant)
        });
    }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
function fillRestaurantHTML(restaurant = self.restaurant) {
    const name = document.getElementById('restaurant-name');
    name.innerHTML = restaurant.name;

    const fav_div = document.getElementById('fav-button-div');
    const fav_button = document.createElement('button');
    fav_button.className = 'fav-icon';
    if (restaurant.is_favorite) {
        fav_button.setAttribute('aria-label', 'unselect ' + restaurant.name + ' as favorite');
        fav_button.alt = restaurant.name + ' is one of favorites.';
        fav_button.style.background = 'url(\'/images/star-yellow.svg\') no-repeat';
    } else {
        fav_button.setAttribute('aria-label', 'select ' + restaurant.name + ' as favorite');
        fav_button.alt = restaurant.name + ' is not one of favorites.';
        fav_button.style.background = 'url(\'/images/star.svg\') no-repeat';
    }
    fav_button.id = 'fav-image-' + restaurant.id;
    fav_button.onclick = event => handleFavoriteClick(restaurant.id, !restaurant.is_favorite);
    fav_div.append(fav_button);

    const address = document.getElementById('restaurant-address');
    address.innerHTML = restaurant.address;

    const image = document.getElementById('restaurant-img');
    image.className = 'restaurant-img';
    image.alt = 'image of ' + restaurant.name;

    var screenWidth = window.innerWidth;
    // console.log(screenWidth);
    if (screenWidth < 500) {
        // Load mobile image
        image.src = DBHelper.imageUrlForRestaurantSmall(restaurant);
    } else if (screenWidth >= 500 && screenWidth <= 800) {
        // tablet image
        image.src = DBHelper.imageUrlForRestaurantMedium(restaurant);
    } else {
        // desktop image
        image.src = DBHelper.imageUrlForRestaurantMedium(restaurant);
    }

    const cuisine = document.getElementById('restaurant-cuisine');
    cuisine.innerHTML = restaurant.cuisine_type;

    // fill operating hours
    if (restaurant.operating_hours) {
        fillRestaurantHoursHTML();
    }
    // fill reviews
    fillReviewsHTML();
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
function fillRestaurantHoursHTML(operatingHours = self.restaurant.operating_hours) {
    const hours = document.getElementById('restaurant-hours');
    for (let key in operatingHours) {
        const row = document.createElement('tr');

        const day = document.createElement('td');
        day.innerHTML = key;
        row.appendChild(day);

        const time = document.createElement('td');
        time.innerHTML = operatingHours[key];
        row.appendChild(time);

        hours.appendChild(row);
    }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
function fillReviewsHTML(reviews = self.restaurant.reviews) {
    const container = document.getElementById('reviews-container');
    if (!reviews) {
        const noReviews = document.createElement('p');
        noReviews.innerHTML = 'No reviews yet!';
        container.appendChild(noReviews);
        return;
    }
    const ul = document.getElementById('reviews-list');
    reviews.forEach(review => {
        ul.appendChild(createReviewHTML(review));
    });
    container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
function createReviewHTML(review) {
    const li = document.createElement('li');

    const div = document.createElement('div');
    div.className = 'review-header';

    const name = document.createElement('p');
    name.className = 'reviewer';
    name.innerHTML = review.name;
    div.appendChild(name);

    const date = document.createElement('p');
    date.className = 'review-date';
    var options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    };
    date.innerHTML = new Date(review.createdAt).toLocaleDateString('en-US', options);
    div.appendChild(date);

    li.appendChild(div);

    const rating = document.createElement('div');
    rating.className = 'rating';
    rating.innerHTML = `RATING: ${review.rating}`;
    li.appendChild(rating);

    const comments = document.createElement('p');
    comments.className = 'comment';
    comments.innerHTML = review.comments;
    li.appendChild(comments);

    return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
function fillBreadcrumb(restaurant = self.restaurant) {
    const breadcrumb = document.getElementById('breadcrumb_ol');
    const li = document.createElement('li');
    li.innerHTML = restaurant.name;
    li.setAttribute('aria-current', 'page');
    breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
function getParameterByName(name, url) {
    if (!url)
        url = window.location.href;
    name = name.replace(/[\[\]]/g, '\\$&');
    const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
        results = regex.exec(url);
    if (!results)
        return null;
    if (!results[2])
        return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

const saveReview = () => {
    // Get the data points for the review
    const name = document.getElementById('name').value;
    const rating = document.getElementById('rating').value;
    const comment = document.getElementById('comment').value;

    console.log('reviewName: ', name);

    DBHelper.saveReview(self.restaurant.id, name, rating, comment, (error, review) => {
        console.log('got saveReview callback');
        if (error) {
            console.log('Error saving review')
        }
        // Update the button onclick event
        const btn = document.getElementById('button');
        btn.onclick = event => saveReview();

        // window.location.href = "/restaurant.html?id=" + self.restaurant.id;
    });

}
const handleFavoriteClick = (id, newState) => {
    // Update properties of the restaurant data object
    console.log('fav-image-' + id);
    const favorite = document.getElementById('fav-image-' + id);
    self.restaurant['is_favorite'] = newState;
    var imageId = 'fav-image-';
    DBHelper.handleFavoriteClick(imageId, id, restaurant, newState);
    favorite.onclick = event => handleFavoriteClick(restaurant.id, !self.restaurant['is_favorite']);
};
