[English](README.md) | [中文](README_CN.md)

# claude-telegram-bots

Multi-project Claude Code orchestration via Telegram bot pool.

Turn a Telegram group into a remote control center for all your Claude Code projects. Each project gets its own bot — @mention to execute, reply to continue, voice commands, auto-dashboard, cron jobs.

## How It Works

```
Telegram Group "My Projects"
┌──────────────────────────────────────┐
│  🏠 Master     📂 Proj-A   📂 Proj-B │
│                                      │
│  You: @proj_a_bot fix the login bug  │
│  Proj-A: 👀                          │
│  Proj-A: ⚙️ working... (12s)        │
│    → 🔧 Read: auth.ts               │
│    → 🔧 Edit: auth.ts               │
│  Proj-A: Fixed. Changed auth.ts ... │
│                                      │
│  📊 Project Dashboard (pinned)       │
│  ┌────────────────────────────────┐  │
│  │ proj-a  🌿 main · 2m ago      │  │
│  │   📊 [opus-4-6] ████░░░░ 38%  │  │
│  │ proj-b  🌿 feat/x · 1h ago    │  │
│  │   📊 [sonnet-4-6] ██░░░░ 15%  │  │
│  │ 3 calls | 2m15s | $0.45      │  │
│  │ ⏱ Reset: 2h34m (five_hour)  │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## Features

- **One bot per project** — each codebase gets a dedicated Telegram bot
- **@mention = execute** — `@bot fix the login bug` runs Claude Code in that project
- **Reply to continue** — reply to a bot's message to keep the conversation going
- **Quote anything** — reply to text, photos, or voice while @mentioning a bot
- **Real-time progress** — live tool usage updates as Claude works
- **Master bot** — dashboard, search, cron, restart/memory notifications (required)
- **Dashboard** — pinned message: git status, context usage, cost, rate limit countdown
- **Cron** — schedule recurring tasks per bot
- **Periodic memory** — auto-saves conversation context for active projects
- **Voice & photo** — voice transcription via Whisper, image analysis via vision
- **Two-layer permissions** — access level (read-write / read-only) + permission mode (auto / approve)
- **Multi-user access** — admins + per-bot member control

## Requirements

- **[Claude Code CLI](https://claude.ai/claude-code)** — installed and logged in locally, with an active subscription (Max or Pro)
- **[Bun](https://bun.sh)** >= 1.0 — runtime
- **[ffmpeg](https://ffmpeg.org)** + **[whisper](https://github.com/openai/whisper)** — optional, for voice message transcription

> This project runs Claude Code in CLI mode (`claude -p`) locally. It requires an active Claude Code process on the same machine. API key mode is not supported.

## Setup Guide

### Step 1: Clone and Install

```bash
git clone https://github.com/qiudeqiu/claude-telegram-bots.git
cd claude-telegram-bots
bun install
```

### Step 2: Create Bots in Telegram

Open [@BotFather](https://t.me/BotFather):

1. Send `/newbot`, choose a name and username
2. **Save the token** (format: `123456789:AAH...`)
3. Repeat for each bot

**How many bots?**

| Role | Count | Purpose |
|------|-------|---------|
| Master bot | **1 (required)** | Dashboard, help, status, search, cron, restart/memory notifications |
| Project bot | 1 per project | Runs Claude Code in that project directory |

Example: 3 projects = 1 master + 3 project bots = 4 bots total.

> The master bot is required. It handles dashboard, global notifications (restart, memory saves), and admin commands.

### Step 3: Run Setup

```bash
bash scripts/setup.sh
```

This will:
- Check dependencies (bun, claude, ffmpeg, whisper)
- Ask for your Telegram User ID (get from [@userinfobot](https://t.me/userinfobot))
- Choose permission mode (allowAll or approve)
- Create `bot-pool.json` config file at `~/.claude/channels/telegram/`
- Create symlinks

### Step 4: Add Bots to the Pool

```bash
# Master bot (only one)
bash scripts/manage-pool.sh add <master_token> --master

# Project bots
bash scripts/manage-pool.sh add <project_token_1>
bash scripts/manage-pool.sh add <project_token_2>

