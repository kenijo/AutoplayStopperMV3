// -------------------------
// Global Autoplay Blocker with Shadow DOM support
// -------------------------

// Early return if whitelisted
chrome.storage.local.get({ whitelist: [] }, ({ whitelist }) => {
    const hostname = location.hostname;
    if (whitelist.some(domain => hostname.endsWith(domain))) {
        console.debug("[AutoplayBlocker] Disabled on whitelisted site:", hostname);
        return;
    }

    // Constants and state
    const DEBUG = false;
    const AUTOPLAY_ATTRS = [
        "autoplay",
		"auto_play",
		"autoPlay",
		"autostart",
		"autoStart",
        "autostarts",
		"autoStarts",
		"autostartup",
		"autoStartup",
        "play",
		"playing",
		"playnext",
		"playNext",
		"playsinline",
		"playsInline"
    ];
    const IFRAME_PARAMS = [
        "autoplay",
		"auto_play",
		"autostart",
		"autoStart",
		"muted",
        "playsinline"
    ];

    let userInteracted = false;
    let blockingEnabled = true;

    // --- State Management ---
    const initState = () => {
        chrome.storage.local.get("AutoplayStopperEnabled", ({ AutoplayStopperEnabled }) => {
            if (typeof AutoplayStopperEnabled === "boolean") {
                blockingEnabled = AutoplayStopperEnabled;
            }
            DEBUG && console.log("[AutoplayStopper] Initial state:", blockingEnabled ? "ENABLED" : "DISABLED");
        });
    };

    const setupMessageListener = () => {
        chrome.runtime.onMessage?.addListener((msg) => {
            if (msg?.AutoplayStopperEnabled === true || msg?.AutoplayStopperEnabled === false) {
                blockingEnabled = msg.AutoplayStopperEnabled;
                DEBUG && console.log("[AutoplayStopper] Toggled:", blockingEnabled ? "ENABLED" : "DISABLED");
            }
        });
    };

    // --- User Interaction ---
    const setupInteractionListeners = () => {
        const markInteracted = () => {
            userInteracted = true;
            DEBUG && console.log("[AutoplayStopper] User interaction → media allowed");
        };

        ["pointerdown", "mousedown", "touchstart", "keydown", "click"]
            .forEach(evt => window.addEventListener(evt, markInteracted, {
                capture: true,
                once: true,
                passive: true
            }));
    };

    // --- Media Scrubbing ---
    const scrubMediaElement = (el) => {
        if (!(el instanceof HTMLMediaElement) || !blockingEnabled) return;

        // Remove all autoplay-related attributes
        AUTOPLAY_ATTRS.forEach(attr => el.removeAttribute(attr));

        // Reset properties
        el.autoplay = false;
        el.muted = false;

        if (!el.paused && !userInteracted) {
            try {
                el.pause();
                DEBUG && console.log("[AutoplayStopper] Paused media:", el);
            } catch (e) {
                DEBUG && console.warn("[AutoplayStopper] Pause failed:", e);
            }
        }
    };

    const scrubIframe = (el) => {
        if (!(el instanceof HTMLIFrameElement) || !blockingEnabled) return;

        try {
            const url = new URL(el.src, location.href);
            let modified = false;

            IFRAME_PARAMS.forEach(param => {
                if (url.searchParams.has(param)) {
                    url.searchParams.delete(param);
                    modified = true;
                }
            });

            if (modified) {
                el.src = url.href;
                DEBUG && console.log("[AutoplayStopper] Cleaned iframe src:", el);
            }
        } catch (e) {
            DEBUG && console.warn("[AutoplayStopper] Iframe scrub failed:", e);
        }
    };

    // --- DOM Traversal ---
    const scrubTree = (root) => {
        if (!blockingEnabled) return;

        // Process media elements and iframes
        root.querySelectorAll("video, audio, iframe").forEach(el => {
            el instanceof HTMLIFrameElement ? scrubIframe(el) : scrubMediaElement(el);
        });

        // Recurse into shadow DOM
        root.querySelectorAll("*").forEach(el => {
            if (el.shadowRoot) scrubTree(el.shadowRoot);
        });
    };

    // --- Event Hooks ---
    const setupEventHooks = () => {
        // Media event listeners
        ["canplay", "loadeddata"].forEach(evt => {
            document.addEventListener(evt, (e) => {
                if (!blockingEnabled || userInteracted) return;
                const el = e.target;
                if (el instanceof HTMLMediaElement && !el.paused) {
                    try { el.pause(); } catch { }
                    DEBUG && console.log(`[AutoplayStopper] Blocked on ${evt}:`, el);
                }
            }, true);
        });

        // Play event interception
        document.addEventListener("play", (e) => {
            if (!blockingEnabled || userInteracted) return;
            const el = e.target;
            if (el instanceof HTMLMediaElement) {
                try { el.pause(); } catch { }
                DEBUG && console.log("[AutoplayStopper] Intercepted play event:", el);
            }
        }, true);
    };

    // --- Play Method Patching ---
    const patchPlayMethod = () => {
        const originalPlay = HTMLMediaElement.prototype.play;
        if (!originalPlay || originalPlay.__autoplayPatched) return;

        const wrappedPlay = function (...args) {
            if (!blockingEnabled) return originalPlay.apply(this, args);
            if (!userInteracted) {
                try { this.pause(); } catch { }
                DEBUG && console.log("[AutoplayStopper] play() call blocked", this);
                return Promise.reject(new DOMException("Autoplay blocked by extension", "NotAllowedError"));
            }
            return originalPlay.apply(this, args);
        };

        wrappedPlay.__autoplayPatched = true;
        HTMLMediaElement.prototype.play = wrappedPlay;
        DEBUG && console.log("[AutoplayStopper] Patched HTMLMediaElement.play()");
    };

    // --- Initialization ---
    const init = () => {
        initState();
        setupMessageListener();
        setupInteractionListeners();
        setupEventHooks();
        patchPlayMethod();

        // Initial sweep
        scrubTree(document);
        DEBUG && console.log("[AutoplayStopper] Initial sweep complete");

        // Mutation Observer
        const observer = new MutationObserver((mutations) => {
            for (const { addedNodes } of mutations) {
                for (const node of addedNodes) {
                    if (!(node instanceof Element)) continue;
                    if (node instanceof HTMLMediaElement) scrubMediaElement(node);
                    else if (node instanceof HTMLIFrameElement) scrubIframe(node);
                    scrubTree(node);
                }
            }
        });

        observer.observe(document, { childList: true, subtree: true });

        // Watchdog loop
        const watchdog = setInterval(() => {
            if (!blockingEnabled || userInteracted) {
                clearInterval(watchdog);
                return;
            }
            scrubTree(document);
        }, 1000);
    };

    // Start the extension
    init();
});
