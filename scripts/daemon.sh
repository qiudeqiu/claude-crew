#!/bin/bash
# Telegram Bot Pool Daemon manager
# Usage:
#   ./daemon.sh start   — Start daemon (background)
#   ./daemon.sh stop    — Stop daemon
#   ./daemon.sh status  — View status
#   ./daemon.sh logs    — View logs
#   ./daemon.sh restart — Restart

DAEMON_DIR="$HOME/.claude/channels/telegram"
PID_FILE="$DAEMON_DIR/daemon.pid"
LOG_FILE="$DAEMON_DIR/daemon.log"
DAEMON_SCRIPT="$DAEMON_DIR/daemon.ts"

case "${1:-help}" in
  start)
    # Pre-flight: ensure Claude Code CLI is available
    if ! command -v claude >/dev/null 2>&1; then
      echo "❌ Claude Code CLI not installed — please install and log in first"
      echo "   https://claude.ai/claude-code"
      exit 1
    fi

    # Check if already running
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if kill -0 "$PID" 2>/dev/null; then
        echo "⚠️  Daemon already running (PID: $PID)"
        exit 0
      fi
      rm -f "$PID_FILE"
    fi

    echo "🚀 Starting daemon..."
    # Watchdog: auto-restart on crash, give up after 5 rapid crashes
    WATCHDOG_SCRIPT="$(cd "$(dirname "$0")" && pwd)/watchdog.sh"
    nohup "$WATCHDOG_SCRIPT" "$DAEMON_DIR" "$DAEMON_SCRIPT" "$PID_FILE" "$LOG_FILE" >> "$LOG_FILE" 2>&1 &
    DAEMON_PID=$!
    echo "$DAEMON_PID" > "$PID_FILE"
    sleep 1

    if kill -0 "$DAEMON_PID" 2>/dev/null; then
      echo "✅ Daemon started (PID: $DAEMON_PID)"
      echo "   Logs: $LOG_FILE"
      echo "   Stop: $0 stop"
    else
      echo "❌ Daemon failed to start, check logs:"
      tail -5 "$LOG_FILE"
      exit 1
    fi
    ;;

  stop)
    if [ ! -f "$PID_FILE" ]; then
      echo "⚠️  Daemon not running"
      exit 0
    fi
    WATCHDOG_PID=$(cat "$PID_FILE")
    # Remove PID file FIRST so watchdog knows this is intentional stop
    rm -f "$PID_FILE"
    echo "🛑 Stopping daemon..."
    # Kill watchdog and all its descendants (bun, claude, etc.)
    pkill -P "$WATCHDOG_PID" 2>/dev/null  # kill children first
    kill "$WATCHDOG_PID" 2>/dev/null       # then watchdog
    sleep 2
    # Force kill if still alive
    if kill -0 "$WATCHDOG_PID" 2>/dev/null; then
      echo "   Force killing..."
      pkill -9 -P "$WATCHDOG_PID" 2>/dev/null
      kill -9 "$WATCHDOG_PID" 2>/dev/null
    fi
    # Kill any orphaned daemon processes (from previous bot-triggered restarts, etc.)
    pkill -f "bun run.*daemon.ts" 2>/dev/null
    sleep 1
    # Force kill if any remain
    pkill -9 -f "bun run.*daemon.ts" 2>/dev/null
    echo "✅ Daemon stopped"
    ;;

  restart)
    "$0" stop
    sleep 1
    "$0" start
    ;;

  status)
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if kill -0 "$PID" 2>/dev/null; then
        UPTIME=$(ps -o etime= -p "$PID" 2>/dev/null | xargs)
        echo "🟢 Daemon running"
        echo "   PID: $PID"
        echo "   Uptime: $UPTIME"
        echo ""
        # Show bot pool status
        "$DAEMON_DIR/manage-pool.sh" list
      else
        echo "🔴 Daemon exited (stale PID: $PID)"
        rm -f "$PID_FILE"
      fi
    else
      echo "🔴 Daemon not running"
      echo "   Start: $0 start"
    fi
    ;;

  logs)
    if [ -f "$LOG_FILE" ]; then
      tail -${2:-50} "$LOG_FILE"
    else
      echo "No logs yet"
    fi
    ;;

  autostart)
    DAEMON_SH="$(cd "$(dirname "$0")" && pwd)/daemon.sh"
    OS="$(uname)"
    if [ "$OS" = "Darwin" ]; then
      PLIST="$HOME/Library/LaunchAgents/com.claude-crew.daemon.plist"
      mkdir -p "$HOME/Library/LaunchAgents"
      cat > "$PLIST" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.claude-crew.daemon</string>
  <key>ProgramArguments</key>
  <array>
    <string>$DAEMON_SH</string>
    <string>start</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <false/>
  <key>StandardOutPath</key>
  <string>$LOG_FILE</string>
  <key>StandardErrorPath</key>
  <string>$LOG_FILE</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>$PATH</string>
    <key>HOME</key>
    <string>$HOME</string>
  </dict>
