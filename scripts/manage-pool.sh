#!/bin/bash
# Bot Pool Manager for Telegram multi-project setup
# Usage:
#   ./manage-pool.sh add <token> [--master]  — 添加 bot（--master 标记为主控）
#   ./manage-pool.sh list                    — 查看所有 bot 及分配状态
#   ./manage-pool.sh release [project]       — 释放指定项目的 bot（或全部）
#   ./manage-pool.sh remove <username>       — 从池中移除 bot
#   ./manage-pool.sh set-group <group_id>    — 设置共享群组 ID
#   ./manage-pool.sh init-group              — 从已添加的 bot 自动检测群组

POOL_FILE="$HOME/.claude/channels/telegram/bot-pool.json"

# Ensure pool file exists
if [ ! -f "$POOL_FILE" ]; then
  echo '{"bots":[]}' > "$POOL_FILE"
  chmod 600 "$POOL_FILE"
fi

case "${1:-help}" in
  add)
    TOKEN="$2"
    IS_MASTER=""
    if [ "$3" = "--master" ] || [ "$2" = "--master" ]; then
      IS_MASTER="true"
      if [ "$2" = "--master" ]; then TOKEN="$3"; fi
    fi
    if [ -z "$TOKEN" ]; then
      echo "用法: $0 add <bot_token> [--master]"
      echo "从 @BotFather 获取 token，格式: 123456789:AAH..."
      echo "  --master  标记为主控 bot（管理全局配置）"
      exit 1
    fi

    # Validate token by calling getMe
    RESULT=$(curl -s "https://api.telegram.org/bot${TOKEN}/getMe")
    OK=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',False))" 2>/dev/null)
    if [ "$OK" != "True" ]; then
      echo "❌ Token 无效: $RESULT"
      exit 1
    fi

    USERNAME=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['username'])" 2>/dev/null)

    # Check if already in pool
    EXISTS=$(POOL="$POOL_FILE" TK="$TOKEN" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
print(any(b['token'] == os.environ['TK'] for b in pool['bots']))
" 2>/dev/null)
    if [ "$EXISTS" = "True" ]; then
      echo "⚠️  @${USERNAME} 已在池中"
      exit 0
    fi

    # Add to pool
    ROLE="project"
    if [ "$IS_MASTER" = "true" ]; then ROLE="master"; fi
    POOL="$POOL_FILE" TK="$TOKEN" UN="$USERNAME" RL="$ROLE" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
pool['bots'].append({'token': os.environ['TK'], 'username': os.environ['UN'], 'role': os.environ['RL']})
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
"
    ROLE_LABEL="项目 bot"
    if [ "$IS_MASTER" = "true" ]; then ROLE_LABEL="🏠 主控 bot"; fi
    echo "✅ 已添加 @${USERNAME} 为 ${ROLE_LABEL}"
    echo "   现在把 @${USERNAME} 拉入你的管理群组"
    echo "   然后运行: $0 set-group <group_id>"
    ;;

  list)
    echo "📋 Bot 池状态:"
    echo "────────────────────────────────────────"
    python3 -c "
import json
pool = json.load(open('$POOL_FILE'))
gid = pool.get('sharedGroupId', '(未设置)')
print(f'  共享群组: {gid}')
print()
if not pool['bots']:
    print('  (空) 使用 ./manage-pool.sh add <token> 添加 bot')
for i, b in enumerate(pool['bots']):
    role = '🏠 主控' if b.get('role') == 'master' else '📂 项目'
    status = '🟢 ' + b.get('assignedProject', '') if b.get('assignedProject') else '⚪ 空闲'
    username = '@' + b.get('username', '?')
    path = b.get('assignedPath', '')
    print(f'  {i+1}. [{role}] {username:20s} {status}')
    if path:
        print(f'     📁 {path}')
" 2>/dev/null
    echo "────────────────────────────────────────"
    echo "共 $(python3 -c "import json; print(len(json.load(open('$POOL_FILE'))['bots']))" 2>/dev/null) 个 bot"
    ;;

  release)
    PROJECT="$2"
    POOL="$POOL_FILE" PRJ="$PROJECT" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
prj = os.environ['PRJ']
count = 0
for b in pool['bots']:
    if b.get('assignedProject') and (prj == '' or b.get('assignedProject') == prj):
        print(f\"  释放 @{b.get('username','?')} ← {b.get('assignedProject')}\")
        b.pop('assignedProject', None)
        b.pop('assignedPath', None)
        count += 1
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
print(f'✅ 已释放 {count} 个 bot')
" 2>/dev/null
    ;;

  remove)
    USERNAME="$2"
    if [ -z "$USERNAME" ]; then
      echo "用法: $0 remove <username>"
      exit 1
    fi
    USERNAME="${USERNAME#@}"
    POOL="$POOL_FILE" UN="$USERNAME" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
un = os.environ['UN']
before = len(pool['bots'])
pool['bots'] = [b for b in pool['bots'] if b.get('username') != un]
after = len(pool['bots'])
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
if before > after:
    print(f'✅ 已移除 @{un}')
else:
    print(f'⚠️  未找到 @{un}')
