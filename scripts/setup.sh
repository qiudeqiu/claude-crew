#!/bin/bash
# claude-crew setup script
# Multi-platform: Telegram, Discord, and more.

set -e

INSTALL_DIR="$HOME/.claude/channels/telegram"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "🤖 claude-crew — Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ═══════════════════════════════════
# 1. Check dependencies
# ═══════════════════════════════════
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
  echo "   Install: https://claude.ai/claude-code"
  echo "   Then run: claude (to login or set ANTHROPIC_API_KEY)"
  exit 1
fi

CLAUDE_AUTH=$(claude --version 2>&1 || true)
if echo "$CLAUDE_AUTH" | grep -qi "not logged in\|unauthenticated\|login required"; then
  echo "⚠️  Claude Code CLI installed but not logged in"
  echo "   Run: claude (to login)"
  echo "   Or set: export ANTHROPIC_API_KEY=sk-ant-..."
  echo "   Then re-run this script"
  exit 1
fi
echo "✅ Claude Code CLI ready"

echo "✅ Dependencies OK"
echo ""

# ═══════════════════════════════════
# 2. Create state directory + install deps
# ═══════════════════════════════════
mkdir -p "$INSTALL_DIR"
chmod 700 "$INSTALL_DIR"

echo "Installing dependencies..."
cd "$PROJECT_DIR"
bun install --production 2>&1 | tail -2
echo ""

# ═══════════════════════════════════
# 3. Choose platform
# ═══════════════════════════════════
echo "Choose your messaging platform:"
while true; do
  echo ""
  echo "  [1] Telegram  — recommended"
  echo "  [2] Discord   — coming soon"
  echo "  [3] Feishu    — coming soon"
  echo ""
  read -p "Platform (1/2/3): " PLATFORM_CHOICE

  case "$PLATFORM_CHOICE" in
    1|"") PLATFORM="telegram"; break ;;
    2) echo "⚠️  Discord support is coming soon. Please choose another option." ;;
    3) echo "⚠️  Feishu support is coming soon. Please choose another option." ;;
    *) echo "⚠️  Invalid choice. Please enter 1, 2, or 3." ;;
  esac
done
echo "✅ Platform: $PLATFORM"
echo ""

# ═══════════════════════════════════
# 4. Platform-specific setup
# ═══════════════════════════════════

