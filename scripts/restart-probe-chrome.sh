#!/bin/bash
# Restart the CDP-probe Chrome (shobam profile) so Chrome's optimization-guide
# service re-evaluates free disk space for the on-device model.
set -u

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PROFILE="$HOME/.cache/shobam-chrome"
PORT=9222

pkill -f "remote-debugging-port=$PORT" 2>/dev/null
sleep 3
pkill -9 -f "remote-debugging-port=$PORT" 2>/dev/null

"$CHROME" \
  --no-startup-window \
  --disable-features=Translate \
  --no-default-browser-check \
  --no-first-run \
  --profile-directory=Default \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE" >/dev/null 2>&1 &

# wait for the devtools endpoint
for i in $(seq 1 30); do
  if curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
    echo "chrome up on $PORT after ${i}s"
    exit 0
  fi
  sleep 1
done

echo "chrome did NOT come up on $PORT"
exit 1
