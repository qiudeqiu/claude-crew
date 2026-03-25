#!/bin/bash
# Telegram Bot Pool Daemon manager
# Usage:
#   ./daemon.sh start   — 启动 daemon（后台运行）
#   ./daemon.sh stop    — 停止 daemon
#   ./daemon.sh status  — 查看状态
#   ./daemon.sh logs    — 查看日志
#   ./daemon.sh restart — 重启

DAEMON_DIR="$HOME/.claude/channels/telegram"
PID_FILE="$DAEMON_DIR/daemon.pid"
LOG_FILE="$DAEMON_DIR/daemon.log"
DAEMON_SCRIPT="$DAEMON_DIR/daemon.ts"

case "${1:-help}" in
  start)
    # Pre-flight: ensure Claude Code CLI is available
    if ! command -v claude >/dev/null 2>&1; then
      echo "❌ Claude Code CLI 未安装 — 请先安装并登录"
      echo "   https://claude.ai/claude-code"
      exit 1
    fi

    # Check if already running
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if kill -0 "$PID" 2>/dev/null; then
        echo "⚠️  Daemon 已在运行 (PID: $PID)"
        exit 0
      fi
      rm -f "$PID_FILE"
    fi

    echo "🚀 启动 daemon..."
    # Watchdog: auto-restart on crash, give up after 5 rapid crashes
    WATCHDOG_SCRIPT="$(cd "$(dirname "$0")" && pwd)/watchdog.sh"
    nohup "$WATCHDOG_SCRIPT" "$DAEMON_DIR" "$DAEMON_SCRIPT" "$PID_FILE" "$LOG_FILE" >> "$LOG_FILE" 2>&1 &
    DAEMON_PID=$!
    echo "$DAEMON_PID" > "$PID_FILE"
    sleep 1

    if kill -0 "$DAEMON_PID" 2>/dev/null; then
      echo "✅ Daemon 已启动 (PID: $DAEMON_PID)"
      echo "   日志: $LOG_FILE"
      echo "   停止: $0 stop"
    else
      echo "❌ Daemon 启动失败，查看日志:"
      tail -5 "$LOG_FILE"
      exit 1
    fi
    ;;

  stop)
    if [ ! -f "$PID_FILE" ]; then
      echo "⚠️  Daemon 未运行"
      exit 0
    fi
    WATCHDOG_PID=$(cat "$PID_FILE")
    # Remove PID file FIRST so watchdog knows this is intentional stop
    rm -f "$PID_FILE"
    echo "🛑 停止 daemon..."
    # Kill watchdog and all its descendants (bun, claude, etc.)
    pkill -P "$WATCHDOG_PID" 2>/dev/null  # kill children first
    kill "$WATCHDOG_PID" 2>/dev/null       # then watchdog
    sleep 2
    # Force kill if still alive
    if kill -0 "$WATCHDOG_PID" 2>/dev/null; then
      echo "   强制终止..."
      pkill -9 -P "$WATCHDOG_PID" 2>/dev/null
      kill -9 "$WATCHDOG_PID" 2>/dev/null
    fi
    # Kill any orphaned daemon processes (from previous bot-triggered restarts, etc.)
    pkill -f "bun run.*daemon.ts" 2>/dev/null
    sleep 1
    # Force kill if any remain
    pkill -9 -f "bun run.*daemon.ts" 2>/dev/null
    echo "✅ Daemon 已停止"
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
        echo "🟢 Daemon 运行中"
        echo "   PID: $PID"
        echo "   运行时间: $UPTIME"
        echo ""
        # Show bot pool status
        "$DAEMON_DIR/manage-pool.sh" list
      else
        echo "🔴 Daemon 已退出 (stale PID: $PID)"
        rm -f "$PID_FILE"
      fi
    else
      echo "🔴 Daemon 未运行"
      echo "   启动: $0 start"
    fi
    ;;

  logs)
    if [ -f "$LOG_FILE" ]; then
      tail -${2:-50} "$LOG_FILE"
    else
      echo "暂无日志"
    fi
    ;;

  help|*)
    echo "🤖 Telegram Bot Pool Daemon v3"
    echo ""
    echo "终端管理:"
    echo "  $0 start     启动 daemon"
    echo "  $0 stop      停止 daemon"
    echo "  $0 restart   重启 daemon"
    echo "  $0 status    查看运行状态"
    echo "  $0 logs [N]  查看日志（默认 50 行）"
    echo ""
    echo "Telegram 群组命令（@主控bot）:"
    echo "  help                          帮助信息"
    echo "  status                        刷新项目看板"
    echo "  search <关键词>               搜索所有项目代码"
    echo "  restart                       重启 daemon"
    echo "  cron list                     查看定时任务"
    echo "  cron add @bot HH:MM 任务      每天定时执行"
    echo "  cron add @bot */N 任务        每 N 分钟执行"
    echo "  cron del <id>                 删除定时任务"
    echo ""
    echo "工作原理:"
    echo "  Daemon 持有所有 bot token，保持 long-polling。"
    echo "  当你在 Telegram @某个 bot 发消息时："
    echo "    1. Daemon 检测到消息"
    echo "    2. 生成 claude -p 调用（预授权工具）"
    echo "    3. 实时解析 stream-json 事件流"
    echo "    4. 群里显示工具调用进度"
    echo "    5. 完成后发送结果到群里"
    echo ""
    echo "  不 @ 时发消息 → 被忽略（需要 @ 指定 bot）"
    echo ""
    echo "安全措施:"
    echo "  - 仅 OWNER_ID 的消息触发会话"
    echo "  - 最多 3 个并发任务"
    echo "  - 工具预授权（Bash/Edit/Write/Agent/Skill）"
    echo "  - 每任务 10 分钟超时"
    ;;
esac
