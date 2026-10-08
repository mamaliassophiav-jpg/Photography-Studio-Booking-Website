"use strict";

const serviceSelect = document.getElementById("service");
const timeSlotsContainer = document.getElementById("time-slots");
const bookingForm = document.getElementById("booking-form");

const dateInput = document.getElementById("booking-date");
const guestsInput = document.getElementById("guests");
const nameInput = document.getElementById("name");
const contactInput = document.getElementById("contact");
const emailInput = document.getElementById("email");
const notesInput = document.getElementById("notes");

const submitButton = document.getElementById("submit-button");
const formMessage = document.getElementById("form-message");

let selectedTime = "";
let services = [];


document.addEventListener("DOMContentLoaded", function () {
    setMinimumDate();
    renderTimeSlots();
    loadServices();
});


/*
 * Set today's date as the minimum selectable date.
 */
function setMinimumDate() {
    if (!dateInput) {
        return;
    }

    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    dateInput.min = `${year}-${month}-${day}`;
}


/*
 * Load active services from the backend.
 */
async function loadServices() {
    if (!serviceSelect) {
        console.error("Service select element was not found.");
        return;
    }

    try {
        serviceSelect.disabled = true;

        serviceSelect.innerHTML =
            "<option value=\"\">Loading services...</option>";

        const response = await fetch("/api/services");

        let data;

        try {
            data = await response.json();
        } catch (error) {
            throw new Error("The server returned an invalid response.");
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                data.message ||
                "Unable to load photography services."
            );
        }

        /*
         * The API normally returns an array.
         * This also supports { services: [...] } just in case.
         */
        if (Array.isArray(data)) {
            services = data;
        } else if (Array.isArray(data.services)) {
            services = data.services;
        } else {
            services = [];
        }

        serviceSelect.innerHTML = "";

        if (services.length === 0) {
            serviceSelect.innerHTML =
                "<option value=\"\">No services available</option>";

            serviceSelect.disabled = true;

            showMessage(
                "There are currently no photography services available.",
                "error"
            );

            return;
        }

        const defaultOption = document.createElement("option");

        defaultOption.value = "";
        defaultOption.textContent =
            "Select a photography service";

        serviceSelect.appendChild(defaultOption);


        services.forEach(function (service) {

            const option = document.createElement("option");

            option.value = service.id;

            option.textContent =
                `${service.name} - ${formatPrice(service.price)}`;

            serviceSelect.appendChild(option);
        });


        serviceSelect.disabled = false;

        /*
         * If the visitor came from:
         *
         * /book.html?service=1
         *
         * select that service automatically.
         */
        setSelectedService();

    } catch (error) {

        console.error("Error loading services:", error);

        serviceSelect.innerHTML =
            "<option value=\"\">Unable to load services</option>";

        serviceSelect.disabled = true;

        showMessage(
            error.message ||
            "Unable to load photography services.",
            "error"
        );
    }
}


/*
 * Create the time buttons.
 *
 * 7:00 AM through 5:00 PM
 * Every 30 minutes.
 */
