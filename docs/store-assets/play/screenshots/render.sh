#!/usr/bin/env bash
# Re-render the Google Play phone screenshots from their HTML templates.
# Requires: google-chrome-stable + ImageMagick (convert). Output: 1080x2400
# 24-bit PNGs with no alpha (Play's screenshot requirement).
set -e
cd "$(dirname "$0")"
for html in [0-9][0-9]-*.html; do
  base="${html%.html}"
  google-chrome-stable --headless --no-sandbox --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=1 --window-size=1080,2400 --virtual-time-budget=4000 \
    --screenshot="$PWD/$base.raw.png" "file://$PWD/$html" 2>/dev/null
  convert "$base.raw.png" -alpha off -depth 8 "$base.png"
  rm -f "$base.raw.png"
  echo "rendered $base.png"
done
echo "done: $(ls [0-9][0-9]-*.png | wc -l) screenshots"
