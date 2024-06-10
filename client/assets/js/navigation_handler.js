function handleBrowserNav() {
    history.pushState(null, document.title, location.href);
    window.addEventListener("popstate", function(e) {
        this.alert("For security reasons, going back with the browser has been disabled. Use the controls on the page.");
        this.history.pushState(null, document.title, location.href);
    });
}