#!/bin/bash
# telegram-pool setup script
# Installs the bot pool system into ~/.claude/channels/telegram/

set -e

INSTALL_DIR="$HOME/.claude/channels/telegram"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "🤖 Telegram Pool — 安装向导"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Check dependencies
echo "检查依赖..."

# Bun runtime
command -v bun >/dev/null 2>&1 || {
  echo "❌ 需要 Bun >= 1.0"
  echo "   安装: curl -fsSL https://bun.sh/install | bash"
  exit 1
}

# Claude Code CLI — CRITICAL
if ! command -v claude >/dev/null 2>&1; then
  echo "❌ 未检测到 Claude Code CLI"
  echo ""
  echo "   本项目需要 Claude Code CLI 作为核心运行时。"
  echo "   它不是一个可选依赖 — 没有它项目无法运行。"
  echo ""
  echo "   安装步骤:"
  echo "   1. 访问 https://claude.ai/claude-code 安装 Claude Code"
  echo "   2. 运行 claude 完成登录和授权"
  echo "   3. 确认你有有效的订阅 (Max 或 Pro)"
  echo "   4. 重新运行本脚本"
  exit 1
fi

# Check if Claude Code is logged in
CLAUDE_AUTH=$(claude --version 2>&1 || true)
if echo "$CLAUDE_AUTH" | grep -qi "not logged in\|unauthenticated\|login required"; then
  echo "⚠️  Claude Code CLI 已安装但未登录"
  echo "   请先运行: claude"
  echo "   完成登录后重新运行本脚本"
  exit 1
fi
echo "✅ Claude Code CLI 已就绪"

# Optional: ffmpeg + whisper (voice features)
command -v ffmpeg >/dev/null 2>&1 || echo "⚠️  未检测到 ffmpeg — 语音功能需要它 (brew install ffmpeg)"
command -v whisper >/dev/null 2>&1 || echo "⚠️  未检测到 whisper — 语音功能需要它 (pipx install openai-whisper)"
echo "✅ 依赖检查通过"
echo ""

# 2. Create state directory
mkdir -p "$INSTALL_DIR"
chmod 700 "$INSTALL_DIR"

# 3. Install node dependencies
echo "安装依赖..."
cd "$PROJECT_DIR"
bun install --production 2>&1 | tail -2
echo ""

# 4. Get Owner ID
read -p "📱 你的 Telegram User ID (从 @userinfobot 获取): " OWNER_ID
if [ -z "$OWNER_ID" ]; then
  echo "❌ User ID 不能为空"
  exit 1
fi
echo ""

# 5. Permission mode
echo "权限模式:"
echo "  1. allowAll — 预授权所有工具（默认，响应快）"
echo "  2. approve  — 写操作需要审批后执行（更安全）"
read -p "选择 [1/2，默认 1]: " PERM_CHOICE
PERM_MODE="allowAll"
if [ "$PERM_CHOICE" = "2" ]; then
  PERM_MODE="approve"
fi
echo "✅ 权限模式: $PERM_MODE"
echo ""

# 6. Initialize bot-pool.json (single config file for everything)
if [ ! -f "$INSTALL_DIR/bot-pool.json" ]; then
  cat > "$INSTALL_DIR/bot-pool.json" << POOLJSON
{
  "admins": ["$OWNER_ID"],
  "bots": [],
  "sharedGroupId": "",
  "accessLevel": "readWrite",
  "permissionMode": "$PERM_MODE",
  "masterExecute": false,
  "maxConcurrent": 3,
  "rateLimitSeconds": 5,
  "sessionTimeoutMinutes": 10,
  "dashboardIntervalMinutes": 30,
  "memoryIntervalMinutes": 120,
  "whisperLanguage": ""
}
POOLJSON
  chmod 600 "$INSTALL_DIR/bot-pool.json"
  echo "✅ bot-pool.json 已创建"
else
  # Ensure admins is set
  POOL="$INSTALL_DIR/bot-pool.json" OID="$OWNER_ID" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
admins = pool.get('admins', [])
oid = os.environ['OID']
if not admins:
    pool['admins'] = [oid]
    json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
" 2>/dev/null
  echo "✅ bot-pool.json 已存在，已确认管理员"
fi
echo ""

# 6. Link scripts
echo "链接脚本..."
ln -sf "$PROJECT_DIR/scripts/manage-pool.sh" "$INSTALL_DIR/manage-pool.sh"
ln -sf "$PROJECT_DIR/scripts/daemon.sh" "$INSTALL_DIR/daemon.sh"
ln -sf "$PROJECT_DIR/scripts/watchdog.sh" "$INSTALL_DIR/watchdog.sh"
ln -sf "$PROJECT_DIR/src/daemon.ts" "$INSTALL_DIR/daemon.ts"
echo "✅ 脚本已链接"
echo ""

# 7. Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 安装完成！"
echo ""
echo "下一步:"
echo "  1. 在 Telegram @BotFather 创建 bot"
echo "  2. $INSTALL_DIR/manage-pool.sh add <token> --master  (主控 bot)"
echo "  3. $INSTALL_DIR/manage-pool.sh add <token>           (项目 bot)"
echo "  4. 创建 Telegram 私密群组，把所有 bot 拉进去"
echo "  5. 每个 bot 在 @BotFather 关闭 Group Privacy"
echo "  6. $INSTALL_DIR/manage-pool.sh set-group <group_id>"
echo "  7. $INSTALL_DIR/daemon.sh start"
echo ""
echo "管理命令:"
echo "  manage-pool.sh list     查看 bot 池"
echo "  daemon.sh status        查看 daemon 状态"
echo "  daemon.sh logs          查看日志"