# Verify
bash scripts/manage-pool.sh list
```

### Step 5: Create Telegram Group

1. Create a **private group** in Telegram
2. Add **all bots** (master + project bots) to the group
3. **Critical** — for each bot in @BotFather:

   `/mybots` → select bot → **Bot Settings** → **Group Privacy** → **Turn off**

   > Bots cannot see group messages with Group Privacy enabled!

### Step 6: Set Group ID

Send any message in the group, then:

```bash
# Auto-detect
bash scripts/manage-pool.sh init-group

# Or manually
bash scripts/manage-pool.sh set-group <group_id>
```

To find the group ID manually:
```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" \
  | python3 -c "
import sys, json
for r in json.load(sys.stdin).get('result', []):
    c = r.get('message', {}).get('chat', {})
    if c.get('type') in ('group', 'supergroup'):
        print(f'{c[\"id\"]}  {c.get(\"title\", \"\")}')"
```

### Step 7: Assign Projects

```bash
bash scripts/manage-pool.sh assign <bot_username> <project_name> <path>

# Examples:
bash scripts/manage-pool.sh assign frontend_bot my-app ~/my-app
bash scripts/manage-pool.sh assign api_bot backend ~/backend
```

### Step 8: Start

```bash
bash scripts/daemon.sh start
bash scripts/daemon.sh status   # verify all bots online
```

## Usage

### Interacting with Bots

| Action | How | Example |
|--------|-----|---------|
| Run a task | `@bot request` | `@frontend_bot fix the login bug` |
| Continue conversation | Reply to bot's message | Reply with follow-up |
| Quote + ask | Reply to any message + `@bot` | Select message → Reply → `@bot explain this` |
| Photo analysis | Photo + `@bot caption` | Photo + `@api_bot what's this error?` |
| Voice command | Reply to bot with voice | Record voice on bot's message |

### Quoting Messages

When you reply to a message while @mentioning a bot, the quoted content is automatically included:

- **Quoted text** — full text passed to Claude
- **Quoted photo** — downloaded and analyzed by Claude
- **Quoted voice** — transcribed and passed as text
- **Quoted file** — filename and type included

### Master Bot Commands

| Command | Description |
|---------|-------------|
| `@master help` | Show all commands and project list |
| `@master status` | Force-refresh project dashboard |
| `@master search <keyword>` | Grep across all projects |
| `@master cron list` | List scheduled tasks |
| `@master cron add @bot HH:MM task` | Daily task at HH:MM |
| `@master cron add @bot */N task` | Every N minutes |
| `@master cron del <id>` | Delete task |

### Daemon Management

```bash
daemon.sh start      # Start daemon (background)
daemon.sh stop       # Stop daemon
daemon.sh restart    # Restart
daemon.sh status     # Status + bot pool overview
daemon.sh logs       # Last 50 log lines
daemon.sh logs 200   # Last 200 lines
```

## Configuration

### Access & Permission (Two-Layer Control)

Permissions are configured in two layers. Set globally or per-bot in `bot-pool.json`:

**Layer 1: Access Level** (`accessLevel`) — what the bot CAN do:

| Level | Behavior | Best for |
|-------|----------|----------|
| `readWrite` (default) | Read and write files, run commands | Admins, trusted collaborators |
| `readOnly` | Read, search, analyze only. No file edits, no write commands. | Reviewers, new members, auditing |

**Layer 2: Permission Mode** (`permissionMode`) — how writes are authorized (only when `readWrite`):

| Mode | Behavior | Best for |
|------|----------|----------|
| `allowAll` (default) | Bash, Edit, Write, Agent, Skill pre-authorized. No prompts. | Trusted single-user setup |
| `approve` | First run read-only. If writes needed, Telegram button asks for approval. Retry with approved tools. | Multi-user teams, sensitive projects |

**Permission Matrix** — what each combination allows:

| `accessLevel` | `permissionMode` | Read/Search | Bash (read) | Edit/Write | Bash (write) | Approval |
|---------------|------------------|:-----------:|:-----------:|:----------:|:------------:|:--------:|
| `readWrite` | `allowAll` | ✅ | ✅ | ✅ | ✅ | Auto |
| `readWrite` | `approve` | ✅ | ✅ | ✅ | ✅ | Button confirm |
| `readOnly` | (ignored) | ✅ | ✅ | ❌ | ❌ | N/A |

Combined with access control:

| User role | Bot has `allowedUsers` | Can use bot | Effective access |
|-----------|----------------------|:-----------:|-----------------|
| **Admin** (`admins` list) | Any | ✅ | Bot's `accessLevel` + `permissionMode` |
| **Member** (in `allowedUsers`) | Lists this user | ✅ | Bot's `accessLevel` + `permissionMode` |
| **Member** (not in list) | Doesn't list user | ❌ | No access |
| **Others** | Any | ❌ | Silently ignored |

### bot-pool.json

All configuration lives in a single file — `~/.claude/channels/telegram/bot-pool.json`.

The setup wizard generates a complete config with all defaults visible. Example:

```json
{
  "admins": ["123456789"],
  "bots": [
    { "token": "123:AAH...", "username": "master_bot", "role": "master" },
    { "token": "456:AAH...", "username": "proj_bot", "role": "project",
      "assignedProject": "my-app", "assignedPath": "/home/user/my-app",
      "accessLevel": "readWrite",
      "permissionMode": "approve",
      "allowedUsers": ["111111111", "222222222"] }
  ],
  "sharedGroupId": "-100123456789",
  "accessLevel": "readWrite",
  "permissionMode": "allowAll",
  "masterExecute": false,
  "maxConcurrent": 3,
  "rateLimitSeconds": 5,
  "sessionTimeoutMinutes": 10,
  "dashboardIntervalMinutes": 30,
  "memoryIntervalMinutes": 120,
  "whisperLanguage": ""
}
```

#### Global Settings

| Field | Default | Description |
|-------|---------|-------------|
| `admins` | **(required)** | Admin user ID list. Admins can use **all** bots. Replaces legacy `ownerId`. |
| `accessLevel` | `"readWrite"` | Global default. `"readWrite"` = full access. `"readOnly"` = read/search only, no writes. |
| `permissionMode` | `"allowAll"` | Global default (only when readWrite). `"allowAll"` = pre-authorize. `"approve"` = button confirmation. |
| `memoryIntervalMinutes` | `120` | Auto-save conversation memory for active projects (minutes). `0` = disabled. |
| `masterExecute` | `false` | Allow master bot to run Claude tasks (not just admin commands). |
| `maxConcurrent` | `3` | Maximum parallel Claude invocations across all bots. |
| `rateLimitSeconds` | `5` | Minimum gap between invocations for the same bot. |
| `sessionTimeoutMinutes` | `10` | Claude invocation timeout. |
| `dashboardIntervalMinutes` | `30` | Dashboard auto-refresh interval. |
| `whisperLanguage` | (auto-detect) | Whisper language code for voice (e.g. `"zh"`, `"en"`, `"ja"`). |

#### Per-Bot Settings

| Field | Default | Description |
|-------|---------|-------------|
| `accessLevel` | (inherit global) | Override access level for this bot. `"readOnly"` for view-only access. |
| `permissionMode` | (inherit global) | Override permission mode for this bot (only when `readWrite`). |
| `allowedUsers` | `[]` | Member user IDs who can use this bot. Admins always have access. |

#### Access Control

| Role | Access | Can approve permissions |
|------|--------|----------------------|
| **Admin** (`admins` list) | All bots | Yes |
| **Member** (per-bot `allowedUsers`) | Only bots that list them | No |
| **Others** | None — silently ignored | No |

> Configuration changes take effect immediately — no daemon restart needed.
>
> Backward compatibility: `ownerId` (single string) still works as a fallback if `admins` is not set.

### manage-pool.sh Commands

```bash
manage-pool.sh add <token> [--master]        # Add bot
manage-pool.sh list                          # List all bots
manage-pool.sh assign <user> <name> <path>   # Assign project to bot
manage-pool.sh release [project]             # Release assignment
manage-pool.sh remove <username>             # Remove bot
manage-pool.sh set-group <id>                # Set group ID
manage-pool.sh init-group                    # Auto-detect group ID
manage-pool.sh set-mode <allowAll|approve>   # Set permission mode
```

## Architecture