function renderTimeSlots() {

    if (!timeSlotsContainer) {
        console.error("Time slots container was not found.");
        return;
    }

    timeSlotsContainer.innerHTML = "";

    for (
        let minutes = 7 * 60;
        minutes <= 17 * 60;
        minutes += 30
    ) {

        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;

        const value =
            `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;

        const button = document.createElement("button");

        button.type = "button";
        button.className = "time-slot";
        button.dataset.time = value;

        button.textContent = formatTime(value);

        button.addEventListener("click", function () {

            document
                .querySelectorAll(".time-slot")
                .forEach(function (slot) {
                    slot.classList.remove("selected");
                });

            button.classList.add("selected");

            selectedTime = value;

            clearFieldError("booking-time-error");
        });

        timeSlotsContainer.appendChild(button);
    }
}


/*
 * Convert 24-hour time into 12-hour display.
 */
function formatTime(time) {

    const parts = time.split(":");

    const hour = Number(parts[0]);
    const minute = parts[1];

    const period = hour >= 12 ? "PM" : "AM";

    const displayHour = hour % 12 || 12;

    return `${displayHour}:${minute} ${period}`;
}


/*
 * Format Philippine peso prices.
 */
function formatPrice(price) {

    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP"
    }).format(Number(price));
}


/*
 * Automatically select the service from the URL.
 *
 * Example:
 * /book.html?service=1
 */
function setSelectedService() {

    if (!serviceSelect || services.length === 0) {
        return;
    }

    const params = new URLSearchParams(
        window.location.search
    );

    const serviceId = params.get("service");

    if (!serviceId) {
        return;
    }

    const matchingService = services.find(function (service) {

        return String(service.id) === String(serviceId);

    });

    if (matchingService) {
        serviceSelect.value = String(matchingService.id);
    }
}


/*
 * Handle booking form submission.
 */
if (bookingForm) {

    bookingForm.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            clearAllErrors();
            clearMessage();


            /*
             * Validate before contacting the server.
             */
            const isValid = validateForm();

            if (!isValid) {

                showMessage(
                    "Please correct the highlighted fields.",
                    "error"
                );

                return;
            }


            setLoading(true);


            /*
             * Data sent to:
             *
             * POST /api/bookings
             */
            const bookingData = {

                service_id: serviceSelect.value,

                name: nameInput.value.trim(),

                contact: contactInput.value.trim(),

                email: emailInput.value.trim(),

                booking_date: dateInput.value,

                booking_time: selectedTime,

                guests: Number(guestsInput.value),

                notes: notesInput.value.trim()
            };


            console.log(
                "Submitting booking:",
                bookingData
            );


            try {

                const response = await fetch(
                    "/api/bookings",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify(bookingData)
                    }
                );


                let data;

                try {
                    data = await response.json();
                } catch (error) {

                    throw new Error(
                        "The server returned an invalid response."
                    );
                }


                if (!response.ok) {

                    throw new Error(
                        data.error ||
                        data.message ||
                        "Unable to create booking."
                    );
                }


                /*
                 * The backend should return:
                 *
                 * {
                 *     "reference": "BK123456"
                 * }
                 */
                if (!data.reference) {

                    throw new Error(
                        "The booking was created, but no reference number was returned."
                    );
                }


                showMessage(
                    "Booking submitted successfully.",
                    "success"
                );


                /*
                 * Go to the confirmation page.
                 */
                window.location.href =
                    `/confirmation.html?reference=${encodeURIComponent(
                        data.reference
                    )}`;

            } catch (error) {

                console.error(
                    "Booking submission error:",
                    error
                );

                showMessage(
                    error.message ||
                    "Unable to submit your booking.",
                    "error"
                );

            } finally {

                setLoading(false);
            }
        }
    );

} else {

    console.error(
        "Booking form with id=\"booking-form\" was not found."
    );
}


/*
 * Client-side validation.
 */
function validateForm() {

    let valid = true;


    if (!serviceSelect || !serviceSelect.value) {

        showFieldError(
            "service-error",
            "Please select a photography service."
        );

        valid = false;
    }


    if (!dateInput || !dateInput.value) {

        showFieldError(
            "booking-date-error",
            "Please select a booking date."
        );

        valid = false;

    } else {

        const selectedDate =
            new Date(`${dateInput.value}T00:00:00`);

        const today = new Date();

        today.setHours(0, 0, 0, 0);


        if (selectedDate < today) {

            showFieldError(
                "booking-date-error",
                "Booking date cannot be in the past."
            );

            valid = false;
        }
    }


    if (!selectedTime) {

        showFieldError(
            "booking-time-error",
            "Please select a booking time."
        );

        valid = false;
    }


    if (!guestsInput) {

        valid = false;

    } else {

        const guests = Number(
            guestsInput.value
        );


        if (
            !guestsInput.value ||
            guests < 1 ||
            !Number.isInteger(guests)
        ) {

            showFieldError(
                "guests-error",
                "Number of guests must be at least 1."
            );

            valid = false;
        }
    }


    if (!nameInput || !nameInput.value.trim()) {

        showFieldError(
            "name-error",
            "Please enter your full name."
        );

        valid = false;
    }


    if (
        !contactInput ||
        !contactInput.value.trim()
    ) {

        showFieldError(
            "contact-error",
            "Please enter your contact number."
        );

        valid = false;
    }


    if (
        !emailInput ||
        !emailInput.value.trim()
    ) {

        showFieldError(
            "email-error",
            "Please enter your email address."
        );

        valid = false;

    } else if (
        !isValidEmail(
            emailInput.value.trim()
        )
    ) {

        showFieldError(
            "email-error",
            "Please enter a valid email address."
        );

        valid = false;
    }


    return valid;
}


/*
 * Basic email validation.
 */
function isValidEmail(email) {

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
    );
}


/*
 * Display an individual field error.
 */
function showFieldError(id, message) {

    const element = document.getElementById(id);

    if (!element) {
        console.error(
            `Field error element "${id}" was not found.`
        );

        return;
    }

    element.textContent = message;
}


/*
 * Clear one field error.
 */
function clearFieldError(id) {

    const element = document.getElementById(id);

    if (!element) {
        return;
    }

    element.textContent = "";
}


/*
 * Clear all field errors.
 */
function clearAllErrors() {

    document
        .querySelectorAll(".field-error")
        .forEach(function (element) {

            element.textContent = "";

        });
}


/*
 * Clear the main form message.
 *
 * This is the function that was causing your
 * "Cannot set properties of null" error.
 */
function clearMessage() {

    if (!formMessage) {
        return;
    }

    formMessage.textContent = "";
    formMessage.className = "form-message";
}


/*
 * Show a success/error message.
 */
function showMessage(message, type) {

    if (!formMessage) {

        console.error(
            "The form-message element was not found."
        );

        return;
    }

    formMessage.textContent = message;

    formMessage.className =
        `form-message ${type}`;
}


/*
 * Disable the submit button while submitting.
 */
function setLoading(loading) {

    if (!submitButton) {
        return;
    }

    submitButton.disabled = loading;

    if (loading) {

        submitButton.textContent =
            "Submitting...";

    } else {

        submitButton.textContent =
            "Submit Booking";
    }
}