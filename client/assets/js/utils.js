function handleBrowserNav() {
    history.pushState(null, document.title, location.href);
    window.addEventListener("popstate", function(e) {
        this.alert("For security reasons, going back with the browser has been disabled. Use the controls on the page.");
        this.history.pushState(null, document.title, location.href);
    });
}

function cacheJSON(key, json) {
    localStorage.setItem(key, JSON.stringify(json));
}

function recallJSON(key) {
    return localStorage.getItem(key);
}