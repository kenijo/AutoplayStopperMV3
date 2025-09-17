// -------------------------
// Global Autoplay Blocker with Shadow DOM support
// -------------------------

chrome.storage.local.get({ whitelist: [] }, (data) => {
    const hostname = location.hostname;
    const isWhitelisted = data.whitelist.some(domain => hostname.endsWith(domain));

    if (isWhitelisted) {
        if (DEBUG) console.log("[AutoplayBlocker] Disabled on whitelisted site:", hostname);
        return; // stop here, do not run autoplay blocking
    }

    const DEBUG = true; // set false to silence logs

    let userInteracted = false;
    let blockingEnabled = true;

    // --- Load initial toggle state ---
    if (chrome?.storage?.local) {
        chrome.storage.local.get("AutoplayStopperEnabled", (data) => {
            if (typeof data.AutoplayStopperEnabled === "boolean") {
                blockingEnabled = data.AutoplayStopperEnabled;
            }
            if (DEBUG) console.log("[AutoplayStopper] Initial state:", blockingEnabled ? "ENABLED" : "DISABLED");
        });
    }

    // --- Listen for toggle updates ---
    if (chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((msg) => {
            if (msg && typeof msg.AutoplayStopperEnabled === "boolean") {
                blockingEnabled = msg.AutoplayStopperEnabled;
                if (DEBUG) console.log("[AutoplayStopper] Toggled:", blockingEnabled ? "ENABLED" : "DISABLED");
            }
        });
    }

    // --- Detect first user interaction ---
    const markInteracted = () => {
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

        el.auto_play = false;
        el.autoplay = false;
        el.autoPlay = false;
        el.autostart = false;
        el.autoStart = false;
        el.autostarts = false;
        el.autoStarts = false;
        el.autostartup = false;
        el.autoStartup = false;
        //el.mute = false;
        //el.muted = false;
        el.play = false;
        el.playing = false;
        el.playnext = false;
        el.playNext = false;
        el.playsinline = false;
        el.playsInline = false;
        //el.startmuted = false;
        //el.startMuted = false;

        el.removeAttribute("auto_play");
        el.removeAttribute("autoplay");
        el.removeAttribute("autoPlay");
        el.removeAttribute("autostart");
        el.removeAttribute("autoStart");
        el.removeAttribute("autostarts");
        el.removeAttribute("autoStarts");
        el.removeAttribute("autostartup");
        el.removeAttribute("autoStartup");
        //el.removeAttribute("mute");
        //el.removeAttribute("muted");
        el.removeAttribute("play");
        el.removeAttribute("playing");
        el.removeAttribute("playnext");
        el.removeAttribute("playNext");
        el.removeAttribute("playsinline");
        el.removeAttribute("playsInline");
        //el.removeAttribute("startmuted");
        //el.removeAttribute("startMuted");

        if (!el.paused && !userInteracted) {
            try { el.pause(); } catch { }
            el.muted = false; // close Chrome’s “muted autoplay” loophole
            if (DEBUG) console.log("[AutoplayStopper] Paused video/audio:", el);
        }
    }

    function scrubIframe(el) {
        if (!(el instanceof HTMLIFrameElement)) return;
        if (!blockingEnabled) return;

        const src = el.getAttribute("src");
        if (!src) return;
        try {
            const u = new URL(src, location.href);
            ["autoplay", "auto_play", "autostart", "autoStart", "muted", "playsinline"].forEach(p => {
                if (u.searchParams.has(p)) u.searchParams.delete(p);
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
