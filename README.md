# Safari YouTube Ad Blocker (V1)

Privacy-first **Safari** extension that blocks ads **only on YouTube**.

- Scope: `youtube.com`, `youtube-nocookie.com`, `youtu.be`
- No other websites
- No telemetry / analytics
- Rules and scripts ship with the extension (no remote code)

## How it works

Two layers:

1. **declarativeNetRequest** — blocks known YouTube ad/tracker network endpoints
2. **Page script (YouTube only)** — strips ad config from player JSON, intercepts ad media requests, removes overlays, and auto-skips leftover video ads

## Requirements

- macOS with **Safari 16.4+**
- **Xcode** (App Store) — needed to wrap the web extension as a Safari app
- An Apple ID for local signing (free personal team is enough for your Mac)

> Right now this machine has Command Line Tools only. Install full Xcode before converting.

## Project layout

```
extension/                 # Safari-compatible web extension (source of truth)
  manifest.json
  background.js
  rules/youtube_ads.json
  content/inject.js        # injects page.js into YouTube
  content/page.js          # MAIN-world YouTube ad patcher
  popup/
scripts/convert-to-safari.sh
```

## Build & enable in Safari

```bash
# 1) Install Xcode, then point developer tools at it:
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer

# 2) Generate the Safari / Xcode app wrapper
chmod +x scripts/convert-to-safari.sh
./scripts/convert-to-safari.sh

# 3) Open the generated project and Run (⌘R)
open safari/*.xcodeproj
```

Then in Safari:

1. **Settings → Extensions** → enable **YouTube Ad Blocker**
2. Allow access for YouTube when Safari asks
3. Open [youtube.com](https://www.youtube.com) and play a video

For local unsigned apps you may also need:

**Safari → Settings → Advanced → Show features for web developers**  
**Develop → Allow Unsigned Extensions** (re-enable after Safari restarts)

## Privacy model (V1)

| Capability | Present? |
|---|---|
| Runs on YouTube hosts only | Yes |
| Content script on other sites | No |
| Telemetry / crash phoning home | No |
| Remote filter downloads | No |
| Reads non-YouTube browsing | No |

The page script can see YouTube page content (required to defeat in-player ads). It does not run elsewhere.

## Limits (honest V1)

YouTube actively fights blockers. Expect:

- Occasional ads slipping through until rules/scripts are updated
- Rare “ad blocker detected” prompts (refresh usually helps)
- Server-side injected ads are harder; skip/fast-forward is the fallback

This is not Perfect Forever™ — it is a focused, auditable, YouTube-only Safari blocker you control.

## Development notes

- Edit files under `extension/`, then re-run the converter (or rebuild the Xcode app if it already embeds/copies Shared Resources)
- Prefer keeping host permissions minimal; do not add `<all_urls>`
- Never load remote JavaScript into the page script
