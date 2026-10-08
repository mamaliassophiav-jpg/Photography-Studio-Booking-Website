require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const app = express();

const requiredEnvironmentVariables = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "JWT_SECRET"
];

const missingEnvironmentVariables = requiredEnvironmentVariables.filter(
    (variable) => {
        return (
            !process.env[variable] ||
            process.env[variable].trim() === ""
        );
    }
);

if (missingEnvironmentVariables.length > 0) {
    throw new Error(
        `Missing required environment variable(s): ${missingEnvironmentVariables.join(
            ", "
        )}`
    );
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/*
 * Serve the frontend when running locally.
 * Vercel can also serve the files inside public/.
 */
app.use(express.static(path.join(__dirname, "..", "public")));

/*
 * General error response helper.
 */
function sendError(res, statusCode, message) {
    return res.status(statusCode).json({
        error: message
    });
}

/*
 * Generate a booking reference in the format:
 * BKXXXXXX
 *
 * The reference contains six uppercase letters/numbers.
 */
function generateBookingReference() {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let reference = "BK";

    const randomBytes = crypto.randomBytes(6);

    for (let i = 0; i < 6; i++) {
        reference += characters[randomBytes[i] % characters.length];
    }

    return reference;
}

/*
 * Create a unique booking reference.
 *
 * A database unique constraint on bookings.reference provides
 * the final protection against duplicate references.
 */
async function generateUniqueBookingReference() {
    for (let attempt = 0; attempt < 10; attempt++) {
        const reference = generateBookingReference();

        const { data, error } = await supabase
            .from("bookings")
            .select("id")
            .eq("reference", reference)
            .maybeSingle();

        if (error) {
            throw error;
        }

        if (!data) {
            return reference;
        }
    }

    throw new Error(
        "Unable to generate a unique booking reference after multiple attempts."
    );
}

/*
 * Validate an email address.
 */
function isValidEmail(email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(email);
}

/*
 * Validate a booking date.
 *
 * Expected format:
 * YYYY-MM-DD
 */
function isValidDateFormat(date) {
    if (typeof date !== "string") {
        return false;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
    }

    const [year, month, day] = date.split("-").map(Number);

    const testDate = new Date(
        Date.UTC(year, month - 1, day)
    );

    return (
        testDate.getUTCFullYear() === year &&
        testDate.getUTCMonth() === month - 1 &&
        testDate.getUTCDate() === day
    );
}

/*
 * Validate that the booking date is not in the past.
 *
 * The date is compared as a date-only value.
 */
function isPastDate(dateString) {
    const today = new Date().toISOString().slice(0, 10);

    return dateString < today;
}

/*
 * Validate booking time.
 *
 * Allowed:
 * 07:00 through 17:00
 *
 * 17:00 is allowed.
 */
function isValidBookingTime(time) {
    if (typeof time !== "string") {
        return false;
    }

    if (!/^\d{2}:\d{2}$/.test(time)) {
        return false;
    }

    const [hours, minutes] = time.split(":").map(Number);

    if (hours < 0 || hours > 23) {
        return false;
    }

    if (minutes < 0 || minutes > 59) {
        return false;
    }

    const totalMinutes = hours * 60 + minutes;

    const openingTime = 7 * 60;
    const closingTime = 17 * 60;

    return (
        totalMinutes >= openingTime &&
        totalMinutes <= closingTime
    );
}

/*
 * Admin authentication middleware.
 *
 * The JWT must be stored in an httpOnly cookie.
 */
function requireAdmin(req, res, next) {
    const token = req.cookies.admin_token;

    if (!token) {
        return sendError(
            res,
            401,
            "Authentication required."
        );
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.admin = decoded;

        next();
    } catch (error) {
        console.error("Admin authentication error:", error);

        return sendError(
            res,
            401,
            "Invalid or expired authentication."
        );
    }
}

/*
 * GET /api/services
 *
 * Returns only active services, ordered by name.
 */
app.get("/api/services", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("services")
            .select("id, name, description, price, is_active")
            .eq("is_active", true)
            .order("name", {
                ascending: true
            });

        if (error) {
            console.error("Get services error:", error);

            return sendError(
                res,
                500,
                "Unable to load services."
            );
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error("Unexpected get services error:", error);

        return sendError(
            res,
            500,
            "An unexpected error occurred while loading services."
        );
    }
});

/*
 * POST /api/bookings
 *
 * Creates a new booking.
 *
 * Multiple bookings are allowed for the same date and time.
 */
