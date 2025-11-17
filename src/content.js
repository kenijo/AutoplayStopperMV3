// -------------------------
// Global AutoplayStopper with Shadow DOM support
// -------------------------

const DEBUG = true; // set false to silence logs

chrome.storage.local.get({ whitelist: [] }, (data) => {
    const hostname = location.hostname;
    const isWhitelisted = data.whitelist.some(domain => hostname.endsWith(domain));

    if (isWhitelisted) {
        if (DEBUG) console.log("[AutoplayStopper] Disabled on whitelisted site:", hostname);
        return; // stop here, do not run AutoplayStopper
    }

    let userInteracted = false;
    let blockingEnabled = true;

    // Load initial toggle state
    if (chrome?.storage?.local) {
        chrome.storage.local.get("autoplayStopperEnabled", (data) => {
            if (typeof data.autoplayStopperEnabled === "boolean") {
                blockingEnabled = data.autoplayStopperEnabled;
            }
            if (DEBUG) console.log("[AutoplayStopper] Initial state:", blockingEnabled ? "ENABLED" : "DISABLED");
        });
    }

    // Listen for toggle updates
    if (chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg && typeof msg.autoplayStopperEnabled === "boolean") {
                blockingEnabled = msg.autoplayStopperEnabled;
                if (DEBUG) console.log("[AutoplayStopper] Toggled:", blockingEnabled ? "ENABLED" : "DISABLED");
            }
        });
    }

    // Detect first user interaction
    const markInteracted = (event) => {
        if (userInteracted) return;
        if (event && event.isTrusted === false) {
            if (DEBUG) console.log("[AutoplayStopper] Ignoring synthetic interaction:", event.type);
            return;
        }

        userInteracted = true;
        if (DEBUG) console.log("[AutoplayStopper] User interaction → media allowed");
    };
    ["pointerdown", "mousedown", "touchstart", "keydown", "click"].forEach(evt => {
        window.addEventListener(evt, markInteracted, { capture: true, once: true, passive: true });
    });

    // -------------------------
    // Core Media Scrubbing
    // -------------------------

    function scrubMedia(el) {
        if (!(el instanceof HTMLMediaElement)) return;
        if (!blockingEnabled) return;

        // Remove attributes (do not overwrite DOM methods)
        const attrs = [
            "auto_play",
            "autoplay",
            "autoPlay",
            "autostart",
            "autoStart",
            "autostarts",
            "autoStarts",
            "autostartup",
            "autoStartup",
            "playing",
            "playnext",
            "playNext",
            "playsInline",
            "playsinline"
        ];
        attrs.forEach(a => {
            try { el.removeAttribute(a); } catch { }
        });

        if (!el.paused && !userInteracted) {
            try { el.pause(); } catch { }
            if (DEBUG) console.log("[AutoplayStopper] Paused media:", el);
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
            const attrs = [
                "auto_play",
                "autoplay",
                "autoPlay",
                "autostart",
                "autoStart",
                "autostarts",
                "autoStarts",
                "autostartup",
                "autoStartup",
                "playing",
                "playnext",
                "playNext",
                "playsInline",
                "playsinline"
            ];

            attrs.forEach(a => {
                if (u.searchParams.has(a)) u.searchParams.delete(a);
            });

            if (src !== u.href) {
                el.setAttribute("src", u.href);
                if (DEBUG) console.log("[AutoplayStopper] Cleaned iframe src:", src, "→", u.href);
            }
        } catch { }
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
    function initialSweep() {
        if (!blockingEnabled) return;
        scrubTree(document);
        if (DEBUG) console.log("[AutoplayStopper] Initial sweep complete (with shadow DOM)");
    }
    initialSweep();

    // -------------------------
    // Mutation Observer
    // -------------------------

    const mo = new MutationObserver((muts) => {
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
    // Extra Event Hooks
    // -------------------------

    ["canplay", "loadeddata"].forEach(evt => {
        document.addEventListener(evt, (e) => {
            if (!blockingEnabled || userInteracted) return;
            const el = e.target;
            if (el instanceof HTMLMediaElement && !el.paused) {
                try { el.pause(); } catch { }
                if (DEBUG) console.log(`[AutoplayStopper] Blocked on ${evt}:`, el);
            }
        }, true);
    });

    // -------------------------
    // Aggressive watchdog loop
    // -------------------------

    const pauseLoop = setInterval(() => {
        if (!blockingEnabled || userInteracted) {
            clearInterval(pauseLoop);
            return;
        }
        scrubTree(document);
    }, 500);

    // -------------------------
    // Intercept play() calls
    // -------------------------

    document.addEventListener("play", (e) => {
        if (!blockingEnabled) return;
        const el = e.target;
        if (el instanceof HTMLMediaElement && !userInteracted) {
            try { el.pause(); } catch { }
            if (DEBUG) console.log("[AutoplayStopper] Intercepted play event:", el);
        }
    }, true);

    (function patchPlay() {
        const realPlay = HTMLMediaElement.prototype.play;
        if (!realPlay || realPlay.__autoplayPatched) return;

        function wrappedPlay(...args) {
            if (!blockingEnabled) return realPlay.apply(this, args);
            if (!userInteracted) {
                try { this.pause(); } catch { }
                if (DEBUG) console.log("[AutoplayStopper] play() call blocked", this);
                return Promise.reject(new DOMException("Autoplay blocked by extension", "NotAllowedError"));
            }
            return realPlay.apply(this, args);
        }
        wrappedPlay.__autoplayPatched = true;
        HTMLMediaElement.prototype.play = wrappedPlay;
        if (DEBUG) console.log("[AutoplayStopper] Patched HTMLMediaElement.play()");
    })();

});
