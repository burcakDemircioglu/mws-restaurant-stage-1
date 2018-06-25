if ('serviceWorker' in navigator) {
	navigator.serviceWorker.register('js/sw.js')
		.then(reg => {
			console.log("Service worker registration successful: " + reg.scope);
		})
		.catch(error => {
			console.log("Registration failed: " + error)
		})
}

// document.querySelector('#show').addEventListener('click', () => {
// 	const iconUrl = document.querySelector('select').selectedOptions[0].value;
// 	let imgElement = document.createElement('img');
// 	imgElement.src = iconUrl;
// 	document.querySelector('#container').appendChild(imgElement);
// });