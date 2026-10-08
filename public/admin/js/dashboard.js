"use strict";

const loadingState =
    document.getElementById(
        "loading-state"
    );

const emptyState =
    document.getElementById(
        "empty-state"
    );

const tableContainer =
    document.getElementById(
        "table-container"
    );

const tableBody =
    document.getElementById(
        "bookings-table-body"
    );

const searchInput =
    document.getElementById(
        "search"
    );

const statusFilter =
    document.getElementById(
        "status-filter"
    );

const logoutButton =
    document.getElementById(
        "logout-button"
    );

const dashboardMessage =
    document.getElementById(
        "dashboard-message"
    );

const totalCount =
    document.getElementById(
        "total-count"
    );

const pendingCount =
    document.getElementById(
        "pending-count"
    );

const confirmedCount =
    document.getElementById(
        "confirmed-count"
    );

let bookings = [];


/*
 * Start dashboard.
 */
document.addEventListener(
    "DOMContentLoaded",
    function () {
        loadBookings();
    }
);


/*
 * Search.
 */
if (searchInput) {
    searchInput.addEventListener(
        "input",
        function () {
            renderBookings();
        }
    );
}


/*
 * Status filter.
 */
if (statusFilter) {
    statusFilter.addEventListener(
        "change",
        function () {
            renderBookings();
        }
    );
}


/*
 * Logout.
 */
if (logoutButton) {
    logoutButton.addEventListener(
        "click",
        logoutAdmin
    );
}


/*
 * Load bookings from backend.
 */
async function loadBookings() {
    showLoading(true);
    clearMessage();

    try {
        console.log(
            "Loading admin bookings..."
        );

        const response =
            await fetch(
                "/api/admin/bookings",
                {
                    method: "GET",
                    credentials:
                        "same-origin",
                    cache: "no-store"
                }
            );

        console.log(
            "Admin bookings response status:",
            response.status
        );

        /*
         * Login is required.
         */
        if (response.status === 401) {
            redirectToLogin();
            return;
        }

        let data = {};

        try {
            data =
                await response.json();
        } catch (error) {
            throw new Error(
                "The server returned an invalid response."
            );
        }

        console.log(
            "Admin bookings data:",
            data
        );

        if (!response.ok) {
            throw new Error(
                data.error ||
                data.message ||
                "Unable to load bookings."
            );
        }

        /*
         * The backend returns an array.
         */
        if (Array.isArray(data)) {
            bookings = data;
        } else if (
            Array.isArray(data.bookings)
        ) {
            bookings =
                data.bookings;
        } else {
            bookings = [];
        }

        console.log(
            `Bookings received: ${bookings.length}`
        );

        updateSummary();
        renderBookings();

        showLoading(false);
    } catch (error) {
        console.error(
            "Error loading bookings:",
            error
        );

        bookings = [];

        showLoading(false);

        showEmptyState(
            true,
            "Unable to load bookings",
            error.message ||
                "Please try again."
        );

        showMessage(
            error.message ||
                "Unable to load bookings.",
            "error"
        );
    }
}


/*
 * Render bookings.
 */
