require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

const requiredVariables = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD"
];

const missingVariables = requiredVariables.filter((variable) => {
    return !process.env[variable] || process.env[variable].trim() === "";
});

if (missingVariables.length > 0) {
    console.error(
        "Error: The following required environment variables are missing:"
    );
    console.error(missingVariables.join(", "));
    console.error("Please check your .env file and try again.");
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createAdmin() {
    const username = process.env.ADMIN_USERNAME.trim();
    const password = process.env.ADMIN_PASSWORD;

    if (username.length < 3) {
        console.error(
            "Error: ADMIN_USERNAME must contain at least 3 characters."
        );
        process.exit(1);
    }

    if (password.length < 8) {
        console.error(
            "Error: ADMIN_PASSWORD must contain at least 8 characters."
        );
        process.exit(1);
    }

    try {
        console.log("Hashing the administrator password...");

        const passwordHash = await bcrypt.hash(password, 12);

        console.log("Creating administrator account...");

        const { data, error } = await supabase
            .from("admins")
            .insert({
                username: username,
                password_hash: passwordHash
            })
            .select("id, username, created_at")
            .single();

        if (error) {
            if (error.code === "23505") {
                console.error(
                    `Error: An administrator with the username "${username}" already exists.`
                );
                console.error(
                    "Choose a different ADMIN_USERNAME and run the command again."
                );
                process.exit(1);
            }

            console.error("Error: Could not create administrator account.");
            console.error(error.message);
            process.exit(1);
        }

        console.log("");
        console.log("Administrator account created successfully.");
        console.log(`Username: ${data.username}`);
        console.log("Password: [hidden]");
        console.log(`Admin ID: ${data.id}`);
        console.log("");
        console.log("The password was hashed before being stored in Supabase.");
    } catch (error) {
        console.error("Error: An unexpected error occurred.");
        console.error(error.message);
        process.exit(1);
    }
}

createAdmin();