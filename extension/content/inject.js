/**
 * Isolated-world injector. Loads page.js into the page (MAIN) world
 * so we can patch YouTube player objects before ads initialize.
 * Only runs on YouTube matches declared in manifest.json.
 */
(function injectPageScript() {
  if (window.__ytAdblockInjected) return;
  window.__ytAdblockInjected = true;

  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("content/page.js");
  script.async = false;
  script.onload = () => script.remove();
  (document.documentElement || document.head || document).appendChild(script);
})();