" 2>/dev/null
    ;;

  set-group)
    GROUP_ID="$2"
    if [ -z "$GROUP_ID" ]; then
      echo "用法: $0 set-group <group_id>"
      echo ""
      echo "获取 group_id 的方法:"
      echo "  1. 把一个 bot 拉入群组"
      echo "  2. 在群里发一条消息"
      echo "  3. 运行: curl -s https://api.telegram.org/bot<TOKEN>/getUpdates | python3 -m json.tool"
      echo "  4. 找到 chat.id（负数，如 -1001234567890）"
      exit 1
    fi
    POOL="$POOL_FILE" GID="$GROUP_ID" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
pool['sharedGroupId'] = os.environ['GID']
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
print(f'✅ 共享群组已设置为: ' + os.environ['GID'])
" 2>/dev/null
    ;;

  assign)
    USERNAME="$2"
    PROJECT="$3"
    PROJPATH="$4"
    if [ -z "$USERNAME" ] || [ -z "$PROJECT" ] || [ -z "$PROJPATH" ]; then
      echo "用法: $0 assign <bot_username> <project_name> <path>"
      echo ""
      echo "示例: $0 assign frontend_bot my-app ~/my-app"
      exit 1
    fi
    USERNAME="${USERNAME#@}"
    # Resolve path
    PROJPATH=$(cd "$PROJPATH" 2>/dev/null && pwd || echo "$PROJPATH")
    if [ ! -d "$PROJPATH" ]; then
      echo "⚠️  路径不存在: $PROJPATH"
      exit 1
    fi
    POOL="$POOL_FILE" UN="$USERNAME" PRJ="$PROJECT" PP="$PROJPATH" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
un = os.environ['UN']
found = False
for b in pool['bots']:
    if b.get('username') == un:
        b['assignedProject'] = os.environ['PRJ']
        b['assignedPath'] = os.environ['PP']
        found = True
        break
if not found:
    print(f'⚠️  未找到 @{un}，请先 add')
else:
    json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
    print(f'✅ @{un} → {os.environ[\"PRJ\"]} ({os.environ[\"PP\"]})')
" 2>/dev/null
    ;;

  init-group)
    echo "🔍 自动检测群组..."
    # Try each bot's getUpdates to find a group chat
    FOUND=""
    python3 -c "
import json, sys, urllib.request
pool = json.load(open('$POOL_FILE'))
for b in pool['bots']:
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
      POOL="$POOL_FILE" GID="$GID" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
pool['sharedGroupId'] = os.environ['GID']
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
" 2>/dev/null
      echo "✅ 检测到群组: $TITLE ($GID)"
    else
      echo "⚠️  未检测到群组"
      echo "   确保至少一个 bot 已加入群组且有人发过消息"
      echo "   或手动设置: $0 set-group <group_id>"
    fi
    ;;

  set-mode)
    MODE="$2"
    if [ "$MODE" != "allowAll" ] && [ "$MODE" != "approve" ]; then
      echo "用法: $0 set-mode <allowAll|approve>"
      echo ""
      echo "  allowAll — 预授权所有工具（默认，响应快）"
      echo "  approve  — 写操作需要审批后执行（更安全）"
      exit 1
    fi
    POOL="$POOL_FILE" MD="$MODE" python3 -c "
import json, os
pool = json.load(open(os.environ['POOL']))
pool['permissionMode'] = os.environ['MD']
json.dump(pool, open(os.environ['POOL'], 'w'), indent=2, ensure_ascii=False)
print(f'✅ 权限模式已设置为: ' + os.environ['MD'])
" 2>/dev/null
    echo "   重启 daemon 生效: daemon.sh restart"
    ;;

  help|*)
    echo "🤖 Telegram Bot 池管理 (多项目架构)"
    echo ""
    echo "用法:"
    echo "  $0 add <token>            添加项目 bot"
    echo "  $0 add <token> --master   添加主控 bot（全局管理）"
    echo "  $0 list                   查看所有 bot 及分配状态"
    echo "  $0 assign <user> <name> <path>  分配项目到 bot"
    echo "  $0 release [project]      释放 bot（不指定则释放全部）"
    echo "  $0 remove <username>      从池中移除 bot"
    echo "  $0 set-group <group_id>   设置共享群组 ID"
    echo "  $0 init-group             自动检测群组 ID"
    echo "  $0 set-mode <mode>        设置权限模式 (allowAll/approve)"
    echo ""
    echo "快速开始:"
    echo "  1. 在 Telegram @BotFather 创建 bot（建议 3-5 个项目 bot + 1 个主控 bot）"
    echo "  2. $0 add <master_token> --master"
    echo "  3. $0 add <project_token1>"
    echo "  4. $0 add <project_token2>"
    echo "  5. 把所有 bot 拉入同一个 Telegram 群组"
    echo "  6. $0 set-group <group_id> 或 $0 init-group"
    echo "  7. $0 assign <bot_user> <project> <path>"
    echo "  8. daemon.sh start"
    echo ""
    echo "架构:"
    echo "  🏠 主控 bot — 全局管理，查看所有项目，管理 agents/skills"
    echo "  📂 项目 bot — 每个项目一个，只能写自己的项目，可读其他项目"
    echo "  📋 委托机制 — 需要改别的项目时，通过群组 @目标bot 委托执行"
    echo "  🧠 定时记忆 — 每 2 小时自动提醒保存会话记忆"
    ;;
esac
