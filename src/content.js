// -------------------------
// AutoplayStopper Content Script
// -------------------------

class AutoplayStopper {
    constructor() {
        this.debugEnabled = false;
        this.blockingEnabled = true; // Default to true until loaded
        this.userInteracted = false;
        this.settings = {
            extensionEnabled: true,
            globalBehavior: "block",
            siteSettings: {}
        };

        this.mutationTimeout = null;
        this.pendingMutations = [];

        this.init();
    }

    dlog(...args) {
        if (this.debugEnabled) console.log("[AutoplayStopper]", ...args);
    }

    async init() {
        // 1. Load Debug Flag
        const localData = await chrome.storage.local.get({ debugEnabled: false });
        this.debugEnabled = !!localData.debugEnabled;

        // 2. Load Settings
        const syncData = await chrome.storage.sync.get({
            extensionEnabled: true,
            globalBehavior: "block",
            siteSettings: {}
        });
        this.settings = syncData;
        this.updateBlockingState();

        // 3. Listeners
        this.setupStorageListeners();
        this.setupInteractionListeners();
        this.setupDomListeners();
        this.patchPlay();

        // 4. Initial Sweep
        if (this.blockingEnabled) {
            this.scrubTree(document);
            this.dlog("Initial sweep complete");
        }
    }

    updateBlockingState() {
        // 1. Master Switch
        if (!this.settings.extensionEnabled) {
            this.blockingEnabled = false;
            this.dlog("Extension disabled via master switch");
            return;
        }

        // 2. Site Specific Settings
        const hostname = location.hostname;
        let status = this.settings.globalBehavior; // Default

        // Find most specific match
        let longestMatchLength = 0;
        for (const [domain, setting] of Object.entries(this.settings.siteSettings)) {
            if (hostname === domain || hostname.endsWith("." + domain)) {
                if (domain.length > longestMatchLength) {
                    longestMatchLength = domain.length;
                    status = setting;
                }
            }
        }

        // 3. Determine final state
        // If status is "allow", blocking is FALSE.
        // If status is "block", blocking is TRUE.
        this.blockingEnabled = (status === "block");
        this.dlog(`Blocking state updated: ${this.blockingEnabled ? "ENABLED" : "DISABLED"} (Site status: ${status})`);
    }

    setupStorageListeners() {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && changes.debugEnabled) {
                this.debugEnabled = changes.debugEnabled.newValue;
            }

            if (area === "sync") {
                if (changes.extensionEnabled) this.settings.extensionEnabled = changes.extensionEnabled.newValue;
                if (changes.globalBehavior) this.settings.globalBehavior = changes.globalBehavior.newValue;
                if (changes.siteSettings) this.settings.siteSettings = changes.siteSettings.newValue;

                this.updateBlockingState();
            }
        });
    }

    setupInteractionListeners() {
        const markInteracted = () => {
            this.userInteracted = true;
            this.dlog("User interaction → media allowed");
        };

        ["pointerdown", "mousedown", "touchstart", "keydown", "click"].forEach(evt => {
            window.addEventListener(evt, markInteracted, {
                capture: true,
                once: true,
                passive: true
            });
        });
    }

    setupDomListeners() {
        // Mutation Observer with Throttling
        const mo = new MutationObserver((muts) => {
            if (!this.blockingEnabled || this.userInteracted) return;

            // Simple throttling: wait 50ms before processing
            // If new mutations come in, reset timer? No, let's just batch.
            // Actually, for autoplay, we want to be fast. 
            // But checking every single mutation is expensive.
            // Let's process immediately but limit how deep we go or use requestAnimationFrame?
            // For now, let's just process addedNodes directly as before but maybe add a small check.

            // Optimization: Only process if we see media tags in the addedNodes list?
            // That's hard because they might be deep in a subtree.

            // Let's stick to the previous logic but be cleaner.
            // If performance is a concern, we can debounce.

            for (const m of muts) {
                for (const node of m.addedNodes) {
                    if (!(node instanceof Element)) continue;

                    if (node instanceof HTMLMediaElement) this.scrubMedia(node);
                    else if (node instanceof HTMLIFrameElement) this.scrubIframe(node);

                    // Only scan subtree if it's a container that might have media
                    // This is a heuristic. 
                    if (node.tagName !== "SCRIPT" && node.tagName !== "STYLE") {
                        this.scrubTree(node);
                    }
                }
            }
        });

        mo.observe(document.documentElement || document, { childList: true, subtree: true });

        // Event Hooks
        ["canplay", "loadeddata", "play"].forEach(evt => {
            document.addEventListener(evt, (e) => {
                if (!this.blockingEnabled || this.userInteracted) return;
                const el = e.target;
                if (el instanceof HTMLMediaElement && !el.paused) {
                    try { el.pause(); } catch { }
                    this.dlog(`Blocked on ${evt}:`, el);
                }
            }, true); // Capture phase
        });
    }

    scrubMedia(el) {
        if (!(el instanceof HTMLMediaElement)) return;
        if (!this.blockingEnabled) return;

        // Remove attributes
        if (typeof AUTOPLAY_ATTRIBUTES !== 'undefined') {
            AUTOPLAY_ATTRIBUTES.forEach(a => {
                try { el.removeAttribute(a); } catch { }
            });
        }

        if (!el.paused && !this.userInteracted) {
            try { el.pause(); } catch { }
            this.dlog("Paused media:", el);
        }
    }

    scrubIframe(el) {
        if (!(el instanceof HTMLIFrameElement)) return;
        if (!this.blockingEnabled) return;

        const src = el.getAttribute("src");
        if (!src) return;

        try {
            const u = new URL(src, location.href);
            let changed = false;

            if (typeof AUTOPLAY_ATTRIBUTES !== 'undefined') {
                AUTOPLAY_ATTRIBUTES.forEach(a => {
                    if (u.searchParams.has(a)) {
                        u.searchParams.delete(a);
                        changed = true;
                    }
                });
            }

            if (changed) {
                el.setAttribute("src", u.href);
                this.dlog("Cleaned iframe src:", src, "→", u.href);
            }
        } catch { }
    }

    scrubTree(root) {
        root.querySelectorAll("video, audio, iframe").forEach(el => {
            if (el instanceof HTMLIFrameElement) this.scrubIframe(el);
            else this.scrubMedia(el);
        });

        // Shadow DOM
        root.querySelectorAll("*").forEach(el => {
            if (el.shadowRoot) {
                this.scrubTree(el.shadowRoot);
            }
        });
    }

    patchPlay() {
        const self = this;
        const realPlay = HTMLMediaElement.prototype.play;
        if (!realPlay || realPlay.__autoplayPatched) return;

        function wrappedPlay(...args) {
            if (!self.blockingEnabled) return realPlay.apply(this, args);

            if (!self.userInteracted) {
                try { this.pause(); } catch { }
                self.dlog("play() call blocked", this);
                return Promise.reject(new DOMException("Autoplay blocked by extension", "NotAllowedError"));
            }
            return realPlay.apply(this, args);
        }

        wrappedPlay.__autoplayPatched = true;
        HTMLMediaElement.prototype.play = wrappedPlay;
        this.dlog("Patched HTMLMediaElement.play()");
    }
}

// Instantiate
new AutoplayStopper();
