import swal from 'sweetalert2';
window.swal = swal;

function handleBrowserNav() {
    history.pushState(null, document.title, location.href);
    window.addEventListener("popstate", function (e) {
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

function returnHome(referrer, goBack) {
    window.location.href = ((goBack) ? "../" : "") + "index.html?table=" + referrer;
}

function getUserSettings() {
    $.ajax({
        type: 'POST',
        url: `${apiCall}/getUserSettings`,
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

// Variables for automatic logout
var swalTimeout = Swal.mixin({
    showCancelButton: false,
    showConfirmButton: false,
    width: '300px'
});
var warningTimer;
var idleMax = 10; // 10 minutes of inactivity
var idleCur = 0;
var expireTime = 1000*60*5; // last 5 minutes

function timerInc() { // Checks idle timeout and sends to idle warning after 5 minutes
    idleCur += 1;
    if (idleCur == 5) {
        idleWarning();
    }
}

function idleWarning() { // Idle warning - starts countdown of last 5 minutes
    let remainTime = expireTime;

    swalTimeout.fire({
        icon: 'warning',
        title: 'Uh Oh!',
        text: 'LOGGING USER OUT IN ' + remainTime / (1000*60) + ' MINUTES'
    });

    function updateCountdown() { // Update displayed time on card
        remainTime -= 1000;
        var minutes = Math.floor(remainTime / (1000*60)) + 1;

        swalTimeout.update({
            text: 'LOGGING USER OUT IN ' + minutes + ' MINUTES'
        });

        if (remainTime <= 0) {
            clearTimeout(warningTimer);
            idleTimeout();
        }
    }

    warningTimer = setInterval(updateCountdown, 1000);
}

function idleTimeout() { // Auto logs out users after 2 seconds
    console.log('AUTO LOGGED OUT USER');
    setTimeout(() => {
        $.ajax({
            type: 'DELETE',
            url: `${apiCall}/logout`,
            data: JSON.stringify({ uuidSessionToken: sessionStorage.getItem('SimpleSession') }),
            contentType: 'application/json',
            success: function (results) {
                sessionStorage.removeItem('SimpleSession');
                sessionStorage.removeItem('userID');
                window.location.href = "./pages/login.html";
            }
        });
    }, 1000*2);
}