app.post("/api/bookings", async (req, res) => {
    try {
        const {
            service_id,
            name,
            contact,
            email,
            booking_date,
            booking_time,
            guests,
            notes
        } = req.body;

        const missingFields = [];

        if (
            service_id === undefined ||
            service_id === null ||
            service_id === ""
        ) {
            missingFields.push("service_id");
        }

        if (
            typeof name !== "string" ||
            name.trim() === ""
        ) {
            missingFields.push("name");
        }

        if (
            typeof contact !== "string" ||
            contact.trim() === ""
        ) {
            missingFields.push("contact");
        }

        if (
            typeof email !== "string" ||
            email.trim() === ""
        ) {
            missingFields.push("email");
        }

        if (
            typeof booking_date !== "string" ||
            booking_date.trim() === ""
        ) {
            missingFields.push("booking_date");
        }

        if (
            typeof booking_time !== "string" ||
            booking_time.trim() === ""
        ) {
            missingFields.push("booking_time");
        }

        if (
            guests === undefined ||
            guests === null ||
            guests === ""
        ) {
            missingFields.push("guests");
        }

        if (missingFields.length > 0) {
            return sendError(
                res,
                400,
                `Missing required field(s): ${missingFields.join(", ")}.`
            );
        }

        const serviceId = Number(service_id);
        const guestCount = Number(guests);

        if (
            !Number.isInteger(serviceId) ||
            serviceId <= 0
        ) {
            return sendError(
                res,
                400,
                "service_id must be a valid service ID."
            );
        }

        if (
            !Number.isInteger(guestCount) ||
            guestCount < 1
        ) {
            return sendError(
                res,
                400,
                "Guests must be a whole number of at least 1."
            );
        }

        const trimmedName = name.trim();
        const trimmedContact = contact.trim();
        const trimmedEmail = email.trim().toLowerCase();
        const trimmedDate = booking_date.trim();
        const trimmedTime = booking_time.trim();
        const trimmedNotes =
            typeof notes === "string"
                ? notes.trim()
                : null;

        if (trimmedName.length > 100) {
            return sendError(
                res,
                400,
                "Name must not exceed 100 characters."
            );
        }

        if (trimmedContact.length > 50) {
            return sendError(
                res,
                400,
                "Contact information must not exceed 50 characters."
            );
        }

        if (!isValidEmail(trimmedEmail)) {
            return sendError(
                res,
                400,
                "Please provide a valid email address."
            );
        }

        if (trimmedEmail.length > 255) {
            return sendError(
                res,
                400,
                "Email address must not exceed 255 characters."
            );
        }

        if (!isValidDateFormat(trimmedDate)) {
            return sendError(
                res,
                400,
                "Booking date must use the YYYY-MM-DD format."
            );
        }

        if (isPastDate(trimmedDate)) {
            return sendError(
                res,
                400,
                "Booking date cannot be in the past."
            );
        }

        if (!isValidBookingTime(trimmedTime)) {
            return sendError(
                res,
                400,
                "Booking time must be between 07:00 and 17:00."
            );
        }

        if (
            trimmedNotes !== null &&
            trimmedNotes.length > 1000
        ) {
            return sendError(
                res,
                400,
                "Notes must not exceed 1000 characters."
            );
        }

        /*
         * Check that the selected service exists and is active.
         */
        const { data: service, error: serviceError } =
            await supabase
                .from("services")
                .select("id, name, price, is_active")
                .eq("id", serviceId)
                .eq("is_active", true)
                .maybeSingle();

        if (serviceError) {
            console.error(
                "Check booking service error:",
                serviceError
            );

            return sendError(
                res,
                500,
                "Unable to verify the selected service."
            );
        }

        if (!service) {
            return sendError(
                res,
                400,
                "The selected service is not available."
            );
        }

        /*
         * IMPORTANT:
         * There is deliberately NO check here for another booking
         * with the same booking_date and booking_time.
         *
         * Multiple bookings for the same slot are allowed.
         */

        const reference =
            await generateUniqueBookingReference();

        const { data: booking, error: bookingError } =
            await supabase
                .from("bookings")
                .insert({
                    reference: reference,
                    service_id: serviceId,
                    name: trimmedName,
                    contact: trimmedContact,
                    email: trimmedEmail,
                    booking_date: trimmedDate,
                    booking_time: trimmedTime,
                    guests: guestCount,
                    notes: trimmedNotes,
                    status: "pending"
                })
                .select(
                    "id, reference, service_id, name, contact, email, booking_date, booking_time, guests, notes, status, created_at"
                )
                .single();

        if (bookingError) {
            console.error(
                "Create booking error:",
                bookingError
            );

            /*
             * A duplicate reference should be extremely unlikely
             * because references are checked before insertion.
             */
            if (bookingError.code === "23505") {
                return sendError(
                    res,
                    500,
                    "Unable to create a unique booking reference. Please try again."
                );
            }

            return sendError(
                res,
                500,
                "Unable to create your booking."
            );
        }

        return res.status(201).json({
            message: "Booking created successfully.",
            reference: booking.reference
        });
    } catch (error) {
        console.error(
            "Unexpected create booking error:",
            error
        );

        return sendError(
            res,
            500,
            "An unexpected error occurred while creating the booking."
        );
    }
});

