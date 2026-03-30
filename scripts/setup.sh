#!/bin/bash
# claude-crew setup script
# Installs master bot and starts daemon. All further setup via Telegram.

set -e

INSTALL_DIR="$HOME/.claude/channels/telegram"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "🤖 claude-crew — Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 1. Check dependencies
echo "Checking dependencies..."

command -v bun >/dev/null 2>&1 || {
  echo "❌ Bun >= 1.0 required"
  echo "   Install: curl -fsSL https://bun.sh/install | bash"
  exit 1
}

if ! command -v claude >/dev/null 2>&1; then
  echo "❌ Claude Code CLI not found"
  echo ""
  echo "   This project requires Claude Code CLI as its core runtime."
  echo "   It is not optional — the project cannot run without it."
  echo ""
  echo "   Install: https://claude.ai/claude-code"
  echo "   Then run: claude (to login)"
  echo "   Requires: Max or Pro subscription"
  exit 1
fi

CLAUDE_AUTH=$(claude --version 2>&1 || true)
if echo "$CLAUDE_AUTH" | grep -qi "not logged in\|unauthenticated\|login required"; then
  echo "⚠️  Claude Code CLI installed but not logged in"
  echo "   Run: claude"
  echo "   Then re-run this script"
  exit 1
fi
echo "✅ Claude Code CLI ready"

command -v ffmpeg >/dev/null 2>&1 || echo "⚠️  ffmpeg not found — voice features need it (brew install ffmpeg)"
command -v whisper >/dev/null 2>&1 || echo "⚠️  whisper not found — voice features need it (pipx install openai-whisper)"
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
echo "Get your Telegram User ID from @userinfobot (send /start to it)"
read -p "📱 Your Telegram User ID: " OWNER_ID
if [ -z "$OWNER_ID" ]; then
  echo "❌ User ID cannot be empty"
  exit 1
fi
echo ""

# 5. Get master bot token
echo "Create a master bot via @BotFather in Telegram (/newbot)"
echo "This bot will be your control center — menu, dashboard, bot/config/user management."
echo ""
read -p "🤖 Master bot token: " MASTER_TOKEN
if [ -z "$MASTER_TOKEN" ]; then
  echo "❌ Master bot token cannot be empty"
  exit 1
fi

# Validate token
RESULT=$(curl -s "https://api.telegram.org/bot${MASTER_TOKEN}/getMe")
OK=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',False))" 2>/dev/null)
if [ "$OK" != "True" ]; then
  echo "❌ Invalid token: $RESULT"
  exit 1
fi
MASTER_USERNAME=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['username'])" 2>/dev/null)
echo "✅ Master bot: @${MASTER_USERNAME}"
echo ""

# 6. Initialize bot-pool.json
if [ ! -f "$INSTALL_DIR/bot-pool.json" ]; then
  cat > "$INSTALL_DIR/bot-pool.json" << POOLJSON
{
  "admins": ["$OWNER_ID"],
  "bots": [
    {
      "token": "$MASTER_TOKEN",
      "username": "$MASTER_USERNAME",
      "role": "master"
    }
  ],
  "sharedGroupId": "",
  "accessLevel": "readWrite",
  "permissionMode": "approve",
  "masterExecute": false,
  "maxConcurrent": 3,
  "rateLimitSeconds": 5,
  "sessionTimeoutMinutes": 10,
  "dashboardIntervalMinutes": 30,
  "memoryIntervalMinutes": 120,
  "whisperLanguage": "",
  "language": "en"
}
POOLJSON
  chmod 600 "$INSTALL_DIR/bot-pool.json"
  echo "✅ Config created with master bot"
else
  # Add master bot to existing config
  POOL="$INSTALL_DIR/bot-pool.json" OID="$OWNER_ID" TK="$MASTER_TOKEN" UN="$MASTER_USERNAME" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
if not pool.get('admins'):
    pool['admins'] = [os.environ['OID']]
# Add master bot if not present
tokens = [b['token'] for b in pool['bots']]
if os.environ['TK'] not in tokens:
    pool['bots'].insert(0, {'token': os.environ['TK'], 'username': os.environ['UN'], 'role': 'master'})
pool.setdefault('masterExecute', False)
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
" 2>/dev/null
  echo "✅ Master bot added to existing config"
fi
echo ""

# 7. Link scripts
echo "Linking scripts..."
ln -sf "$PROJECT_DIR/scripts/manage-pool.sh" "$INSTALL_DIR/manage-pool.sh"
ln -sf "$PROJECT_DIR/scripts/daemon.sh" "$INSTALL_DIR/daemon.sh"
ln -sf "$PROJECT_DIR/scripts/watchdog.sh" "$INSTALL_DIR/watchdog.sh"
ln -sf "$PROJECT_DIR/src/daemon.ts" "$INSTALL_DIR/daemon.ts"
echo "✅ Scripts linked"
echo ""

# 8. Optional: auto-start on boot
echo ""
read -p "🔄 Enable auto-start on login? (y/N): " AUTOSTART
if [ "$AUTOSTART" = "y" ] || [ "$AUTOSTART" = "Y" ]; then
  "$INSTALL_DIR/daemon.sh" autostart
fi

# 9. Start daemon
echo ""
echo "Starting daemon..."
"$INSTALL_DIR/daemon.sh" start
echo ""

# 10. Summary — final output the user sees
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ claude-crew is running! Your bot @${MASTER_USERNAME} is now online."
echo ""
echo "👉 Next steps:"
echo ""
echo "  1. Create a private group in Telegram"
echo "  2. Add @${MASTER_USERNAME} to the group"
echo "  3. Disable Group Privacy in @BotFather:"
echo "     /mybots → @${MASTER_USERNAME} → Bot Settings → Group Privacy → Turn off"
echo "  4. The bot auto-detects the group and starts the setup wizard"
echo ""
echo "  After setup, use @${MASTER_USERNAME} menu to manage everything."
echo ""
echo "Terminal commands:"
echo "  daemon.sh status         View status"
echo "  daemon.sh logs           View logs"
echo "  daemon.sh restart        Restart"
echo "  daemon.sh stop           Stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
