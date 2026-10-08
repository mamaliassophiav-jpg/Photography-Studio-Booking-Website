const statusForm = document.getElementById(
    "status-form"
);

const referenceInput = document.getElementById(
    "reference"
);

const referenceError = document.getElementById(
    "reference-error"
);

const statusButton = document.getElementById(
    "status-button"
);

const statusMessage = document.getElementById(
    "status-message"
);

const statusResult = document.getElementById(
    "status-result"
);

const statusBadge = document.getElementById(
    "status-badge"
);

const resultReference = document.getElementById(
    "result-reference"
);

const resultService = document.getElementById(
    "result-service"
);

const resultName = document.getElementById(
    "result-name"
);

const resultContact = document.getElementById(
    "result-contact"
);

const resultEmail = document.getElementById(
    "result-email"
);

const resultDate = document.getElementById(
    "result-date"
);

const resultTime = document.getElementById(
    "result-time"
);

const resultGuests = document.getElementById(
    "result-guests"
);

const resultNotes = document.getElementById(
    "result-notes"
);

function formatDate(dateString) {
    const date = new Date(`${dateString}T00:00:00`);

    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "long"
    }).format(date);
}

function formatTime(timeString) {
    const [hours, minutes] = timeString
        .split(":")
        .map(Number);

    const date = new Date();

    date.setHours(hours, minutes, 0, 0);

    return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit"
    }).format(date);
}

function formatStatus(status) {
    if (!status) {
        return "Unknown";
    }

    return (
        status.charAt(0).toUpperCase() +
        status.slice(1)
    );
}

function showMessage(message, type) {
    statusMessage.textContent = message;
    statusMessage.className =
        `message message-${type} show`;
}

function clearMessage() {
    statusMessage.textContent = "";
    statusMessage.className = "message";
}

function clearReferenceError() {
    referenceError.textContent = "";
    referenceInput.classList.remove(
        "input-error"
    );
}

function setLoadingState(isLoading) {
    statusButton.disabled = isLoading;

    if (isLoading) {
        statusButton.textContent = "Checking...";
    } else {
        statusButton.textContent = "Check Booking";
    }
}

function showBooking(data) {
    statusResult.classList.remove("hidden");

    resultReference.textContent =
        data.reference;

    resultService.textContent =
        data.service_name || "Not available";

    resultName.textContent =
        data.name;

    resultContact.textContent =
        data.contact;

    resultEmail.textContent =
        data.email;

    resultDate.textContent =
        formatDate(data.booking_date);

    resultTime.textContent =
        formatTime(data.booking_time);

    resultGuests.textContent =
        String(data.guests);

    resultNotes.textContent =
        data.notes || "No notes provided.";

    const status = data.status || "unknown";

    statusBadge.textContent =
        formatStatus(status);

    statusBadge.className =
        `status-badge status-${status}`;
}

statusForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        clearMessage();
        clearReferenceError();
        statusResult.classList.add("hidden");

        const reference =
            referenceInput.value.trim().toUpperCase();

        if (!reference) {
            referenceError.textContent =
                "Please enter your booking reference.";

            referenceInput.classList.add(
                "input-error"
            );

            showMessage(
                "Please enter your booking reference.",
                "error"
            );

            return;
        }

        if (!/^BK[A-Z0-9]{6}$/.test(reference)) {
            referenceError.textContent =
                "Please enter a valid booking reference such as BK7A2F9Q.";

            referenceInput.classList.add(
                "input-error"
            );

            showMessage(
                "Please enter a valid booking reference.",
                "error"
            );

            return;
        }

        setLoadingState(true);

        try {
            const response = await fetch(
                `/api/bookings/${encodeURIComponent(reference)}`
            );

            const data = await response.json().catch(() => {
                return null;
            });

            if (!response.ok) {
                throw new Error(
                    data && data.error
                        ? data.error
                        : "Unable to find the booking."
                );
            }

            showBooking(data);

            showMessage(
                "Booking details loaded successfully.",
                "success"
            );
        } catch (error) {
            showMessage(
                error.message ||
                "Unable to find the booking.",
                "error"
            );
        } finally {
            setLoadingState(false);
        }
    }
);