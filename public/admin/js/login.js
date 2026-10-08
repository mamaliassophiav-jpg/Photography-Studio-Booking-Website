"use strict";

const loginForm = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("login-button");
const loginMessage = document.getElementById("login-message");


if (loginForm) {

    loginForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            clearErrors();
            clearMessage();


            const username = usernameInput.value.trim();
            const password = passwordInput.value;


            let valid = true;


            if (!username) {

                showFieldError(
                    "username-error",
                    "Please enter your username."
                );

                valid = false;
            }


            if (!password) {

                showFieldError(
                    "password-error",
                    "Please enter your password."
                );

                valid = false;
            }


            if (!valid) {

                showMessage(
                    "Please enter your username and password.",
                    "error"
                );

                return;
            }


            setLoading(true);


            try {

                const response = await fetch(
                    "/api/admin/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        credentials: "same-origin",

                        body: JSON.stringify({
                            username: username,
                            password: password
                        })
                    }
                );


                let data = {};

                try {
                    data = await response.json();
                } catch (error) {
                    data = {};
                }


                if (!response.ok) {

                    if (response.status === 401) {

                        throw new Error(
                            data.error ||
                            data.message ||
                            "Invalid username or password."
                        );
                    }


                    throw new Error(
                        data.error ||
                        data.message ||
                        "Unable to log in."
                    );
                }


                showMessage(
                    "Login successful. Redirecting...",
                    "success"
                );


                setTimeout(function () {

                    window.location.href =
                        "/admin/dashboard.html";

                }, 500);


            } catch (error) {

                console.error(
                    "Admin login error:",
                    error
                );

                showMessage(
                    error.message ||
                    "Unable to log in. Please try again.",
                    "error"
                );

            } finally {

                setLoading(false);
            }
        }
    );
}


/*
 * Show a field error.
 */
function showFieldError(id, message) {

    const element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent = message;
}


/*
 * Clear field errors.
 */
function clearErrors() {

    document
        .querySelectorAll(".field-error")
        .forEach(function (element) {

            element.textContent = "";

        });
}


/*
 * Show login message.
 */
function showMessage(message, type) {

    if (!loginMessage) {
        return;
    }

    loginMessage.textContent = message;

    loginMessage.className =
        `form-message ${type}`;
}


/*
 * Clear login message.
 */
function clearMessage() {

    if (!loginMessage) {
        return;
    }

    loginMessage.textContent = "";

    loginMessage.className =
        "form-message";
}


/*
 * Loading state.
 */
function setLoading(loading) {

    if (!loginButton) {
        return;
    }

    loginButton.disabled = loading;

    if (loading) {

        loginButton.textContent =
            "Logging in...";

    } else {

        loginButton.textContent =
            "Login";
    }
}