#!/usr/bin/env bash
# Converts the web extension into an Xcode Safari Web Extension app.
# Requires full Xcode (not just Command Line Tools).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXTENSION_DIR="$ROOT/extension"
OUT_DIR="$ROOT/safari"

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "error: Xcode is required."
  echo "Install Xcode from the App Store, then run:"
  echo "  sudo xcode-select -s /Applications/Xcode.app/Contents/Developer"
  exit 1
fi

if ! xcrun --find safari-web-extension-converter >/dev/null 2>&1; then
  echo "error: safari-web-extension-converter not found."
  echo "Open Xcode once to install additional components, then retry."
  exit 1
fi

mkdir -p "$OUT_DIR"

echo "Converting $EXTENSION_DIR → $OUT_DIR"
xcrun safari-web-extension-converter "$EXTENSION_DIR" \
  --project-location "$OUT_DIR" \
  --app-name "YouTube Ad Blocker" \
  --bundle-identifier "com.local.youtube-ad-blocker" \
  --swift \
  --force \
  --no-prompt \
  --macos-only

echo
echo "Done. Next:"
echo "  1. open \"$OUT_DIR\"/*.xcodeproj"
echo "  2. Select your Team under Signing & Capabilities"
echo "  3. Product → Run"
echo "  4. Safari → Settings → Extensions → enable YouTube Ad Blocker"
echo "  5. Allow access for youtube.com when prompted"
