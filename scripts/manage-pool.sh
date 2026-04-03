#!/bin/bash
# Bot Pool Manager for Telegram multi-project setup
# Usage:
#   ./manage-pool.sh add <token> [--master]  — Add bot (--master marks as master)
#   ./manage-pool.sh list                    — View all bots and assignments
#   ./manage-pool.sh release [project]       — Release bot from project (or all)
#   ./manage-pool.sh remove <username>       — Remove bot from pool
#   ./manage-pool.sh set-group <group_id>    — Set shared group ID
#   ./manage-pool.sh init-group              — Auto-detect group from added bots

POOL_FILE="$HOME/.claude/channels/telegram/bot-pool.json"

# Ensure pool file exists (new segmented format)
if [ ! -f "$POOL_FILE" ]; then
  echo '{"activePlatform":"telegram","telegram":{"owner":"","admins":[],"bots":[]}}' > "$POOL_FILE"
  chmod 600 "$POOL_FILE"
fi

# Helper: get active platform section key
get_section() {
  POOL="$POOL_FILE" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
print(pool.get('activePlatform', 'telegram'))
" 2>/dev/null
}
SECTION=$(get_section)

case "${1:-help}" in
  add)
    TOKEN="$2"
    IS_MASTER=""
    if [ "$3" = "--master" ] || [ "$2" = "--master" ]; then
      IS_MASTER="true"
      if [ "$2" = "--master" ]; then TOKEN="$3"; fi
    fi
    if [ -z "$TOKEN" ]; then
      echo "Usage: $0 add <bot_token> [--master]"
      echo "Get token from @BotFather, format: 123456789:AAH..."
      echo "  --master  Mark as master bot (global management)"
      exit 1
    fi

    # Validate token by calling getMe
    RESULT=$(curl -s "https://api.telegram.org/bot${TOKEN}/getMe")
    OK=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',False))" 2>/dev/null)
    if [ "$OK" != "True" ]; then
      echo "❌ Invalid token: $RESULT"
      exit 1
    fi

    USERNAME=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['username'])" 2>/dev/null)

    # Check if already in pool
    EXISTS=$(POOL="$POOL_FILE" TK="$TOKEN" SEC="$SECTION" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
sec = pool.get(os.environ['SEC'], {})
print(any(b['token'] == os.environ['TK'] for b in sec.get('bots', [])))
" 2>/dev/null)
    if [ "$EXISTS" = "True" ]; then
      echo "⚠️  @${USERNAME} already in pool"
      exit 0
    fi

    # Add to pool
    ROLE="project"
    if [ "$IS_MASTER" = "true" ]; then ROLE="master"; fi
    POOL="$POOL_FILE" TK="$TOKEN" UN="$USERNAME" RL="$ROLE" SEC="$SECTION" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
sec = os.environ['SEC']
if sec not in pool:
    pool[sec] = {'owner': '', 'admins': [], 'bots': []}
bot = {'token': os.environ['TK'], 'username': os.environ['UN'], 'role': os.environ['RL']}
if os.environ['RL'] == 'project':
    bot['assignedProject'] = ''
    bot['assignedPath'] = ''
    bot['accessLevel'] = 'readWrite'
    bot['permissionMode'] = pool.get('permissionMode', 'approve')
    bot['allowedUsers'] = []
pool[sec]['bots'].append(bot)
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
os.chmod(os.environ['POOL'], 0o600)
"
    ROLE_LABEL="Project bot"
    if [ "$IS_MASTER" = "true" ]; then ROLE_LABEL="🏠 Master bot"; fi
    echo "✅ Added @${USERNAME} as ${ROLE_LABEL}"
    echo "   Now add @${USERNAME} to your management group"
    echo "   Then run: $0 set-group <group_id>"
    ;;

  list)
    echo "📋 Bot Pool Status:"
    echo "────────────────────────────────────────"
    POOL="$POOL_FILE" SEC="$SECTION" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
sec = pool.get(os.environ['SEC'], {})
platform = pool.get('activePlatform', 'telegram')
gid = sec.get('sharedGroupId', '(not set)')
print(f'  Platform: {platform}')
print(f'  Shared group: {gid}')
print()
bots = sec.get('bots', [])
if not bots:
    print('  (empty) Use ./manage-pool.sh add <token> to add a bot')
