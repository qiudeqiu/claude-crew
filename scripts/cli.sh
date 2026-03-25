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
    echo "用法: telegram-pool <command>"
    echo ""
    echo "  setup                  安装向导"
    echo "  pool add <token>       添加项目 bot"
    echo "  pool add <token> --master  添加主控 bot"
    echo "  pool list              查看 bot 池"
    echo "  pool set-group <id>    设置共享群组"
    echo "  pool release [project] 释放 bot"
    echo "  start                  启动 daemon"
    echo "  stop                   停止 daemon"
    echo "  restart                重启 daemon"
    echo "  status                 查看状态"
    echo "  logs [N]               查看日志"
    ;;
esac
