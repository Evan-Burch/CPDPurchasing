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

// Function for input validation on client-side
// Checks that required input fields are not empty/default values 
function validateInput() {
    const reqs = document.querySelectorAll('.req');

    reqs.forEach((e) => {
        if (e.value === '') {
            e.classList.add('invalid');
        }
        else if (e.className.includes('form-select') && e.options[0].selected) {
            e.classList.add('invalid');
        }
        else {
            e.classList.remove('invalid');
        }
    });
}