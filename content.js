// -------------------------
// Global Autoplay Blocker
// -------------------------

let userInteracted = false;
let blockingEnabled = true;

// --- Load initial toggle state from storage ---
if (chrome?.storage?.local) {
    chrome.storage.local.get("autoplayBlockerEnabled", (data) => {
        if (typeof data.autoplayBlockerEnabled === "boolean") {
            blockingEnabled = data.autoplayBlockerEnabled;
        }
    });
}

// --- Listen for toggle updates from background.js ---
if (chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg && typeof msg.autoplayBlockerEnabled === "boolean") {
            blockingEnabled = msg.autoplayBlockerEnabled;
        }
    });
}

// --- Detect first user interaction (to allow play after click/keypress) ---
const markInteracted = () => { userInteracted = true; };
["pointerdown", "mousedown", "touchstart", "keydown", "click"].forEach(evt => {
    window.addEventListener(evt, markInteracted, { capture: true, once: true, passive: true });
});

// -------------------------
// Media Scrubbing
// -------------------------

function scrubMedia(el) {
    if (!(el instanceof HTMLMediaElement)) return;
    if (!blockingEnabled) return;

    // Remove autoplay/muted flags
    el.autoplay = false;
    el.muted = false;
    el.removeAttribute("autoplay");
    el.removeAttribute("muted");
    el.removeAttribute("autostart");

    // Pause if it already started
    if (!el.paused && !userInteracted) {
        try { el.pause(); } catch { }
    }
}

function scrubIframe(el) {
    if (!(el instanceof HTMLIFrameElement)) return;
    if (!blockingEnabled) return;

    const src = el.getAttribute("src");
    if (!src) return;
    try {
        const u = new URL(src, location.href);

        // Strip autoplay-related params
        ["autoplay", "auto_play", "autostart", "muted", "playsinline"].forEach(p => {
            u.searchParams.delete(p);
        });

        // Force autoplay=0 if param exists
        if (u.searchParams.has("autoplay")) {
            u.searchParams.set("autoplay", "0");
        }

        if (u.href !== src) {
            el.setAttribute("src", u.href);
        }
    } catch {
        // ignore malformed URLs
    }
}

// -------------------------
// Mutation Observer
// -------------------------

const mo = new MutationObserver((muts) => {
    for (const m of muts) {
        for (const node of m.addedNodes) {
            if (!(node instanceof Element)) continue;

            if (node instanceof HTMLMediaElement) {
                scrubMedia(node);
            } else if (node instanceof HTMLIFrameElement) {
                scrubIframe(node);
            }

            // Check descendants too
            node.querySelectorAll?.("video, audio, iframe").forEach(el => {
                if (el instanceof HTMLIFrameElement) scrubIframe(el);
                else scrubMedia(el);
            });
        }
    }
});
mo.observe(document.documentElement || document, { childList: true, subtree: true });

// Initial sweep
function initialSweep() {
    if (!blockingEnabled) return;
    document.querySelectorAll("video, audio, iframe").forEach(el => {
        if (el instanceof HTMLIFrameElement) scrubIframe(el);
        else scrubMedia(el);
    });
}
initialSweep();

// -------------------------
// Block play() until interaction
// -------------------------

document.addEventListener("play", (e) => {
    if (!blockingEnabled) return;
    const el = e.target;
    if (el instanceof HTMLMediaElement && !userInteracted) {
        try { el.pause(); } catch { }
    }
}, true);

// Patch play() to reject autoplay attempts
(function patchPlay() {
    const realPlay = HTMLMediaElement.prototype.play;
    if (!realPlay || realPlay.__autoplayPatched) return;

    function wrappedPlay(...args) {
        if (!blockingEnabled) {
            return realPlay.apply(this, args);
        }
        if (!userInteracted) {
            const err = new DOMException("Autoplay blocked by extension", "NotAllowedError");
            try { this.pause(); } catch { }
            return Promise.reject(err);
        }
        return realPlay.apply(this, args);
    }
    wrappedPlay.__autoplayPatched = true;
    HTMLMediaElement.prototype.play = wrappedPlay;
})();
