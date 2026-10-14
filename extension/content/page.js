/**
 * MAIN-world YouTube ad patcher (Safari V1).
 * Layers:
 *  1. Strip ad config from player JSON / ytInitialPlayerResponse
 *  2. Intercept fetch / XHR ad payloads and googlevideo ad tiers
 *  3. Remove ad DOM + auto-skip / fast-forward leftover ads
 */
(function youtubeAdBlockerPage() {
  if (window.__ytAdblockPage) return;
  window.__ytAdblockPage = true;

  const AD_JSON_KEYS = new Set([
    "adPlacements",
    "adSlots",
    "playerAds",
    "adBreakHeartbeatParams",
    "adBreaks",
    "adPlacementConfigs",
  ]);

  const AD_ENDPOINT_MARKERS = [
    "/pagead/",
    "/api/stats/ads",
    "/api/stats/atr",
    "/ptracking",
    "/pcs/activeview",
    "/youtubei/v1/player/ad_break",
    "doubleclick.net",
    "googleadservices.com",
    "googlesyndication.com",
  ];

  function isAdVideoUrl(url) {
    if (typeof url !== "string") return false;
    if (!url.includes("googlevideo.com/videoplayback")) return false;
    return /[?&]ctier=(SA|SR)\b/.test(url) || /[?&]adformat=/.test(url);
  }

  function isAdEndpoint(url) {
    if (typeof url !== "string") return false;
    return AD_ENDPOINT_MARKERS.some((marker) => url.includes(marker));
  }

  function pruneAds(value) {
    if (!value || typeof value !== "object") return value;

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        pruneAds(value[i]);
      }
      return value;
    }

    for (const key of Object.keys(value)) {
      if (AD_JSON_KEYS.has(key)) {
        value[key] = Array.isArray(value[key]) ? [] : undefined;
        continue;
      }
      pruneAds(value[key]);
    }

    // Common nested player shapes
    if (value.playerResponse) pruneAds(value.playerResponse);
    if (value.player) pruneAds(value.player);

    return value;
  }

  function scrubTextPayload(text) {
    if (typeof text !== "string" || text.length < 20) return text;
    if (
      !text.includes("adPlacements") &&
      !text.includes("playerAds") &&
      !text.includes("adSlots")
    ) {
      return text;
    }
    try {
      const parsed = JSON.parse(text);
      pruneAds(parsed);
      return JSON.stringify(parsed);
    } catch {
      // Cheap rename fallback if payload isn't pure JSON
      return text
        .replace(/"adPlacements"/g, '"_adPlacements"')
        .replace(/"playerAds"/g, '"_playerAds"')
        .replace(/"adSlots"/g, '"_adSlots"');
    }
  }

  function lockPlayerResponse(target, prop) {
    if (!target) return;
    let current = target[prop];
    if (current && typeof current === "object") pruneAds(current);

    try {
      Object.defineProperty(target, prop, {
        configurable: true,
        enumerable: true,
        get() {
          return current;
        },
        set(next) {
          current = next && typeof next === "object" ? pruneAds(next) : next;
        },
      });
    } catch {
      // Property may already be non-configurable
    }
  }

  // --- Initial bootstrap objects ---
  lockPlayerResponse(window, "ytInitialPlayerResponse");
  lockPlayerResponse(window, "ytInitialData");

  // Keep pruning if YouTube replaces the object later
  const bootstrapWatcher = setInterval(() => {
    lockPlayerResponse(window, "ytInitialPlayerResponse");
    lockPlayerResponse(window, "ytInitialData");
  }, 50);
  setTimeout(() => clearInterval(bootstrapWatcher), 15000);

  // --- JSON.parse hook ---
  const nativeParse = JSON.parse;
  JSON.parse = function patchedParse(text, reviver) {
    const result = nativeParse.call(this, text, reviver);
    return pruneAds(result);
  };

  // --- fetch hook ---
  const nativeFetch = window.fetch;
  window.fetch = async function patchedFetch(input, init) {
    const url =
      typeof input === "string"
        ? input
        : input && typeof input.url === "string"
          ? input.url
          : "";

    if (isAdVideoUrl(url) || isAdEndpoint(url)) {
      return new Response("", { status: 204, statusText: "No Content" });
    }

    const response = await nativeFetch.apply(this, arguments);

    if (
      url.includes("/youtubei/v1/player") ||
      url.includes("/youtubei/v1/next") ||
      url.includes("/youtubei/v1/browse")
    ) {
      try {
        const clone = response.clone();
        const text = await clone.text();
        const scrubbed = scrubTextPayload(text);
        return new Response(scrubbed, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch {
        return response;
      }
    }

    return response;
  };

  // --- XHR hook ---
  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
    this.__ytAdUrl = typeof url === "string" ? url : "";
    this.__ytAdBlock =
      isAdVideoUrl(this.__ytAdUrl) || isAdEndpoint(this.__ytAdUrl);
    return nativeOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function patchedSend(body) {
    if (this.__ytAdBlock) {
      Object.defineProperty(this, "readyState", { configurable: true, get: () => 4 });
      Object.defineProperty(this, "status", { configurable: true, get: () => 204 });
      Object.defineProperty(this, "responseText", {
        configurable: true,
        get: () => "",
      });
      this.dispatchEvent(new Event("readystatechange"));
      this.dispatchEvent(new Event("load"));
      this.dispatchEvent(new Event("loadend"));
      return;
    }

    this.addEventListener("readystatechange", function onReady() {
      if (this.readyState !== 4) return;
      const url = this.__ytAdUrl || "";
      if (
        !url.includes("/youtubei/v1/player") &&
        !url.includes("/youtubei/v1/next") &&
        !url.includes("/youtubei/v1/browse")
      ) {
        return;
      }
      try {
        const scrubbed = scrubTextPayload(this.responseText);
        if (scrubbed !== this.responseText) {
          Object.defineProperty(this, "responseText", {
            configurable: true,
            get: () => scrubbed,
          });
          Object.defineProperty(this, "response", {
            configurable: true,
            get: () => scrubbed,
          });
        }
      } catch {
        // ignore
      }
    });

    return nativeSend.apply(this, arguments);
  };

  // --- DOM / player fallbacks ---
  const AD_SELECTORS = [
    ".video-ads.ytp-ad-module",
    ".ytp-ad-player-overlay",
    ".ytp-ad-overlay-container",
    ".ytp-ad-skip-button",
    ".ytp-ad-skip-button-modern",
    ".ytp-skip-ad-button",
    "ytd-ad-slot-renderer",
    "ytd-player-legacy-desktop-watch-ads-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-banner-promo-renderer",
    "ytd-statement-banner-renderer",
    "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-ads']",
    "#player-ads",
    "#masthead-ad",
    "ytd-action-companion-renderer",
    "ytd-display-ad-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "tp-yt-paper-dialog:has(#feedback)",
    "ytd-enforcement-message-view-model",
  ];

  function clickSkipButtons() {
    const buttons = document.querySelectorAll(
      [
        ".ytp-ad-skip-button",
        ".ytp-ad-skip-button-modern",
        ".ytp-skip-ad-button",
        ".ytp-ad-skip-button-container button",
        "button.ytp-ad-skip-button-modern",
      ].join(",")
    );
    buttons.forEach((btn) => {
      try {
        btn.click();
      } catch {
        // ignore
      }
    });
  }

  function removeAdNodes() {
    for (const selector of AD_SELECTORS) {
      let nodes;
      try {
        nodes = document.querySelectorAll(selector);
      } catch {
        continue;
      }
      nodes.forEach((node) => {
        try {
          node.remove();
        } catch {
          // ignore
        }
      });
    }
  }

  function fastForwardAdIfNeeded() {
    const player = document.querySelector(".html5-video-player.ad-showing");
    if (!player) return;

    clickSkipButtons();

    const video = player.querySelector("video");
    if (!video) return;

    try {
      video.muted = true;
      if (video.playbackRate < 16) video.playbackRate = 16;
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.max(0, video.duration - 0.1);
      }
    } catch {
      // ignore
    }
  }

  function tick() {
    removeAdNodes();
    clickSkipButtons();
    fastForwardAdIfNeeded();
  }

  const observer = new MutationObserver(() => tick());

  function startDomWatch() {
    if (!document.documentElement) return;
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    tick();
    setInterval(tick, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startDomWatch, {
      once: true,
    });
  } else {
    startDomWatch();
  }
})();