function renderBookings() {
    if (!tableBody) {
        return;
    }

    const searchTerm =
        searchInput
            ? searchInput.value
                  .trim()
                  .toLowerCase()
            : "";

    const selectedStatus =
        statusFilter
            ? statusFilter.value
            : "all";

    const filteredBookings =
        bookings.filter(
            function (booking) {
                const searchText = [
                    booking.reference,
                    booking.service_name,
                    booking.name,
                    booking.contact,
                    booking.email,
                    booking.booking_date,
                    booking.booking_time
                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();

                const matchesSearch =
                    !searchTerm ||
                    searchText.includes(
                        searchTerm
                    );

                const matchesStatus =
                    selectedStatus ===
                        "all" ||
                    String(
                        booking.status
                    ).toLowerCase() ===
                        selectedStatus;

                return (
                    matchesSearch &&
                    matchesStatus
                );
            }
        );

    tableBody.innerHTML = "";

    if (
        filteredBookings.length ===
        0
    ) {
        if (bookings.length === 0) {
            showEmptyState(
                true,
                "No bookings yet",
                "There are currently no bookings."
            );
        } else {
            showEmptyState(
                true,
                "No matching bookings",
                "No bookings match your current search or status filter."
            );
        }

        if (tableContainer) {
            tableContainer.hidden =
                true;
        }

        return;
    }

    showEmptyState(false);

    if (tableContainer) {
        tableContainer.hidden =
            false;
    }

    filteredBookings.forEach(
        function (booking) {
            const row =
                createBookingRow(
                    booking
                );

            tableBody.appendChild(
                row
            );
        }
    );
}


/*
 * Create booking row.
 */
function createBookingRow(
    booking
) {
    const row =
        document.createElement(
            "tr"
        );

    /*
     * Reference
     */
    const referenceCell =
        document.createElement(
            "td"
        );

    referenceCell.textContent =
        booking.reference || "-";

    /*
     * Service
     */
    const serviceCell =
        document.createElement(
            "td"
        );

    serviceCell.textContent =
        booking.service_name ||
        booking.service ||
        "Unknown service";

    /*
     * Name
     */
    const nameCell =
        document.createElement(
            "td"
        );

    nameCell.textContent =
        booking.name || "-";

    /*
     * Contact
     */
    const contactCell =
        document.createElement(
            "td"
        );

    contactCell.textContent =
        booking.contact || "-";

    /*
     * Date
     */
    const dateCell =
        document.createElement(
            "td"
        );

    dateCell.textContent =
        formatDate(
            booking.booking_date
        );

    /*
     * Time
     */
    const timeCell =
        document.createElement(
            "td"
        );

    timeCell.textContent =
        formatTime(
            booking.booking_time
        );

    /*
     * Guests
     */
    const guestsCell =
        document.createElement(
            "td"
        );

    guestsCell.textContent =
        booking.guests ?? "-";

    /*
     * Status
     */
    const statusCell =
        document.createElement(
            "td"
        );

    statusCell.appendChild(
        createStatusBadge(
            booking.status
        )
    );

    /*
     * Actions
     */
    const actionsCell =
        document.createElement(
            "td"
        );

    actionsCell.className =
        "booking-actions";

    /*
     * Confirm
     */
    const confirmButton =
        document.createElement(
            "button"
        );

    confirmButton.type = "button";

    confirmButton.className =
        "btn btn-primary btn-small";

    confirmButton.textContent =
        "Confirm";

    confirmButton.addEventListener(
        "click",
        function () {
            updateBookingStatus(
                booking.id,
                "confirm"
            );
        }
    );

    /*
     * Cancel
     */
    const cancelButton =
        document.createElement(
            "button"
        );

    cancelButton.type = "button";

    cancelButton.className =
        "btn btn-secondary btn-small";

    cancelButton.textContent =
        "Cancel";

    cancelButton.addEventListener(
        "click",
        function () {
            updateBookingStatus(
                booking.id,
                "cancel"
            );
        }
    );

    /*
     * Delete
     */
    const deleteButton =
        document.createElement(
            "button"
        );

    deleteButton.type = "button";

    deleteButton.className =
        "btn btn-danger btn-small";

    deleteButton.textContent =
        "Delete";

    deleteButton.addEventListener(
        "click",
        function () {
            deleteBooking(
                booking.id,
                booking.reference
            );
        }
    );

    if (
        booking.status ===
        "confirmed"
    ) {
        confirmButton.disabled =
            true;
    }

    if (
        booking.status ===
        "cancelled"
    ) {
        cancelButton.disabled =
            true;
    }

    actionsCell.appendChild(
        confirmButton
    );

    actionsCell.appendChild(
        cancelButton
    );

    actionsCell.appendChild(
        deleteButton
    );

    row.appendChild(
        referenceCell
    );

    row.appendChild(
        serviceCell
    );

    row.appendChild(
        nameCell
    );

    row.appendChild(
        contactCell
    );

    row.appendChild(
        dateCell
    );

    row.appendChild(
        timeCell
    );

    row.appendChild(
        guestsCell
    );

    row.appendChild(
        statusCell
    );

    row.appendChild(
        actionsCell
    );

    return row;
}


/*
 * Status badge.
 */
function createStatusBadge(
    status
) {
    const badge =
        document.createElement(
            "span"
        );

    const normalizedStatus =
        String(
            status || "pending"
        ).toLowerCase();

    badge.className =
        `status-badge status-${normalizedStatus}`;

    badge.textContent =
        capitalize(
            normalizedStatus
        );

    return badge;
}


/*
 * Confirm/cancel.
 */
async function updateBookingStatus(
    bookingId,
    action
) {
    if (!bookingId) {
        showMessage(
            "Booking ID is missing.",
            "error"
        );

        return;
    }

    const actionName =
        action === "confirm"
            ? "confirm"
            : "cancel";

    const endpoint =
        `/api/admin/bookings/${encodeURIComponent(
            bookingId
        )}/${actionName}`;

    try {
        const response =
            await fetch(
                endpoint,
                {
                    method: "PATCH",
                    credentials:
                        "same-origin"
                }
            );

        if (
            response.status === 401
        ) {
            redirectToLogin();
            return;
        }

        let data = {};

        try {
            data =
                await response.json();
        } catch (error) {
            data = {};
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                data.message ||
                `Unable to ${actionName} booking.`
            );
        }

        showMessage(
            actionName === "confirm"
                ? "Booking confirmed successfully."
                : "Booking cancelled successfully.",
            "success"
        );

        await loadBookings();
    } catch (error) {
        console.error(
            `Error trying to ${actionName} booking:`,
            error
        );

        showMessage(
            error.message ||
                `Unable to ${actionName} booking.`,
            "error"
        );
    }
}


/*
 * Delete booking.
 */
