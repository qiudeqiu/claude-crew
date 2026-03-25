#!/bin/bash
# telegram-pool setup script
# Installs the bot pool system into ~/.claude/channels/telegram/

set -e

INSTALL_DIR="$HOME/.claude/channels/telegram"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "🤖 Telegram Pool — Setup Wizard"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Check dependencies
echo "Checking dependencies..."

# Bun runtime
command -v bun >/dev/null 2>&1 || {
  echo "❌ Bun >= 1.0 required"
  echo "   Install: curl -fsSL https://bun.sh/install | bash"
  exit 1
}

# Claude Code CLI — CRITICAL
if ! command -v claude >/dev/null 2>&1; then
  echo "❌ Claude Code CLI not found"
  echo ""
  echo "   This project requires Claude Code CLI as its core runtime."
  echo "   It is not optional — the project cannot run without it."
  echo ""
  echo "   Installation steps:"
  echo "   1. Visit https://claude.ai/claude-code to install Claude Code"
  echo "   2. Run claude to complete login and authorization"
  echo "   3. Confirm you have a valid subscription (Max or Pro)"
  echo "   4. Re-run this script"
  exit 1
fi

# Check if Claude Code is logged in
CLAUDE_AUTH=$(claude --version 2>&1 || true)
if echo "$CLAUDE_AUTH" | grep -qi "not logged in\|unauthenticated\|login required"; then
  echo "⚠️  Claude Code CLI installed but not logged in"
  echo "   Run: claude"
  echo "   Then re-run this script after logging in"
  exit 1
fi
echo "✅ Claude Code CLI ready"

# Optional: ffmpeg + whisper (voice features)
command -v ffmpeg >/dev/null 2>&1 || echo "⚠️  ffmpeg not found — required for voice features (brew install ffmpeg)"
command -v whisper >/dev/null 2>&1 || echo "⚠️  whisper not found — required for voice features (pipx install openai-whisper)"
echo "✅ Dependencies OK"
echo ""

# 2. Create state directory
mkdir -p "$INSTALL_DIR"
chmod 700 "$INSTALL_DIR"

# 3. Install node dependencies
echo "Installing dependencies..."
cd "$PROJECT_DIR"
bun install --production 2>&1 | tail -2
echo ""

# 4. Get Owner ID
read -p "📱 Your Telegram User ID (get it from @userinfobot): " OWNER_ID
if [ -z "$OWNER_ID" ]; then
  echo "❌ User ID cannot be empty"
  exit 1
fi
echo ""

# 5. Permission mode
echo "Permission mode:"
echo "  1. allowAll — Pre-authorize all tools (default, faster)"
echo "  2. approve  — Write ops require approval (safer)"
read -p "Choose [1/2, default 1]: " PERM_CHOICE
PERM_MODE="allowAll"
if [ "$PERM_CHOICE" = "2" ]; then
  PERM_MODE="approve"
fi
echo "✅ Permission mode: $PERM_MODE"
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
  echo "✅ bot-pool.json created"
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
  echo "✅ bot-pool.json already exists, admin confirmed"
fi
echo ""

# 6. Link scripts
echo "Linking scripts..."
ln -sf "$PROJECT_DIR/scripts/manage-pool.sh" "$INSTALL_DIR/manage-pool.sh"
ln -sf "$PROJECT_DIR/scripts/daemon.sh" "$INSTALL_DIR/daemon.sh"
ln -sf "$PROJECT_DIR/scripts/watchdog.sh" "$INSTALL_DIR/watchdog.sh"
ln -sf "$PROJECT_DIR/src/daemon.ts" "$INSTALL_DIR/daemon.ts"
echo "✅ Scripts linked"
echo ""

# 7. Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Create bots in Telegram via @BotFather"
echo "  2. $INSTALL_DIR/manage-pool.sh add <token> --master  (master bot)"
echo "  3. $INSTALL_DIR/manage-pool.sh add <token>           (project bot)"
echo "  4. Create a private Telegram group and add all bots"
echo "  5. Disable Group Privacy for each bot in @BotFather"
echo "  6. $INSTALL_DIR/manage-pool.sh set-group <group_id>"
echo "  7. $INSTALL_DIR/daemon.sh start"
echo ""
echo "Management commands:"
echo "  manage-pool.sh list     View bot pool"
echo "  daemon.sh status        View daemon status"
echo "  daemon.sh logs          View logs"
