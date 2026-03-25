#!/bin/bash
# Watchdog: runs daemon with auto-restart on crash
# Usage: watchdog.sh <daemon_dir> <daemon_script> <pid_file> <log_file>

DAEMON_DIR="$1"
DAEMON_SCRIPT="$2"
PID_FILE="$3"
LOG_FILE="$4"

CRASH_COUNT=0
MAX_RAPID_CRASHES=5
LAST_START=0

while true; do
  NOW=$(date +%s)

  # Reset crash count if last run was stable (>5 min)
  if [ $((NOW - LAST_START)) -gt 300 ]; then
    CRASH_COUNT=0
  fi

  if [ "$CRASH_COUNT" -ge "$MAX_RAPID_CRASHES" ]; then
    echo "[$(date -u +%FT%TZ)] WATCHDOG: $MAX_RAPID_CRASHES rapid crashes, giving up" >> "$LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
  fi

  LAST_START=$NOW
  cd "$DAEMON_DIR" && bun run "$DAEMON_SCRIPT"
  EXIT_CODE=$?

  # If PID file was removed, stop was intentional — don't restart
  if [ ! -f "$PID_FILE" ]; then
    break
  fi

  CRASH_COUNT=$((CRASH_COUNT + 1))
  echo "[$(date -u +%FT%TZ)] WATCHDOG: daemon exited (code $EXIT_CODE), restarting in 3s... (crash $CRASH_COUNT/$MAX_RAPID_CRASHES)" >> "$LOG_FILE"
  sleep 3
done