async function deleteBooking(
    bookingId,
    reference
) {
    if (!bookingId) {
        showMessage(
            "Booking ID is missing.",
            "error"
        );

        return;
    }

    const confirmed =
        window.confirm(
            `Are you sure you want to permanently delete booking ${
                reference || ""
            }?`
        );

    if (!confirmed) {
        return;
    }

    try {
        const response =
            await fetch(
                `/api/admin/bookings/${encodeURIComponent(
                    bookingId
                )}`,
                {
                    method: "DELETE",
                    credentials:
                        "same-origin"
                }
            );

        if (
            response.status === 401
        ) {
            redirectToLogin();
            return;
        }

        let data = {};

        try {
            data =
                await response.json();
        } catch (error) {
            data = {};
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                data.message ||
                "Unable to delete booking."
            );
        }

        showMessage(
            "Booking deleted successfully.",
            "success"
        );

        await loadBookings();
    } catch (error) {
        console.error(
            "Error deleting booking:",
            error
        );

        showMessage(
            error.message ||
                "Unable to delete booking.",
            "error"
        );
    }
}


/*
 * Logout.
 */
async function logoutAdmin() {
    if (logoutButton) {
        logoutButton.disabled =
            true;

        logoutButton.textContent =
            "Logging out...";
    }

    try {
        const response =
            await fetch(
                "/api/admin/logout",
                {
                    method: "POST",
                    credentials:
                        "same-origin"
                }
            );

        if (!response.ok) {
            let data = {};

            try {
                data =
                    await response.json();
            } catch (error) {
                data = {};
            }

            throw new Error(
                data.error ||
                data.message ||
                "Unable to log out."
            );
        }

        window.location.href =
            "/admin/login.html";
    } catch (error) {
        console.error(
            "Logout error:",
            error
        );

        showMessage(
            error.message ||
                "Unable to log out.",
            "error"
        );

        if (logoutButton) {
            logoutButton.disabled =
                false;

            logoutButton.textContent =
                "Logout";
        }
    }
}


/*
 * Update dashboard summary.
 */
function updateSummary() {
    const total =
        bookings.length;

    const pending =
        bookings.filter(
            function (booking) {
                return (
                    booking.status ===
                    "pending"
                );
            }
        ).length;

    const confirmed =
        bookings.filter(
            function (booking) {
                return (
                    booking.status ===
                    "confirmed"
                );
            }
        ).length;

    if (totalCount) {
        totalCount.textContent =
            total;
    }

    if (pendingCount) {
        pendingCount.textContent =
            pending;
    }

    if (confirmedCount) {
        confirmedCount.textContent =
            confirmed;
    }
}


/*
 * Format date.
 */
function formatDate(
    dateValue
) {
    if (!dateValue) {
        return "-";
    }

    const date =
        new Date(
            `${dateValue}T00:00:00`
        );

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return dateValue;
    }

    return new Intl.DateTimeFormat(
        "en-PH",
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    ).format(date);
}


/*
 * Format time.
 */
function formatTime(
    timeValue
) {
    if (!timeValue) {
        return "-";
    }

    const parts =
        String(timeValue).split(":");

    if (parts.length < 2) {
        return timeValue;
    }

    const hour =
        Number(parts[0]);

    const minute =
        parts[1];

    if (Number.isNaN(hour)) {
        return timeValue;
    }

    const period =
        hour >= 12
            ? "PM"
            : "AM";

    const displayHour =
        hour % 12 || 12;

    return `${displayHour}:${minute} ${period}`;
}


/*
 * Capitalize.
 */
function capitalize(value) {
    if (!value) {
        return "";
    }

    return (
        value.charAt(0).toUpperCase() +
        value.slice(1)
    );
}


/*
 * Loading state.
 */
function showLoading(show) {
    if (loadingState) {
        loadingState.hidden =
            !show;
    }

    if (show) {
        if (tableContainer) {
            tableContainer.hidden =
                true;
        }

        if (emptyState) {
            emptyState.hidden =
                true;
        }
    }
}


/*
 * Empty state.
 */
function showEmptyState(
    show,
    title,
    description
) {
    if (!emptyState) {
        return;
    }

    const heading =
        emptyState.querySelector(
            "h2"
        );

    const paragraph =
        emptyState.querySelector(
            "p"
        );

    if (heading && title) {
        heading.textContent =
            title;
    }

    if (paragraph && description) {
        paragraph.textContent =
            description;
    }

    emptyState.hidden =
        !show;

    if (
        show &&
        tableContainer
    ) {
        tableContainer.hidden =
            true;
    }
}


/*
 * Dashboard message.
 */
function showMessage(
    message,
    type
) {
    if (!dashboardMessage) {
        return;
    }

    dashboardMessage.textContent =
        message;

    dashboardMessage.className =
        `form-message ${type}`;
}


/*
 * Clear dashboard message.
 */
function clearMessage() {
    if (!dashboardMessage) {
        return;
    }

    dashboardMessage.textContent =
        "";

    dashboardMessage.className =
        "form-message";
}


/*
 * Redirect to login.
 */
function redirectToLogin() {
    window.location.href =
        "/admin/login.html";
}