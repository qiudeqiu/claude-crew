#!/bin/bash
# telegram-pool CLI entry point
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_DIR="$HOME/.claude/channels/telegram"

case "${1:-help}" in
  setup)     bash "$SCRIPT_DIR/setup.sh" ;;
  pool)      shift; bash "$SCRIPT_DIR/manage-pool.sh" "$@" ;;
  start)     bash "$STATE_DIR/daemon.sh" start ;;
  stop)      bash "$STATE_DIR/daemon.sh" stop ;;
  restart)   bash "$STATE_DIR/daemon.sh" restart ;;
  status)    bash "$STATE_DIR/daemon.sh" status ;;
  logs)      shift; bash "$STATE_DIR/daemon.sh" logs "$@" ;;
  help|*)
    echo "telegram-pool — Multi-project Claude Code via Telegram"
    echo ""
    echo "Usage: telegram-pool <command>"
    echo ""
    echo "  setup                  Setup wizard"
    echo "  pool add <token>       Add project bot"
    echo "  pool add <token> --master  Add master bot"
    echo "  pool list              View bot pool"
    echo "  pool set-group <id>    Set shared group"
    echo "  pool release [project] Release bot"
    echo "  start                  Start daemon"
    echo "  stop                   Stop daemon"
    echo "  restart                Restart daemon"
    echo "  status                 View status"
    echo "  logs [N]               View logs"
    ;;
esac