```
watchdog.sh (process supervisor)
└── daemon.ts (single process)
    ├── grammY long-polling for all bots
    ├── @mention / reply → claude -p --continue --allowedTools --output-format stream-json
    │   ├── stream-json events → real-time progress message in group
    │   ├── result event → context/cost/token stats, send response, delete progress
    │   └── rate_limit_event → capture reset countdown
    ├── Dashboard: pinned message, auto-refresh every 30 min
    │   ├── Per-project: git status, context window usage bar, model, cost
    │   ├── Aggregate: total invocations, duration, cost, tokens by model
    │   └── Rate limit reset countdown
    ├── Periodic memory: auto-save for active projects (configurable interval)
    ├── Cron: checks scheduled tasks every minute
    ├── Restart detection: notifies group when daemon was restarted by a project bot
    └── Voice: ffmpeg (ogg→wav) → whisper → text → claude

~/.claude/channels/telegram/ (state directory)
├── bot-pool.json        # single config file: tokens, permissions, settings
├── cron.json            # scheduled tasks
├── dashboard-msg.json   # pinned dashboard message ID
├── daemon.pid           # running process ID
├── restart-note.json    # (transient) restart context from project bot
├── daemon.ts            → symlink to repo/src/daemon.ts
├── daemon.sh            → symlink to repo/scripts/daemon.sh
├── watchdog.sh          → symlink to repo/scripts/watchdog.sh
└── manage-pool.sh       → symlink to repo/scripts/manage-pool.sh
```

### Process Supervision

The daemon runs under a **watchdog** that auto-restarts on crash:
- Crashes are retried after 3 seconds
- If 5 crashes happen within 5 minutes (rapid crash loop), the watchdog gives up
- `daemon.sh stop` removes the PID file first, signaling the watchdog to exit cleanly

### Self-Modification Safety

When a project bot modifies the daemon's own code (e.g., the `telegram-pool` project bot editing `daemon.ts`):
1. Claude is instructed to finish all edits and send a reply first
2. Optionally writes a `restart-note.json` with a summary
3. Runs `daemon.sh restart` as the very last command
4. Watchdog restarts the daemon, master bot notifies the group with the summary

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Bot not responding in group | Group Privacy enabled | @BotFather → Bot Settings → Group Privacy → **Turn off** |
| `409 Conflict` in logs | Another process polling same bot | `pkill -f "claude.*channels"` then `daemon.sh restart` |
| Bot replies `(no output)` | Empty prompt or stdin timeout | Ensure message has content beyond @mention |
| Progress stuck, no response | Claude session hung or timed out | `daemon.sh logs` to diagnose, then `daemon.sh restart` |
| Daemon keeps crashing | Rapid crash loop | Watchdog gives up after 5 rapid crashes. Check logs, fix issue, restart |
| Bot restarted itself | Project bot edited daemon code | Expected — watchdog auto-restarts, master bot notifies group |
| Dashboard shows no data | No invocations since daemon start | Stats are in-memory, reset on restart. Make a call first |

## Security & Privacy

### Data stays local

All data is stored locally on your machine — **nothing is sent to third-party servers**:

| Data | Location | Shared with |
|------|----------|-------------|
| Bot tokens, config | `~/.claude/channels/telegram/bot-pool.json` | Nobody |
| Logs, session state | `~/.claude/channels/telegram/` | Nobody |
| Project source code | Your local directories | Nobody |

The only external communication is:
- **Telegram Bot API** — sending/receiving messages (your bots, your group)
- **Claude API** — running Claude Code tasks (your subscription)

No analytics, no telemetry, no cloud sync, no remote database.

### Access control

- **Role-based access**: admins can use all bots; members only access bots that list them in `allowedUsers`; all others silently ignored
- **Two-layer permissions**: `accessLevel` (readWrite/readOnly) + `permissionMode` (allowAll/approve) — configurable globally and per-bot
- **Env isolation**: Claude subprocesses receive filtered environment variables — bot tokens and sensitive keys are excluded
- **Token protection**: `bot-pool.json` stored with mode 0600, excluded from git via `.gitignore`

### Runtime protection

- **Rate limiting**: configurable concurrent limit and per-bot cooldown
- **Timeout**: configurable session timeout per invocation
- **Process supervision**: watchdog auto-restarts on crash, gives up after 5 rapid crashes
- **Self-restart safety**: when a project bot modifies daemon code, it finishes work and replies before restarting

## Acknowledgements

Dashboard design inspired by [claude-hud](https://github.com/jarrodwatts/claude-hud) — context window tracking and session metrics concepts.

## License

MIT
