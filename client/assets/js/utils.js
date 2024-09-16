function handleBrowserNav() {
    history.pushState(null, document.title, location.href);
    window.addEventListener("popstate", function(e) {
        this.alert("For security reasons, going back with the browser has been disabled. Use the controls on the page.");
        this.history.pushState(null, document.title, location.href);
    });
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

function returnHome() {
    window.location.href = "../index.html";
}

function getUserSettings() {
    $.ajax({
        type: 'POST',
        url: 'http://34.224.145.158:8000/getUserSettings',
        data: JSON.stringify({ uuidSessionToken: sessionStorage.getItem('SimpleSession') }),
        contentType: 'application/json',
        success: function (results) {
            if (results.user_settings != undefined) {
            var userSettingsArray = results.user_settings;
            for (var i = 0; i < userSettingsArray.length; i++) {
                var currentKey = Object.keys(userSettingsArray[i])[0];
                var currentValue = userSettingsArray[i][currentKey];

                switch (currentKey) {
                case "theme":
                    if (currentValue != $('html').attr('data-bs-theme')) {
                    $('html').attr('data-bs-theme', currentValue);
                    }
                    break;
                default:
                    console.warn("Unrecognized setting key " + currentKey + "!");
                    break;
                }
            }
            }
        }
    });
}