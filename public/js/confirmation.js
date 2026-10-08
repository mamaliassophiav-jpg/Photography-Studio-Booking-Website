const loadingElement = document.getElementById(
    "confirmation-loading"
);

const errorElement = document.getElementById(
    "confirmation-error"
);

const contentElement = document.getElementById(
    "confirmation-content"
);

const referenceElement = document.getElementById(
    "reference-number"
);

const copyButton = document.getElementById(
    "copy-button"
);

const summaryService = document.getElementById(
    "summary-service"
);

const summaryName = document.getElementById(
    "summary-name"
);

const summaryDate = document.getElementById(
    "summary-date"
);

const summaryTime = document.getElementById(
    "summary-time"
);

const summaryGuests = document.getElementById(
    "summary-guests"
);

const summaryStatus = document.getElementById(
    "summary-status"
);

const urlParams = new URLSearchParams(
    window.location.search
);

const reference = urlParams.get("reference");

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

function showError(message) {
    loadingElement.classList.add("hidden");
    contentElement.classList.add("hidden");

    errorElement.textContent = message;
    errorElement.className =
        "message message-error show";
}

async function loadBooking() {
    if (!reference) {
        showError(
            "No booking reference was provided."
        );

        return;
    }

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
                    : "Unable to load your booking."
            );
        }

        loadingElement.classList.add("hidden");
        errorElement.className = "message";

        contentElement.classList.remove("hidden");

        referenceElement.textContent = data.reference;
        summaryService.textContent =
            data.service_name || "Not available";
        summaryName.textContent = data.name;
        summaryDate.textContent =
            formatDate(data.booking_date);
        summaryTime.textContent =
            formatTime(data.booking_time);
        summaryGuests.textContent =
            String(data.guests);
        summaryStatus.textContent =
            formatStatus(data.status);
    } catch (error) {
        showError(
            error.message ||
            "Unable to load your booking."
        );
    }
}

copyButton.addEventListener("click", async () => {
    const referenceText =
        referenceElement.textContent.trim();

    if (!referenceText) {
        return;
    }

    try {
        await navigator.clipboard.writeText(
            referenceText
        );

        copyButton.textContent = "Copied!";

        setTimeout(() => {
            copyButton.textContent =
                "Copy Reference";
        }, 2000);
    } catch (error) {
        copyButton.textContent =
            "Copy failed";

        setTimeout(() => {
            copyButton.textContent =
                "Copy Reference";
        }, 2000);
    }
});

loadBooking();