#!/bin/bash
# Relaunch Chrome: the user's real Default profile (debug port 9223) and the
# CDP probe instance (shobam profile, port 9222).
set -u

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$HOME/.cache/shobam-chrome"

# 1. the user's real browser, default profile, with a debug port so we can probe it
"$CHROME" \
  --remote-debugging-port=9223 \
  --no-default-browser-check \
  --no-first-run \
  --profile-directory=Default >/dev/null 2>&1 &

# 2. the CDP probe instance (separate profile, keeps its own debug port)
"$CHROME" \
  --no-startup-window \
  --disable-features=Translate \
  --no-default-browser-check \
  --no-first-run \
  --profile-directory=Default \
  --remote-debugging-port=9222 \
  --user-data-dir="$PROFILE" >/dev/null 2>&1 &

for port in 9223 9222; do
  for i in $(seq 1 30); do
    if curl -s "http://127.0.0.1:$port/json/version" >/dev/null 2>&1; then
      echo "chrome up on $port after ${i}s"
      break
    fi
    sleep 1
  done
done
