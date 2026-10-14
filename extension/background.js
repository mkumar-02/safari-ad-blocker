/**
 * Safari YouTube Ad Blocker — background service worker.
 * V1: YouTube hosts only. No telemetry. No remote code.
 */

const YOUTUBE_HOST_SUFFIXES = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "googlevideo.com",
];

function isYouTubeRelatedHost(hostname) {
  const host = (hostname || "").toLowerCase();
  return YOUTUBE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`)
  );
}

chrome.runtime.onInstalled.addListener(() => {
  // Intentionally quiet: no analytics, no remote fetches.
  console.info("[yt-adblock] installed — YouTube-only, local rules");
});

// Defensive: if Safari surfaces unexpected messages, ignore non-YouTube origins.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const url = sender.tab?.url || sender.url || "";
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    sendResponse({ ok: false });
    return false;
  }

  if (!isYouTubeRelatedHost(host)) {
    sendResponse({ ok: false, reason: "non-youtube" });
    return false;
  }

  if (message?.type === "ping") {
    sendResponse({ ok: true, scope: "youtube-only" });
    return false;
  }

  sendResponse({ ok: true });
  return false;
});
