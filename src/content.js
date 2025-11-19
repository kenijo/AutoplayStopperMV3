// -------------------------
// Global AutoplayStopper with Shadow DOM support
// -------------------------

// DEBUG is controlled via storage
let debugEnabled = false;

// Debug helper
function dlog(...args) {
    if (debugEnabled) console.log("[AutoplayStopper]", ...args);
}

// Load debug flag initially
chrome.storage.local.get({ debugEnabled: false }, (data) => {
    debugEnabled = !!data.debugEnabled;
});

// Listen for debug flag changes
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes.debugEnabled) {
        debugEnabled = changes.debugEnabled.newValue;
        dlog("Debug logging", debugEnabled ? "ENABLED" : "DISABLED");
    }
});

chrome.storage.local.get({ whitelist: [] }, (data) => {
    const hostname = location.hostname;
    const isWhitelisted = data.whitelist.some(domain => hostname.endsWith(domain));

    if (isWhitelisted) {
        dlog("Disabled on whitelisted site:", hostname);
        return; // stop here, do not run AutoplayStopper
    }

    let userInteracted = false;
    let blockingEnabled = true;

    // Load initial toggle state (global enable/disable)
    chrome.storage.local.get("autoplayStopperEnabled", (data) => {
        if (typeof data.autoplayStopperEnabled === "boolean") {
            blockingEnabled = data.autoplayStopperEnabled;
        }
        dlog("Initial state:", blockingEnabled ? "ENABLED" : "DISABLED");
    });

    // Listen for global toggle updates (popup)
    chrome.runtime.onMessage?.addListener((msg) => {
        if (msg && typeof msg.autoplayStopperEnabled === "boolean") {
            blockingEnabled = msg.autoplayStopperEnabled;
            dlog("Toggled:", blockingEnabled ? "ENABLED" : "DISABLED");
        }
    });

    // Detect first user interaction
    const markInteracted = () => {
        userInteracted = true;
        dlog("User interaction → media allowed");
    };
    ["pointerdown", "mousedown", "touchstart", "keydown", "click"].forEach(evt => {
        window.addEventListener(evt, markInteracted, {
            capture: true,
            once: true,
            passive: true
        });
    });

    // Live storage sync for global toggle + whitelist
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;

        if (changes.autoplayStopperEnabled) {
            blockingEnabled = changes.autoplayStopperEnabled.newValue;
            dlog("Storage toggle →", blockingEnabled ? "ENABLED" : "DISABLED");
        }

        if (changes.whitelist) {
            const updatedWhitelist = changes.whitelist.newValue || [];
            const nowWhitelisted = updatedWhitelist.some(d => hostname.endsWith(d));

            if (nowWhitelisted) {
                dlog("This site was just whitelisted → disabling blocking");
                blockingEnabled = false;
            }
        }
    });

    // -------------------------
    // Core Media Scrubbing
    // -------------------------
    function scrubMedia(el) {
        if (!(el instanceof HTMLMediaElement)) return;
        if (!blockingEnabled) return;

        // Remove attributes (do not overwrite DOM methods)
        // AUTOPLAY_ATTRIBUTES is defined in constants.js
        if (typeof AUTOPLAY_ATTRIBUTES !== 'undefined') {
            AUTOPLAY_ATTRIBUTES.forEach(a => {
                try { el.removeAttribute(a); } catch { }
            });
        }

        if (!el.paused && !userInteracted) {
            try { el.pause(); } catch { }
            dlog("Paused media:", el);
        }
    }

    function scrubIframe(el) {
        if (!(el instanceof HTMLIFrameElement)) return;
        if (!blockingEnabled) return;

        const src = el.getAttribute("src");
        if (!src) return;

        try {
            const u = new URL(src, location.href);

            // Remove attributes (do not overwrite DOM methods)
            if (typeof AUTOPLAY_ATTRIBUTES !== 'undefined') {
                AUTOPLAY_ATTRIBUTES.forEach(a => {
                    if (u.searchParams.has(a)) u.searchParams.delete(a);
                });
            }

            if (src !== u.href) {
                el.setAttribute("src", u.href);
                dlog("Cleaned iframe src:", src, "→", u.href);
            }
        } catch {
            // ignore bad URLs
        }
    }

    // -------------------------
    // Shadow DOM Traversal
    // -------------------------
    function scrubTree(root) {
        root.querySelectorAll("video, audio, iframe").forEach(el => {
            if (el instanceof HTMLIFrameElement) scrubIframe(el);
            else scrubMedia(el);
        });

        // Recurse into open shadow roots
        root.querySelectorAll("*").forEach(el => {
            if (el.shadowRoot) {
                scrubTree(el.shadowRoot);
            }
        });
    }

    // Initial sweep
    scrubTree(document);
    dlog("Initial sweep complete");

    // -------------------------
    // Mutation Observer
    // -------------------------
    const mo = new MutationObserver((muts) => {
        if (!blockingEnabled || userInteracted) return;

        for (const m of muts) {
            for (const node of m.addedNodes) {
                if (!(node instanceof Element)) continue;

                if (node instanceof HTMLMediaElement) scrubMedia(node);
                else if (node instanceof HTMLIFrameElement) scrubIframe(node);

                // Also scan this subtree
                scrubTree(node);
            }
        }
    });
    mo.observe(document.documentElement || document, { childList: true, subtree: true });

    // -------------------------
    // Event Hooks
    // -------------------------
    ["canplay", "loadeddata"].forEach(evt => {
        document.addEventListener(evt, (e) => {
            if (!blockingEnabled || userInteracted) return;
            const el = e.target;
            if (el instanceof HTMLMediaElement && !el.paused) {
                try { el.pause(); } catch { }
                dlog(`Blocked on ${evt}:`, el);
            }
        }, true);
    });

    // -------------------------
    // Intercept play() calls
    // -------------------------
    document.addEventListener("play", (e) => {
        if (!blockingEnabled) return;
        const el = e.target;
        if (el instanceof HTMLMediaElement && !userInteracted) {
            try { el.pause(); } catch { }
            dlog("Intercepted play event:", el);
        }
    }, true);

    // Patch play()
    (function patchPlay() {
        const realPlay = HTMLMediaElement.prototype.play;
        if (!realPlay || realPlay.__autoplayPatched) return;

        function wrappedPlay(...args) {
            if (!blockingEnabled) return realPlay.apply(this, args);

            // Allow play if user interacted OR if the call is trusted (user initiated)
            // Note: isTrusted is not available on function calls, but we rely on our global userInteracted flag
            if (!userInteracted) {
                try { this.pause(); } catch { }
                dlog("play() call blocked", this);
                return Promise.reject(new DOMException("Autoplay blocked by extension", "NotAllowedError"));
            }
            return realPlay.apply(this, args);
        }

        wrappedPlay.__autoplayPatched = true;
        HTMLMediaElement.prototype.play = wrappedPlay;
        dlog("Patched HTMLMediaElement.play()");
    })();

});
