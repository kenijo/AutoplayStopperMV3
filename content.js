(function () {
  const mediaTags = ["video", "audio"];

  // Override play() globally to block autoplay unless user-initiated
  function overridePlay(media) {
    if (media._playOverridden) return;
    const originalPlay = media.play;
    media.play = function () {
      if (document.userActivation?.hasBeenActive) {
        return originalPlay.call(this);
      } else {
        // console.warn("Blocked autoplay attempt:", media);
        return Promise.reject("Autoplay blocked by extension.");
      }
    };
    media._playOverridden = true;
  }

  function disableAutoplay(media) {
    if (!media) return;
    try {
      media.autoplay = false;
      media.preload = "none";
      media.pause();

      media.removeAttribute("autoplay");
      overridePlay(media);

      // Extra: block any autoplay after source change
      media.addEventListener("loadedmetadata", () => {
        media.pause();
      });

      // Prevent browser re-attempts (once)
      const preventReattempt = (e) => {
        if (!document.userActivation?.hasBeenActive) {
          media.pause();
          // console.warn("Autoplay attempt blocked; removing listener.");
          media.removeEventListener("play", preventReattempt);
        }
      };
      media.addEventListener("play", preventReattempt);

    } catch (err) {
      // console.warn("Error disabling autoplay on element:", media, err);
    }
  }

  function blockExistingMedia() {
    mediaTags.forEach(tag => {
      document.querySelectorAll(tag).forEach(disableAutoplay);
    });
  }

  // Block media in new DOM nodes
  const observer = new MutationObserver(mutations => {
    mutations.forEach(m => {
      m.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;

        if (mediaTags.includes(node.tagName?.toLowerCase())) {
          disableAutoplay(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll(mediaTags.join(",")).forEach(disableAutoplay);
        }
      });
    });
  });

  function startObserver() {
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      blockExistingMedia();
    } else {
      // Retry if body not ready yet
      setTimeout(startObserver, 50);
    }
  }

  startObserver();
})();