</dict>
</plist>
PLISTEOF
      launchctl load "$PLIST" 2>/dev/null
      echo "✅ Auto-start enabled (macOS launchd)"
      echo "   Daemon will start automatically on login"
      echo "   Disable: $0 no-autostart"
    elif command -v systemctl >/dev/null 2>&1; then
      UNIT_DIR="$HOME/.config/systemd/user"
      mkdir -p "$UNIT_DIR"
      cat > "$UNIT_DIR/claude-crew.service" << SVCEOF
[Unit]
Description=claude-crew Telegram Bot Pool Daemon
After=network-online.target

[Service]
Type=forking
ExecStart=$DAEMON_SH start
ExecStop=$DAEMON_SH stop
Restart=on-failure
RestartSec=10
Environment=PATH=$PATH
Environment=HOME=$HOME

[Install]
WantedBy=default.target
SVCEOF
      systemctl --user daemon-reload
      systemctl --user enable claude-crew.service
      echo "✅ Auto-start enabled (systemd user service)"
      echo "   Daemon will start automatically on login"
      echo "   Disable: $0 no-autostart"
    else
      echo "❌ Unsupported platform — only macOS (launchd) and Linux (systemd) are supported"
      exit 1
    fi
    ;;

  no-autostart)
    OS="$(uname)"
    if [ "$OS" = "Darwin" ]; then
      PLIST="$HOME/Library/LaunchAgents/com.claude-crew.daemon.plist"
      launchctl unload "$PLIST" 2>/dev/null
      rm -f "$PLIST"
      echo "✅ Auto-start disabled (macOS)"
    elif command -v systemctl >/dev/null 2>&1; then
      systemctl --user disable claude-crew.service 2>/dev/null
      rm -f "$HOME/.config/systemd/user/claude-crew.service"
      systemctl --user daemon-reload
      echo "✅ Auto-start disabled (Linux)"
    else
      echo "⚠️  No auto-start config found"
    fi
    ;;

  help|*)
    echo "🤖 Telegram Bot Pool Daemon v3"
    echo ""
    echo "Terminal management:"
    echo "  $0 start          Start daemon"
    echo "  $0 stop           Stop daemon"
    echo "  $0 restart        Restart daemon"
    echo "  $0 status         View running status"
    echo "  $0 logs [N]       View logs (default 50 lines)"
    echo "  $0 autostart      Enable auto-start on login"
    echo "  $0 no-autostart   Disable auto-start"
    echo ""
    echo "Telegram group commands (@master bot):"
    echo "  help                          Help info"
    echo "  status                        Refresh dashboard"
    echo "  search <keyword>              Search all project code"
    echo "  restart                       Restart daemon"
    echo "  cron list                     View scheduled tasks"
    echo "  cron add @bot HH:MM task      Daily scheduled task"
    echo "  cron add @bot */N task        Every N minutes"
    echo "  cron del <id>                 Delete scheduled task"
    echo ""
    echo "How it works:"
    echo "  Daemon holds all bot tokens and maintains long-polling."
    echo "  When you @mention a bot in Telegram:"
    echo "    1. Daemon detects the message"
    echo "    2. Spawns claude -p call (pre-authorized tools)"
    echo "    3. Parses stream-json events in real time"
    echo "    4. Shows tool call progress in the group"
    echo "    5. Sends result to the group when done"
    echo ""
    echo "  Messages without @ → ignored (must @mention a bot)"
    echo ""
    echo "Security:"
    echo "  - Only OWNER_ID messages trigger sessions"
    echo "  - Max 3 concurrent tasks"
    echo "  - Pre-authorized tools (Bash/Edit/Write/Agent/Skill)"
    echo "  - 10 minute timeout per task"
    ;;
esac
