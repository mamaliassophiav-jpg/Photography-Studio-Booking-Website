const servicesGrid = document.getElementById("services-grid");
const servicesLoading = document.getElementById("services-loading");
const servicesEmpty = document.getElementById("services-empty");
const servicesMessage = document.getElementById("services-message");

function formatPrice(price) {
    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP"
    }).format(Number(price));
}

function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `message message-${type} show`;
}

function createServiceCard(service) {
    const card = document.createElement("article");
    card.className = "service-card";

    const icon = document.createElement("div");
    icon.className = "service-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "F";

    const title = document.createElement("h2");
    title.textContent = service.name;

    const description = document.createElement("p");
    description.textContent = service.description;

    const price = document.createElement("div");
    price.className = "service-price";
    price.textContent = formatPrice(service.price);

    const button = document.createElement("a");
    button.className = "button button-primary button-full";
    button.href = `/book.html?service=${encodeURIComponent(service.id)}`;
    button.textContent = "Book now";

    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(price);
    card.appendChild(button);

    return card;
}

async function loadServices() {
    servicesLoading.classList.remove("hidden");
    servicesEmpty.classList.add("hidden");
    servicesGrid.innerHTML = "";
    servicesMessage.className = "message";
    servicesMessage.textContent = "";

    try {
        const response = await fetch("/api/services");

        const data = await response.json().catch(() => {
            return null;
        });

        if (!response.ok) {
            throw new Error(
                data && data.error
                    ? data.error
                    : "Unable to load services."
            );
        }

        servicesLoading.classList.add("hidden");

        if (!Array.isArray(data) || data.length === 0) {
            servicesEmpty.classList.remove("hidden");
            return;
        }

        data.forEach((service) => {
            servicesGrid.appendChild(
                createServiceCard(service)
            );
        });
    } catch (error) {
        servicesLoading.classList.add("hidden");

        showMessage(
            servicesMessage,
            error.message || "Unable to load services.",
            "error"
        );
    }
}

loadServices();