for i, b in enumerate(bots):
    role = '🏠 Master' if b.get('role') == 'master' else '📂 Project'
    status = '🟢 ' + b.get('assignedProject', '') if b.get('assignedProject') else '⚪ Idle'
    username = '@' + b.get('username', '?')
    path = b.get('assignedPath', '')
    print(f'  {i+1}. [{role}] {username:20s} {status}')
    if path:
        print(f'     📁 {path}')
" 2>/dev/null
    echo "────────────────────────────────────────"
    echo "Total: $(POOL="$POOL_FILE" SEC="$SECTION" python3 -c "import json,os; print(len(json.load(open(os.environ['POOL'])).get(os.environ['SEC'],{}).get('bots',[])))" 2>/dev/null) bots"
    ;;

  release)
    PROJECT="$2"
    POOL="$POOL_FILE" PRJ="$PROJECT" SEC="$SECTION" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
sec = pool.get(os.environ['SEC'], {})
prj = os.environ['PRJ']
count = 0
for b in sec.get('bots', []):
    if b.get('assignedProject') and (prj == '' or b.get('assignedProject') == prj):
        print(f\"  Released @{b.get('username','?')} <- {b.get('assignedProject')}\")
        b.pop('assignedProject', None)
        b.pop('assignedPath', None)
        count += 1
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
os.chmod(os.environ['POOL'], 0o600)
print(f'✅ Released {count} bot(s)')
" 2>/dev/null
    ;;

  remove)
    USERNAME="$2"
    if [ -z "$USERNAME" ]; then
      echo "Usage: $0 remove <username>"
      exit 1
    fi
    USERNAME="${USERNAME#@}"
    POOL="$POOL_FILE" UN="$USERNAME" SEC="$SECTION" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
sec = pool.get(os.environ['SEC'], {})
un = os.environ['UN']
bots = sec.get('bots', [])
before = len(bots)
sec['bots'] = [b for b in bots if b.get('username') != un]
after = len(sec['bots'])
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
os.chmod(os.environ['POOL'], 0o600)
if before > after:
    print(f'✅ Removed @{un}')
else:
    print(f'⚠️  Not found: @{un}')
" 2>/dev/null
    ;;

  set-group)
    GROUP_ID="$2"
    if [ -z "$GROUP_ID" ]; then
      echo "Usage: $0 set-group <group_id>"
      echo ""
      echo "How to get group_id:"
      echo "  1. Add a bot to the group"
      echo "  2. Send a message in the group"
      echo "  3. Run: curl -s https://api.telegram.org/bot<TOKEN>/getUpdates | python3 -m json.tool"
      echo "  4. Find chat.id (negative number, e.g. -1001234567890)"
      exit 1
    fi
    POOL="$POOL_FILE" GID="$GROUP_ID" SEC="$SECTION" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
sec = os.environ['SEC']
if sec not in pool:
    pool[sec] = {'owner': '', 'admins': [], 'bots': []}
pool[sec]['sharedGroupId'] = os.environ['GID']
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
os.chmod(os.environ['POOL'], 0o600)
print(f'✅ Shared group set to: ' + os.environ['GID'])
" 2>/dev/null
    ;;

  assign)
    USERNAME="$2"
    PROJECT="$3"
    PROJPATH="$4"
    if [ -z "$USERNAME" ] || [ -z "$PROJECT" ] || [ -z "$PROJPATH" ]; then
      echo "Usage: $0 assign <bot_username> <project_name> <path>"
      echo ""
      echo "Example: $0 assign frontend_bot my-app ~/my-app"
      exit 1
    fi
    USERNAME="${USERNAME#@}"
    # Resolve path
    PROJPATH=$(cd "$PROJPATH" 2>/dev/null && pwd || echo "$PROJPATH")
    if [ ! -d "$PROJPATH" ]; then
      echo "⚠️  Path does not exist: $PROJPATH"
      exit 1
    fi
    POOL="$POOL_FILE" UN="$USERNAME" PRJ="$PROJECT" PP="$PROJPATH" SEC="$SECTION" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
sec = pool.get(os.environ['SEC'], {})
un = os.environ['UN']
found = False
for b in sec.get('bots', []):
    if b.get('username') == un:
        b['assignedProject'] = os.environ['PRJ']
        b['assignedPath'] = os.environ['PP']
        found = True
        break