setup_telegram() {
  # Get master bot token FIRST (needed for auto-detect user ID)
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

  # Get Owner ID — auto-detect by listening for a message
  echo "Now let's get your Telegram User ID."
  echo ""
  echo "👉 Send any message to @${MASTER_USERNAME} in Telegram (e.g. \"hi\")"
  echo "   Waiting for your message..."
  echo ""

  # Clear pending updates first
  curl -s "https://api.telegram.org/bot${MASTER_TOKEN}/getUpdates?offset=-1" > /dev/null 2>&1
  sleep 1

  # Poll for new message (timeout 120s)
  OWNER_ID=""
  OWNER_NAME=""
  ELAPSED=0
  for i in $(seq 1 40); do
    UPDATES=$(curl -s "https://api.telegram.org/bot${MASTER_TOKEN}/getUpdates?timeout=3")
    ELAPSED=$((i * 3))
    OWNER_ID=$(echo "$UPDATES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('result', [])
if results:
    msg = results[-1].get('message', {})
    user = msg.get('from', {})
    print(user.get('id', ''))
" 2>/dev/null)
    if [ -n "$OWNER_ID" ] && [ "$OWNER_ID" != "" ]; then
      OWNER_NAME=$(echo "$UPDATES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('result', [])
if results:
    msg = results[-1].get('message', {})
    user = msg.get('from', {})
    name = user.get('first_name', '')
    last = user.get('last_name', '')
    if last: name += ' ' + last
    uname = user.get('username', '')
    if uname: name += ' (@' + uname + ')'
    print(name)
" 2>/dev/null)
      break
    fi
  done

  if [ -z "$OWNER_ID" ]; then
    echo "⏰ Timed out waiting for message. Enter your User ID manually:"
    echo "   (Get it from @userinfobot — send /start to it)"
    read -p "📱 Your Telegram User ID: " OWNER_ID
    if [ -z "$OWNER_ID" ]; then
      echo "❌ User ID cannot be empty"
      exit 1
    fi
  else
    echo "✅ Detected: ${OWNER_NAME} (ID: ${OWNER_ID})"
    # Confirm update offset so the message isn't re-processed
    LAST_UPDATE=$(echo "$UPDATES" | python3 -c "
import sys, json
data = json.load(sys.stdin)
results = data.get('result', [])
if results: print(results[-1].get('update_id', 0) + 1)
else: print(0)
" 2>/dev/null)
    curl -s "https://api.telegram.org/bot${MASTER_TOKEN}/getUpdates?offset=${LAST_UPDATE}" > /dev/null 2>&1
  fi
  echo ""
}

setup_discord() {
  # Get Owner ID
  echo "To get your Discord User ID:"
  echo "  1. Open Discord → Settings → Advanced → enable Developer Mode"
  echo "  2. Right-click your name → Copy User ID"
  echo ""
  read -p "📱 Your Discord User ID: " OWNER_ID
  if [ -z "$OWNER_ID" ]; then
    echo "❌ User ID cannot be empty"
    exit 1
  fi
  echo ""

  # Get bot token
  echo "Create a Discord bot:"
  echo "  1. Go to https://discord.com/developers/applications"
  echo "  2. New Application → name it → create"
  echo "  3. Go to Bot tab → Reset Token → copy it"
  echo "  4. Enable: MESSAGE CONTENT INTENT (Bot tab → Privileged Gateway Intents)"
  echo ""
  read -p "🤖 Discord bot token: " MASTER_TOKEN
  if [ -z "$MASTER_TOKEN" ]; then
    echo "❌ Bot token cannot be empty"
    exit 1
  fi

  # Validate token
  RESULT=$(curl -s -H "Authorization: Bot ${MASTER_TOKEN}" "https://discord.com/api/v10/users/@me")
  DISCORD_USERNAME=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('username',''))" 2>/dev/null)
  if [ -z "$DISCORD_USERNAME" ]; then
    echo "❌ Invalid token. Make sure you copied the bot token (not client secret)."
    exit 1
  fi
  MASTER_USERNAME="$DISCORD_USERNAME"
  echo "✅ Discord bot: ${MASTER_USERNAME}"
  echo ""

  # Generate invite URL
  BOT_ID=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
  INVITE_URL="https://discord.com/api/oauth2/authorize?client_id=${BOT_ID}&permissions=397284550656&scope=bot"
  echo "📋 Invite your bot to a server:"
  echo "   $INVITE_URL"
  echo ""
  echo "   Open this URL in your browser, select a server, and authorize."
  echo ""
  read -p "Press Enter after you've added the bot to your server..."
  echo ""
}

# Run platform-specific setup
if [ "$PLATFORM" = "discord" ]; then
  setup_discord
else
  setup_telegram
fi

# ═══════════════════════════════════
# 5. Write bot-pool.json
# ═══════════════════════════════════
if [ ! -f "$INSTALL_DIR/bot-pool.json" ]; then
  POOL="$INSTALL_DIR/bot-pool.json" OID="$OWNER_ID" ON="$OWNER_NAME" TK="$MASTER_TOKEN" UN="$MASTER_USERNAME" PF="$PLATFORM" python3 -c "
import json, os, stat
pool = {
  'activePlatform': os.environ['PF'],
  os.environ['PF']: {
    'owner': os.environ['OID'],
    'ownerName': os.environ.get('ON', ''),
    'admins': [],
    'sharedGroupId': '',
    'bots': [{'token': os.environ['TK'], 'username': os.environ['UN'], 'role': 'master'}]
  },
  'accessLevel': 'readWrite',
  'permissionMode': 'approve',
  'masterExecute': False,
  'maxConcurrent': 3,
  'rateLimitSeconds': 5,
  'sessionTimeoutMinutes': 10,
  'dashboardIntervalMinutes': 30,
  'language': 'en'
}
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
os.chmod(os.environ['POOL'], stat.S_IRUSR | stat.S_IWUSR)
"
  echo "✅ Config created"
else
  # Add bot to existing config
  POOL="$INSTALL_DIR/bot-pool.json" OID="$OWNER_ID" TK="$MASTER_TOKEN" UN="$MASTER_USERNAME" PF="$PLATFORM" python3 -c "
import json, os, stat
pool = json.load(open(os.environ['POOL']))
pf = os.environ['PF']
pool['activePlatform'] = pf
if pf not in pool:
    pool[pf] = {'owner': '', 'admins': [], 'bots': []}
section = pool[pf]
if not section.get('owner'):
    section['owner'] = os.environ['OID']
tokens = [b['token'] for b in section.get('bots', [])]
if os.environ['TK'] not in tokens:
    section['bots'].insert(0, {'token': os.environ['TK'], 'username': os.environ['UN'], 'role': 'master'})
pool.setdefault('masterExecute', False)
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
os.chmod(os.environ['POOL'], stat.S_IRUSR | stat.S_IWUSR)
" 2>/dev/null
  echo "✅ Bot added to existing config"
fi
echo ""

# ═══════════════════════════════════
# 6. Link scripts
# ═══════════════════════════════════
echo "Linking scripts..."
ln -sf "$PROJECT_DIR/scripts/manage-pool.sh" "$INSTALL_DIR/manage-pool.sh"
ln -sf "$PROJECT_DIR/scripts/daemon.sh" "$INSTALL_DIR/daemon.sh"
ln -sf "$PROJECT_DIR/scripts/watchdog.sh" "$INSTALL_DIR/watchdog.sh"
ln -sf "$PROJECT_DIR/src/daemon.ts" "$INSTALL_DIR/daemon.ts"
echo "✅ Scripts linked"

# ═══════════════════════════════════
# 7. Optional auto-start
# ═══════════════════════════════════
echo ""
read -p "🔄 Enable auto-start on login? (y/N): " AUTOSTART
if [ "$AUTOSTART" = "y" ] || [ "$AUTOSTART" = "Y" ]; then
  "$INSTALL_DIR/daemon.sh" autostart
fi

# ═══════════════════════════════════
# 8. Start daemon
# ═══════════════════════════════════
echo ""
echo "Starting daemon..."
"$INSTALL_DIR/daemon.sh" start
echo ""

# ═══════════════════════════════════
# 9. Platform-specific next steps
# ═══════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ claude-crew is running! Bot: ${MASTER_USERNAME} [${PLATFORM}]"
echo ""

if [ "$PLATFORM" = "discord" ]; then
  echo "👉 Next steps:"
  echo ""
  echo "  1. Make sure the bot is in your Discord server"
  echo "  2. Create a channel for the bot (or use an existing one)"
  echo "  3. @${MASTER_USERNAME} menu — to open the management menu"
  echo "  4. Add project bots from the menu"
  echo ""
  echo "  The bot responds to @mentions in any channel it can see."
else
  echo "👉 Next steps:"
  echo ""
  echo "  1. Create a private group in Telegram"
  echo "  2. Add @${MASTER_USERNAME} to the group"
  echo "  3. Disable Group Privacy in @BotFather:"
  echo "     /mybots → @${MASTER_USERNAME} → Bot Settings → Group Privacy → Turn off"
  echo "  4. The bot auto-detects the group and starts the setup wizard"
  echo ""
  echo "  After setup, use @${MASTER_USERNAME} menu to manage everything."
fi

echo ""
echo "Terminal commands:"
echo "  daemon.sh status         View status"
echo "  daemon.sh logs           View logs"
echo "  daemon.sh restart        Restart"
echo "  daemon.sh stop           Stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━"
