#!/bin/bash
# Clear re-downloadable caches only. No source code, no browser profiles, no models.
set -u
C="$HOME/Library/Caches"

echo "=== removing re-downloadable caches ==="
for t in \
  "$C/com.microsoft.VSCode.ShipIt" \
  "$C/com.anthropic.claudefordesktop.ShipIt" \
  "$C/com.tinyspeck.slackmacgap.ShipIt" \
  "$C/puccinialn" \
  "$C/Homebrew" \
  "$C/pip" \
  "$C/typescript" \
  "$C/electron" \
  "$C/next-swc" \
  "$C/node-gyp" \
  "$C/kilo" \
  "$C/node" \
  "$C/pnpm" \
  "$HOME/.cache/uv" \
  "$HOME/.cache/kilo" \
  "$HOME/.cache/node" \
  "$HOME/.npm/_npx" \
  "$HOME/.npm/_logs"
do
  if [ -e "$t" ]; then
    s=$(du -sh "$t" 2>/dev/null | cut -f1)
    rm -rf "$t" 2>/dev/null && echo "  removed $s  ${t/#$HOME/~}"
  fi
done

echo
echo "=== chrome http/gpu cache only (model + profile untouched) ==="
for p in "$C/Google/Chrome"/*/Cache "$C/Google/Chrome"/*/Code\ Cache "$C/Google/Chrome"/*/GPUCache "$C/Google/Chrome"/*/Service\ Worker/CacheStorage; do
  [ -e "$p" ] || continue
  s=$(du -sh "$p" 2>/dev/null | cut -f1)
  rm -rf "$p" 2>/dev/null && echo "  removed $s  ${p#$C/Google/Chrome/}"
done

echo
echo "=== npm content cache ==="
npm cache clean --force 2>&1 | tail -2

echo
echo "=== disk free ==="
df -h /System/Volumes/Data | tail -1
