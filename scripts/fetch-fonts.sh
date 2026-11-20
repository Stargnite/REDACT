#!/usr/bin/env bash
#
# Downloads the three typefaces into public/fonts/ as self-hosted woff2.
# Run once from a terminal with network access:
#
#   ./scripts/fetch-fonts.sh
#
# The site builds and runs without these files — it falls back to a serif /
# sans / mono stack that reads well on every platform. Dropping these in
# upgrades it to the intended design with no code change.

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/public/fonts"
OG_DIR="$DIR/og"
mkdir -p "$DIR"

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

# Prints "<font-style> <url>" for each latin subset of a family, in the
# order Google Fonts returns them. The latin block is the one whose
# unicode-range covers U+0000-00FF; the others are language extensions.
latin_faces() {
  curl -fsSL -A "$UA" "$1" |
    awk '
      /font-style:/  { style = $0; sub(/.*font-style: */, "", style); sub(/;.*/, "", style) }
      /src: url\(/   { url = $0; sub(/.*url\(/, "", url); sub(/\).*/, "", url) }
      /unicode-range:/ {
        range = $0
        if (index(range, "U+0000-00FF") > 0) print style " " url
      }
    '
}

fetch() {
  local url="$1" out="$2"
  if [ -s "$out" ]; then
    echo "skip  $(basename "$out") (already present)"
    return
  fi
  echo "get   $(basename "$out")"
  curl -fsSL -A "$UA" "$url" -o "$out"
}

# family query -> roman file, italic file (italic optional)
family() {
  local query="$1" roman="$2" italic="${3:-}"
  local style url

  while read -r style url; do
    [ -z "$style" ] && continue
    if [ "$style" = "normal" ]; then
      fetch "$url" "$DIR/$roman"
    elif [ -n "$italic" ]; then
      fetch "$url" "$DIR/$italic"
    fi
  done < <(latin_faces "$query")
}

# Same faces, but the request goes out with an old User-Agent so Google serves
# TrueType instead of woff2 — satori (the Open Graph renderer) can only read
# ttf/otf/woff. That CSS carries no unicode-range, so the last block per style
# is taken; Google orders subsets with latin last.
ttf_family() {
  local query="$1" roman="$2" italic="${3:-}"
  local style url

  while read -r style url; do
    [ -z "$style" ] && continue
    if [ "$style" = "normal" ]; then
      fetch "$url" "$OG_DIR/$roman"
    elif [ -n "$italic" ]; then
      fetch "$url" "$OG_DIR/$italic"
    fi
  done < <(curl -fsSL -A "Mozilla/4.0" "$query" | awk '
      /font-style:/  { style = $0; sub(/.*font-style: */, "", style); sub(/;.*/, "", style) }
      /src: url\(/   { url = $0; sub(/.*url\(/, "", url); sub(/\).*/, "", url); last[style] = url }
      END { for (s in last) print s " " last[s] }
    ')
}

echo "resolving Instrument Serif..."
family "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&display=swap" \
  "instrument-serif.woff2" "instrument-serif-italic.woff2"

echo "resolving Geist..."
family "https://fonts.googleapis.com/css2?family=Geist:wght@300..700&display=swap" \
  "geist.woff2"

echo "resolving Geist Mono..."
family "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400..600&display=swap" \
  "geist-mono.woff2"

# The Open Graph image is rendered by satori, which cannot read woff2.
# Fetch TrueType versions of the same two faces for that one route.
mkdir -p "$OG_DIR"

echo "resolving Instrument Serif (truetype, for the OG image)..."
ttf_family "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&display=swap" \
  "instrument-serif.ttf" "instrument-serif-italic.ttf"

echo "resolving Geist (truetype, for the OG image)..."
# A single weight, not a range: the variable font renders at its heaviest
# instance under satori, which is not the weight the site uses.
ttf_family "https://fonts.googleapis.com/css2?family=Geist:wght@400&display=swap" \
  "geist.ttf"

echo
echo "done — fonts in $DIR"
ls -la "$DIR"