/*
 * GET /api/bookings/:reference
 *
 * Returns a booking together with the service name.
 */
app.get("/api/bookings/:reference", async (req, res) => {
    try {
        const reference = req.params.reference.trim();

        if (!reference) {
            return sendError(
                res,
                400,
                "Booking reference is required."
            );
        }

        const { data, error } = await supabase
            .from("bookings")
            .select(
                `
                id,
                reference,
                service_id,
                name,
                contact,
                email,
                booking_date,
                booking_time,
                guests,
                notes,
                status,
                created_at,
                services (
                    name
                )
                `
            )
            .eq("reference", reference)
            .maybeSingle();

        if (error) {
            console.error(
                "Get booking by reference error:",
                error
            );

            return sendError(
                res,
                500,
                "Unable to retrieve the booking."
            );
        }

        if (!data) {
            return sendError(
                res,
                404,
                "Booking not found."
            );
        }

        return res.status(200).json({
            id: data.id,
            reference: data.reference,
            service_id: data.service_id,
            service_name: data.services
                ? data.services.name
                : null,
            name: data.name,
            contact: data.contact,
            email: data.email,
            booking_date: data.booking_date,
            booking_time: data.booking_time,
            guests: data.guests,
            notes: data.notes,
            status: data.status,
            created_at: data.created_at
        });
    } catch (error) {
        console.error(
            "Unexpected get booking error:",
            error
        );

        return sendError(
            res,
            500,
            "An unexpected error occurred while retrieving the booking."
        );
    }
});

/*
 * POST /api/admin/login
 *
 * Checks the admin username and password.
 */
app.post("/api/admin/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (
            typeof username !== "string" ||
            username.trim() === ""
        ) {
            return sendError(
                res,
                400,
                "Username is required."
            );
        }

        if (
            typeof password !== "string" ||
            password === ""
        ) {
            return sendError(
                res,
                400,
                "Password is required."
            );
        }

        const trimmedUsername = username.trim();

        const { data: admin, error } = await supabase
            .from("admins")
            .select("id, username, password_hash")
            .eq("username", trimmedUsername)
            .maybeSingle();

        if (error) {
            console.error(
                "Admin login database error:",
                error
            );

            return sendError(
                res,
                500,
                "Unable to process the login."
            );
        }

        if (!admin) {
            return sendError(
                res,
                401,
                "Invalid username or password."
            );
        }

        const passwordMatches =
            await bcrypt.compare(
                password,
                admin.password_hash
            );

        if (!passwordMatches) {
            return sendError(
                res,
                401,
                "Invalid username or password."
            );
        }

        const token = jwt.sign(
            {
                adminId: admin.id,
                username: admin.username
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "1d"
            }
        );

        res.cookie("admin_token", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 24 * 60 * 60 * 1000,
            path: "/"
        });

        return res.status(200).json({
            message: "Login successful."
        });
    } catch (error) {
        console.error(
            "Unexpected admin login error:",
            error
        );

        return sendError(
            res,
            500,
            "An unexpected error occurred during login."
        );
    }
});

/*
 * POST /api/admin/logout
 *
 * Clears the authentication cookie.
 */
app.post("/api/admin/logout", (req, res) => {
    try {
        res.clearCookie("admin_token", {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            path: "/"
        });

        return res.status(200).json({
            message: "Logout successful."
        });
    } catch (error) {
        console.error(
            "Admin logout error:",
            error
        );

        return sendError(
            res,
            500,
            "Unable to log out."
        );
    }
});

/*
 * GET /api/admin/bookings
 *
 * Returns all bookings with their service name,
 * newest bookings first.
 */
app.get(
    "/api/admin/bookings",
    requireAdmin,
    async (req, res) => {
        try {
            const { data, error } = await supabase
                .from("bookings")
                .select(
                    `
                    id,
                    reference,
                    service_id,
                    name,
                    contact,
                    email,
                    booking_date,
                    booking_time,
                    guests,
                    notes,
                    status,
                    created_at,
                    services (
                        name
                    )
                    `
                )
                .order("created_at", {
                    ascending: false
                });

            if (error) {
                console.error(
                    "Get admin bookings error:",
                    error
                );

                return sendError(
                    res,
                    500,
                    "Unable to load bookings."
                );
            }

            const bookings = data.map((booking) => {
                return {
                    id: booking.id,
                    reference: booking.reference,
                    service_id: booking.service_id,
                    service_name: booking.services
                        ? booking.services.name
                        : null,
                    name: booking.name,
                    contact: booking.contact,
                    email: booking.email,
                    booking_date: booking.booking_date,
                    booking_time: booking.booking_time,
                    guests: booking.guests,
                    notes: booking.notes,
                    status: booking.status,
                    created_at: booking.created_at
                };
            });

            return res.status(200).json(bookings);
        } catch (error) {
            console.error(
                "Unexpected get admin bookings error:",
                error
            );

            return sendError(
                res,
                500,
                "An unexpected error occurred while loading bookings."
            );
        }
    }
);

