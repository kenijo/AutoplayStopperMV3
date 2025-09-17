const domainInput = document.getElementById("domainInput");
const addButton = document.getElementById("addDomain");
const domainList = document.getElementById("domainList");
const message = document.getElementById("message");
const searchInput = document.getElementById("searchInput");

let currentDomains = [];

// Ripple effect
function addRipple(button) {
    button.style.position = "relative";
    button.style.overflow = "hidden";
    button.addEventListener("click", function (e) {
        const circle = document.createElement("span");
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${e.clientX - button.offsetLeft - radius}px`;
        circle.style.top = `${e.clientY - button.offsetTop - radius}px`;
        circle.style.position = "absolute";
        circle.style.borderRadius = "50%";
        circle.style.backgroundColor = "rgba(255, 255, 255, 0.6)";
        circle.style.transform = "scale(0)";
        circle.style.animation = "ripple 600ms linear";
        circle.classList.add("ripple");

        const oldRipple = button.getElementsByClassName("ripple")[0];
        if (oldRipple) oldRipple.remove();

        button.appendChild(circle);
    });
}

// Inject ripple CSS
const style = document.createElement("style");
style.textContent = `
@keyframes ripple {
  to { transform: scale(4); opacity: 0; }
}
button span.ripple { pointer-events: none; }
`;
document.head.appendChild(style);

// Domain validation
function isValidDomain(domain) {
    const domainRegex = /^(?!-)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
    return domainRegex.test(domain);
}

// Show messages
function showMessage(text, isError = true) {
    message.style.color = isError ? "red" : "green";
    message.textContent = text;
    setTimeout(() => { message.textContent = ""; }, 2500);
}

// Render whitelist (with optional filter)
function renderList(domains, filter = "") {
    domainList.innerHTML = "";

    const filtered = domains
        .filter(d => d.toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => a.localeCompare(b));

    filtered.forEach((domain, idx) => {
        const li = document.createElement("li");
        const span = document.createElement("span");
        span.textContent = domain;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        addRipple(removeBtn);
        removeBtn.addEventListener("click", () => {
            const newDomains = currentDomains.filter(d => d !== domain);
            chrome.storage.local.set({ whitelist: newDomains }, () => {
                currentDomains = newDomains;
                renderList(currentDomains, searchInput.value);
                showMessage(`Removed ${domain}`, false);
            });
        });

        li.appendChild(span);
        li.appendChild(removeBtn);
        domainList.appendChild(li);
    });
}

// Load saved whitelist
chrome.storage.local.get({ whitelist: [] }, (data) => {
    currentDomains = data.whitelist;
    renderList(currentDomains);
});

// Add new domain
addButton.addEventListener("click", () => {
    let domain = domainInput.value.trim();
    if (!domain) {
        showMessage("Please enter a domain.");
        return;
    }

    domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!isValidDomain(domain)) {
        showMessage("Invalid domain format.");
        return;
    }

    if (currentDomains.includes(domain)) {
        showMessage("This domain is already whitelisted.");
        return;
    }

    currentDomains.push(domain);
    chrome.storage.local.set({ whitelist: currentDomains }, () => {
        renderList(currentDomains, searchInput.value);
        showMessage(`Added ${domain}`, false);
        domainInput.value = "";
    });
});

// Search filter
searchInput.addEventListener("input", () => {
    renderList(currentDomains, searchInput.value);
});

// Apply ripple to Add button
addRipple(addButton);
