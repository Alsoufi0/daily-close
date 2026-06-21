#!/usr/bin/env bash
# Robust render: headless Chrome's viewport renders ~87px shorter than --window-size,
# which clips the bottom of the design and backfills white. So we render with extra
# window height (the full design paints, top-anchored), then crop to EXACT design
# pixel dimensions from (0,0) — no clipping, no white band.
set -e
cd "$(dirname "$0")"

render() { # name baseW baseH scale
  local name=$1 bw=$2 bh=$3 s=$4
  local winH=$((bh + 220))
  google-chrome-stable --headless --no-sandbox --disable-gpu --hide-scrollbars \
    --force-device-scale-factor=$s --window-size=$bw,$winH --virtual-time-budget=12000 \
    --default-background-color=00000000 --screenshot="$name.png" "$name.html" >/dev/null 2>&1
  # flatten transparency to white, then crop to exact design size from top-left
  convert "$name.png" -background white -alpha remove -alpha off -depth 8 \
    -crop $((bw*s))x$((bh*s))+0+0 +repage "$name.png"
}

render flyer          850 1100 3
render flyer-es       850 1100 3
render flyer-ar       850 1100 3
render flyer-hi       850 1100 3
render ig-square     1080 1080 2
render ig-story      1080 1920 2
render trifold-outside 1100 850 3
render trifold-inside  1100 850 3

echo "--- final dimensions ---"
identify -format "%f  %wx%h\n" \
  flyer.png flyer-es.png flyer-ar.png flyer-hi.png \
  ig-square.png ig-story.png trifold-outside.png trifold-inside.png
echo "--- white-band check (content height after trimming bottom white; should equal full height) ---"
for f in flyer flyer-es flyer-ar flyer-hi ig-square ig-story trifold-outside trifold-inside; do
  H=$(identify -format "%h" "$f.png")
  T=$(convert "$f.png" -background white -fuzz 1% -define trim:edges=south -trim -format "%h" info: 2>/dev/null)
  echo "$f: height=$H content=$T band=$((H-T))px"
done