/*
 * PATCH /api/admin/bookings/:id/confirm
 *
 * Changes a pending/cancelled booking to confirmed.
 */
app.patch(
    "/api/admin/bookings/:id/confirm",
    requireAdmin,
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {
                return sendError(
                    res,
                    400,
                    "Invalid booking ID."
                );
            }

            const { data, error } = await supabase
                .from("bookings")
                .update({
                    status: "confirmed"
                })
                .eq("id", id)
                .select(
                    `
                    id,
                    reference,
                    status,
                    services (
                        name
                    )
                    `
                )
                .maybeSingle();

            if (error) {
                console.error(
                    "Confirm booking error:",
                    error
                );

                return sendError(
                    res,
                    500,
                    "Unable to confirm the booking."
                );
            }

            if (!data) {
                return sendError(
                    res,
                    404,
                    "Booking not found."
                );
            }

            return res.status(200).json({
                message: "Booking confirmed successfully.",
                booking: {
                    id: data.id,
                    reference: data.reference,
                    status: data.status,
                    service_name: data.services
                        ? data.services.name
                        : null
                }
            });
        } catch (error) {
            console.error(
                "Unexpected confirm booking error:",
                error
            );

            return sendError(
                res,
                500,
                "An unexpected error occurred while confirming the booking."
            );
        }
    }
);

/*
 * PATCH /api/admin/bookings/:id/cancel
 *
 * Changes a booking to cancelled.
 */
app.patch(
    "/api/admin/bookings/:id/cancel",
    requireAdmin,
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {
                return sendError(
                    res,
                    400,
                    "Invalid booking ID."
                );
            }

            const { data, error } = await supabase
                .from("bookings")
                .update({
                    status: "cancelled"
                })
                .eq("id", id)
                .select(
                    `
                    id,
                    reference,
                    status,
                    services (
                        name
                    )
                    `
                )
                .maybeSingle();

            if (error) {
                console.error(
                    "Cancel booking error:",
                    error
                );

                return sendError(
                    res,
                    500,
                    "Unable to cancel the booking."
                );
            }

            if (!data) {
                return sendError(
                    res,
                    404,
                    "Booking not found."
                );
            }

            return res.status(200).json({
                message: "Booking cancelled successfully.",
                booking: {
                    id: data.id,
                    reference: data.reference,
                    status: data.status,
                    service_name: data.services
                        ? data.services.name
                        : null
                }
            });
        } catch (error) {
            console.error(
                "Unexpected cancel booking error:",
                error
            );

            return sendError(
                res,
                500,
                "An unexpected error occurred while cancelling the booking."
            );
        }
    }
);

/*
 * DELETE /api/admin/bookings/:id
 *
 * Permanently deletes a booking.
 */
app.delete(
    "/api/admin/bookings/:id",
    requireAdmin,
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (
                !Number.isInteger(id) ||
                id <= 0
            ) {
                return sendError(
                    res,
                    400,
                    "Invalid booking ID."
                );
            }

            const { data, error } = await supabase
                .from("bookings")
                .delete()
                .eq("id", id)
                .select("id, reference")
                .maybeSingle();

            if (error) {
                console.error(
                    "Delete booking error:",
                    error
                );

                return sendError(
                    res,
                    500,
                    "Unable to delete the booking."
                );
            }

            if (!data) {
                return sendError(
                    res,
                    404,
                    "Booking not found."
                );
            }

            return res.status(200).json({
                message: "Booking deleted successfully.",
                reference: data.reference
            });
        } catch (error) {
            console.error(
                "Unexpected delete booking error:",
                error
            );

            return sendError(
                res,
                500,
                "An unexpected error occurred while deleting the booking."
            );
        }
    }
);

/*
 * API fallback for unknown API routes.
 */
app.use("/api", (req, res) => {
    return sendError(
        res,
        404,
        "API endpoint not found."
    );
});

/*
 * General Express error handler.
 */
app.use((error, req, res, next) => {
    console.error("Unhandled Express error:", error);

    return sendError(
        res,
        500,
        "An unexpected server error occurred."
    );
});

/*
 * Export the Express app for Vercel.
 */
module.exports = app;

/*
 * Only start a local server when this file is run directly.
 *
 * Vercel imports the app instead of running app.listen().
 */
if (require.main === module) {
    const port = process.env.PORT || 3000;

    app.listen(port, () => {
        console.log(
            `Photography Studio Booking System running on port ${port}`
        );
    });
}