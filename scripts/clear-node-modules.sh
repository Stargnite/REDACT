#!/bin/bash
# Delete node_modules across ~/Desktop/wazobia-tech. Fully regenerable via `npm install` / `yarn install`.
set -u
ROOT="$HOME/Desktop/wazobia-tech"

echo "=== node_modules found ==="
find "$ROOT" -maxdepth 4 -type d -name node_modules -prune 2>/dev/null | while read -r d; do
  s=$(du -sh "$d" 2>/dev/null | cut -f1)
  echo "  $s  ${d#$HOME/Desktop/}"
done

echo
echo "=== deleting ==="
find "$ROOT" -maxdepth 4 -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null

echo
echo "=== remaining ==="
find "$ROOT" -maxdepth 4 -type d -name node_modules -prune 2>/dev/null | wc -l | tr -d ' ' | sed 's/^/  node_modules dirs left: /'
echo
echo "=== disk free ==="
df -h /System/Volumes/Data | tail -1