if not found:
    print(f'⚠️  Not found: @{un}, run add first')
else:
    json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
    os.chmod(os.environ['POOL'], 0o600)
    print(f'✅ @{un} → {os.environ[\"PRJ\"]} ({os.environ[\"PP\"]})')
" 2>/dev/null
    ;;

  init-group)
    echo "🔍 Auto-detecting group..."
    # Try each bot's getUpdates to find a group chat
    FOUND=""
    POOL="$POOL_FILE" SEC="$SECTION" python3 -c "
import json, os, sys, urllib.request
pool = json.load(open(os.environ['POOL']))
sec = pool.get(os.environ['SEC'], {})
for b in sec.get('bots', []):
    token = b['token']
    try:
        resp = urllib.request.urlopen(f'https://api.telegram.org/bot{token}/getUpdates?limit=20', timeout=5)
        data = json.loads(resp.read())
        for r in data.get('result', []):
            chat = r.get('message', {}).get('chat', {})
            if chat.get('type') in ('group', 'supergroup'):
                gid = str(chat['id'])
                title = chat.get('title', '')
                print(f'FOUND:{gid}:{title}')
                sys.exit(0)
    except: pass
print('NOTFOUND')
" 2>/dev/null > /tmp/init-group-result
    RESULT=$(cat /tmp/init-group-result)
    rm -f /tmp/init-group-result

    if echo "$RESULT" | grep -q "^FOUND:"; then
      GID=$(echo "$RESULT" | cut -d: -f2)
      TITLE=$(echo "$RESULT" | cut -d: -f3-)
      POOL="$POOL_FILE" GID="$GID" SEC="$SECTION" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
sec = os.environ['SEC']
if sec not in pool:
    pool[sec] = {'owner': '', 'admins': [], 'bots': []}
pool[sec]['sharedGroupId'] = os.environ['GID']
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
os.chmod(os.environ['POOL'], 0o600)
" 2>/dev/null
      echo "✅ Group detected: $TITLE ($GID)"
    else
      echo "⚠️  No group detected"
      echo "   Make sure at least one bot has joined a group and someone sent a message"
      echo "   Or set manually: $0 set-group <group_id>"
    fi
    ;;

  set-mode)
    MODE="$2"
    if [ "$MODE" != "allowAll" ] && [ "$MODE" != "approve" ]; then
      echo "Usage: $0 set-mode <allowAll|approve>"
      echo ""
      echo "  allowAll — Pre-authorize all tools (faster, less safe)"
      echo "  approve  — Write ops require approval (default, safer)"
      exit 1
    fi
    POOL="$POOL_FILE" MD="$MODE" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
pool['permissionMode'] = os.environ['MD']
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
os.chmod(os.environ['POOL'], 0o600)
print(f'✅ Permission mode set to: ' + os.environ['MD'])
" 2>/dev/null
    echo "   Restart daemon to apply: daemon.sh restart"
    ;;

  help|*)
    echo "🤖 Claude Crew — Bot Pool Manager"
    echo ""
    echo "Usage:"
    echo "  $0 add <token>            Add project bot"
    echo "  $0 add <token> --master   Add master bot (global management)"
    echo "  $0 list                   View all bots and assignments"
    echo "  $0 assign <user> <name> <path>  Assign project to bot"
    echo "  $0 release [project]      Release bot (all if unspecified)"
    echo "  $0 remove <username>      Remove bot from pool"
    echo "  $0 set-group <group_id>   Set shared group ID"
    echo "  $0 init-group             Auto-detect group ID"
    echo "  $0 set-mode <mode>        Set permission mode (allowAll/approve)"
    echo ""
    echo "Quick start:"
    echo "  1. Create a master bot via @BotFather"
    echo "  2. $0 add <master_token> --master"
    echo "  3. $0 add <project_token>"
    echo "  4. Add bots to a Telegram group"
    echo "  5. $0 init-group  (or set-group <id>)"
    echo "  6. $0 assign <bot_user> <project> <path>"
    echo "  7. daemon.sh start"
    echo ""
    echo "After setup, manage everything from Telegram: @master menu"
    ;;
esac
