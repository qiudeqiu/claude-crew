[English](README.md) | [中文](README_CN.md)

<p align="center">
  <img src="docs/banner.png" alt="claude-crew" width="100%">
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License"></a>
  <img src="https://img.shields.io/badge/runtime-Bun_%3E%3D1.0-f9f1e1" alt="Bun">
  <img src="https://img.shields.io/badge/Claude_Code-CLI-blueviolet" alt="Claude Code">
  <img src="https://img.shields.io/badge/Telegram-Bot_API-26A5E4" alt="Telegram">
</p>

**Claude Code — Every Project, Anywhere.**

One bot to assemble your Claude Code project crew.

A remote Claude Code solution for cross-device, multi-project parallel development — elegantly managed through one Telegram interface. Your **master bot** is the control center: add project bots, configure settings, manage team access, and monitor everything from an interactive button menu on your phone. Each **project bot** connects to a codebase and runs Claude Code on @mention. Go solo or invite your team — one group, all projects, everyone in their lane.

<p align="center">
  <img src="docs/concept.png" alt="claude-crew concept" width="100%">
</p>

## 📊 Remote Solutions Comparison

| Capability | **claude-crew** | Claude Code Remote | Claude Code Telegram Plugin | Happy Coder |
|-----------|:-:|:-:|:-:|:-:|
| Multi-project orchestration | ✅ One bot per project | ❌ Single session | ❌ Single bot | ✅ Multi-session |
| Team collaboration | ✅ 2-10 people, per-bot permissions | ❌ Solo only | ❌ Solo only | Partial (pair programming) |
| Setup from phone | ✅ Guided wizard in Telegram | ❌ Terminal only | ❌ Terminal config | ✅ QR pairing |
| Manage from phone | ✅ Button menus for bots, config, users | ✅ claude.ai / mobile app | ✅ Telegram | Partial |
| Background daemon | ✅ Runs in background with watchdog + auto-start | ❌ Terminal must stay open | ❌ Terminal must stay open | ❌ Terminal must stay open |
| @mention routing in group | ✅ | ❌ | ❌ | ❌ |
| Pinned dashboard | ✅ Git, context, cost, rate limit | ❌ | ❌ | ❌ |
| Built-in cron scheduler | ✅ | Via system cron | Via system cron | Via scripting |
| Real-time progress | ✅ Tool-level streaming | ✅ | ✅ | ✅ |
| Permission modes | ✅ allowAll / auto / approve / readOnly | ✅ | ✅ Pairing + allowlist | ✅ |
| Client requirement | Telegram (any device) | Web / Mobile app | Telegram | Native app / Web app |
| Multi-agent support | Claude only | Claude only | Claude only | Claude, Codex, Gemini |

## Table of Contents

- [Three Ways to Use](#-three-ways-to-use)
- [Master Bot — Your Control Center](#-master-bot--your-control-center)
- [Project Bots — Your Dev Team](#-project-bots--your-dev-team)
- [Recommendations](#-recommendations)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Usage](#-usage)
- [Configuration](#%EF%B8%8F-configuration)
- [Architecture](#-architecture)
- [Troubleshooting](#-troubleshooting)
- [Security & Privacy](#-security--privacy)
- [Contributing](#-contributing)

## 🎯 Three Ways to Use

### 1:1 Focus Mode

DM a project bot for private, focused control — one bot, one project, no interference.

![Focus Mode](docs/scene-focus.png)

### 1:N Hub Mode

Pull all bots into one group. @mention to switch between projects — no context switching.

![Hub Mode](docs/scene-hub.png)

### Team Mode

2–10 people in a shared group. Per-bot permissions keep everyone in their lane.

![Team Mode](docs/scene-team.png)

## 🤖 Master Bot — Your Control Center

The master bot manages everything. Send `menu` to open the interactive button menu — no commands to memorize.

### Guided setup

A step-by-step wizard walks you through first-time configuration: set the shared group, create project bots via @BotFather, assign projects — all from Telegram.

<!-- TODO: screenshot of setup wizard -->

### Bot management

Add, remove, and configure project bots with inline buttons. Token validation, project assignment, and one-click restart built in.

<!-- TODO: screenshot of bot management -->

### Config editor

Edit all global and per-bot settings via buttons — each field includes a description of what it does, and enum options explain their effects.

<!-- TODO: screenshot of config editor -->

### User management

Add admins and per-bot members by user ID. Last-admin protection prevents lockout.

### Pinned dashboard

Auto-refreshing pinned message showing all projects at a glance — git branch, last commit, context usage, cost, and rate limit countdown. Includes master bot identity and command reference.

![Dashboard](docs/feat-dashboard.png)

### Cron scheduler

Schedule recurring tasks per project bot — daily at a fixed time or every N minutes.

### Bilingual UI

Switch between English and Chinese with one tap. All menus, prompts, and dashboard follow the selected language.

## ⚡ Project Bots — Your Dev Team

Each project bot is assigned to a codebase. @mention it in the group (or DM it directly) to run Claude Code tasks.

### Instant feedback

Your message gets a 👀 reaction the moment a bot picks it up — you always know your request was received.

![Acknowledged](docs/feat-ack.png)

### Real-time progress

See exactly what Claude is doing as it works — file reads, edits, commands, all streamed live to your chat.

![Progress](docs/feat-progress.png)

### Flexible permissions

Three permission modes, configurable per bot or globally:

- **allowAll** — all tools pre-authorized, no prompts, fastest execution
- **auto** — Claude Code's background safety classifier auto-approves safe ops, blocks dangerous ones
- **approve** — first run read-only; if writes needed, sends a Telegram button for admin approval

![Permission](docs/feat-permission.png)

### Voice & photo

Send a photo for visual analysis, or reply with a voice message for hands-free commands. Voice is transcribed via Whisper and passed to Claude.

### Quote anything

Reply to any message — text, photo, voice, file, or sticker — while @mentioning a bot. The quoted content is automatically included in the prompt.

## 📋 Recommendations

### Who is this for?

| Scenario | Fit | Suggested config |
|----------|-----|-----------------|
| Solo developer, 2–5 projects | Best fit | `permissionMode: "allowAll"`, single admin |
| Small team (2–3 people) | Good fit | `permissionMode: "approve"`, per-bot `allowedUsers` |
| Shared machine, mixed trust | Use with caution | `accessLevel: "readOnly"` for untrusted users, `"approve"` for trusted |
| Enterprise / multi-tenant | Not designed for this | Consider Docker-isolated solutions instead |

### Configuration tips

- **Start with `approve` mode** if you're unsure — you can always switch to `allowAll` later
- **Set `readOnly` on sensitive projects** to let team members browse code without write risk
- **Use `allowedUsers` per bot** rather than adding everyone to `admins` — admins can use all bots
- **Lower `maxConcurrent`** if you're on a rate-limited Claude plan (default 3 may be too many)
- **Set `whisperLanguage`** explicitly (e.g. `"zh"`, `"en"`) for better voice recognition accuracy

### What this project does NOT do

- **No Docker isolation** — all bots run in the same process with access to the local filesystem. The built-in permission system (accessLevel + permissionMode + allowedUsers) provides sufficient control for personal and small-team use, but is not a security boundary for untrusted users.
- **No API key mode** — requires a local Claude Code CLI with an active subscription (Max or Pro). Does not support Anthropic API keys.
- **No cloud deployment** — designed to run on a local machine or personal server where your code lives.

## 📦 Prerequisites

> **This project is NOT a standalone AI bot.** It is a remote control layer on top of Claude Code CLI. You need a computer (Mac/Linux/server) running 24/7 with Claude Code CLI installed, logged in, and subscribed. Your Telegram messages are routed to this machine, which runs `claude -p` locally and sends results back. The setup script will verify dependencies automatically.

### Required

| Dependency | Why | Install |
|-----------|-----|---------|
| **[Claude Code CLI](https://claude.ai/claude-code)** | Core runtime — all AI tasks run through `claude -p` | `npm install -g @anthropic-ai/claude-code` |
| **Active subscription** | Claude Code requires Max or Pro plan | [claude.ai/pricing](https://claude.ai/pricing) |
| **Logged-in session** | CLI must be authenticated | Run `claude` and complete login |
| **[Bun](https://bun.sh)** >= 1.0 | Daemon runtime | `curl -fsSL https://bun.sh/install \| bash` |

### Optional

| Dependency | Why | Install |
|-----------|-----|---------|
| [ffmpeg](https://ffmpeg.org) | Voice message transcription | `brew install ffmpeg` |
| [whisper](https://github.com/openai/whisper) | Speech-to-text engine | `pipx install openai-whisper` |

### Verify before proceeding

```bash
claude --version    # should print version (not "command not found")
bun --version       # should print >= 1.0
```

## 🚀 Quick Start

**Terminal (one-time setup):**

```bash
git clone https://github.com/qiudeqiu/claude-crew.git && cd claude-crew
bash scripts/setup.sh    # asks for your Telegram User ID + master bot token, then starts daemon
```

> Create a master bot via [@BotFather](https://t.me/BotFather) first (`/newbot`). You only need one token to get started.

**Telegram (everything else):**

1. Create a private group, add your master bot
2. Disable Group Privacy: @BotFather → `/mybots` → select bot → **Bot Settings** → **Group Privacy** → **Turn off**
3. Send `@master setup` in the group — the interactive wizard guides you through:
   - Setting the group as your shared control group
   - Adding your first project bot (token → project name → path)
   - One-click restart to bring the bot online
4. Use `@master menu` for all ongoing management — bots, config, users

<details>
<summary><b>Detailed Setup Guide (step by step)</b></summary>

## Setup Guide

### Step 1: Clone and Install

```bash
git clone https://github.com/qiudeqiu/claude-crew.git
cd claude-crew
bun install
```

### Step 2: Create a Master Bot

Open [@BotFather](https://t.me/BotFather), send `/newbot`, and save the token.

> Project bots are added later from Telegram via `@master bots` — you don't need to create them now.

### Step 3: Run Setup

```bash
bash scripts/setup.sh
```

This will:
- Check dependencies (bun, claude, ffmpeg, whisper)
- Ask for your Telegram User ID (get from [@userinfobot](https://t.me/userinfobot))
- Ask for your master bot token (validates via Telegram API)
- Create `bot-pool.json` config file at `~/.claude/channels/telegram/`
- Link scripts and start the daemon

> `setup.sh` only sets up the master bot. Project bots are added afterwards via `@master bots` in Telegram or `manage-pool.sh add` in the terminal.

### Step 4: Telegram Setup

1. Create a **private group** in Telegram
2. Add your master bot to the group
3. **Critical** — disable Group Privacy in @BotFather:

   `/mybots` → select bot → **Bot Settings** → **Group Privacy** → **Turn off**

   > Bots cannot see group messages with Group Privacy enabled!

4. Send `@master setup` in the group — the wizard walks you through:
   - Setting the group as your shared control group
   - Creating a project bot via @BotFather
   - Assigning it to a project directory
   - One-click restart to bring it online

5. Use `@master menu` for all ongoing management

That's it. Everything else is managed from Telegram.

<details>
<summary><b>Terminal alternatives (optional)</b></summary>

If you prefer terminal over the interactive wizard:

```bash
# Set group ID
bash scripts/manage-pool.sh init-group

# Add project bots
bash scripts/manage-pool.sh add <project_token>

# Assign projects
bash scripts/manage-pool.sh assign <bot_username> <project_name> <path>

# Restart to apply
bash scripts/daemon.sh restart
```

</details>

</details>

## 📱 Usage

### Interacting with Bots

| Action | How | Example |
|--------|-----|---------|
| Run a task | `@bot request` | `@frontend_bot fix the login bug` |
| Continue conversation | Reply to bot's message | Reply with follow-up |
| Quote + ask | Reply to any message + `@bot` | Select message → Reply → `@bot explain this` |
| Photo analysis | Photo + `@bot caption` | Photo + `@api_bot what's this error?` |
| Voice command | Reply to bot with voice | Record voice on bot's message |

### Master Bot Commands

All master commands are accessible via **button menu** or text. Send `menu` to the master bot to open.

| Command | Description |
|---------|-------------|
| `@master menu` | Open interactive button menu |
| `@master setup` | First-time setup wizard |
| `@master bots` | Manage project bots (add/remove/configure) |
| `@master config` | Edit global settings via buttons |
| `@master users` | Manage admins & per-bot users |
| `@master status` | Force-refresh project dashboard |
| `@master search <keyword>` | Grep across all projects |
| `@master restart` | Restart daemon (reloads config) |
| `@master cron list` | List scheduled tasks |
| `@master cron add @bot HH:MM task` | Daily task at HH:MM |
| `@master cron add @bot */N task` | Every N minutes |
| `@master cron del <id>` | Delete task |

> The menu supports English and Chinese. Switch language via the `Lang` button in the menu.

### Daemon Management

```bash
daemon.sh start          # Start daemon (background)
daemon.sh stop           # Stop daemon
daemon.sh restart        # Restart
daemon.sh status         # Status + bot pool overview
daemon.sh logs           # Last 50 log lines
daemon.sh logs 200       # Last 200 lines
daemon.sh autostart      # Enable auto-start on login
daemon.sh no-autostart   # Disable auto-start
```

> **How it works:** As long as the daemon is running, all Telegram bots are online and responsive — no other processes needed. If your computer restarts or the daemon stops, bots go offline until the daemon is started again.
>
> **If bots go offline after a reboot**, run this in terminal to bring them back:
> ```bash
> ~/.claude/channels/telegram/daemon.sh start
> ```
> To avoid this, enable auto-start so the daemon launches automatically on login:
> ```bash
> ~/.claude/channels/telegram/daemon.sh autostart
> ```
> No sudo required — runs under your user account. The setup script will ask you about this during installation. Disable with `daemon.sh no-autostart`.

## ⚙️ Configuration

### Access & Permission (Two-Layer Control)

Permissions are configured in two layers. Set globally or per-bot — via `@master config` button menu or directly in `bot-pool.json`:

**Layer 1: Access Level** (`accessLevel`) — what the bot CAN do:

| Level | Behavior | Best for |
|-------|----------|----------|
| `readWrite` (default) | Read and write files, run commands | Admins, trusted collaborators |
| `readOnly` | Read, search, analyze only. No file edits, no write commands. | Reviewers, new members, auditing |

**Layer 2: Permission Mode** (`permissionMode`) — how writes are authorized (only when `readWrite`):

| Mode | Behavior | Best for |
|------|----------|----------|
| `allowAll` (default) | Bash, Edit, Write, Agent, Skill pre-authorized. No prompts. | Trusted single-user setup |
| `auto` | All actions auto-approved with Claude Code's background safety classifier. Blocks dangerous ops (production deploys, force push, data deletion).  | Balance of speed and safety |
| `approve` | First run read-only. If writes needed, Telegram button asks for approval. Retry with approved tools. | Multi-user teams, sensitive projects |

**Permission Matrix** — what each combination allows:

| `accessLevel` | `permissionMode` | Read/Search | Bash (read) | Edit/Write | Bash (write) | Approval |
|---------------|------------------|:-----------:|:-----------:|:----------:|:------------:|:--------:|
| `readWrite` | `allowAll` | ✅ | ✅ | ✅ | ✅ | Auto |
| `readWrite` | `auto` | ✅ | ✅ | ✅ | ✅ | Background classifier |
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

The setup wizard and `manage-pool.sh add` generate a complete config with all defaults visible — both global settings and per-bot fields. Example:

```json
{
  "admins": ["123456789"],
  "bots": [
    {
      "token": "123:AAH...",
      "username": "master_bot",
      "role": "master"
    },
    {
      "token": "456:AAH...",
      "username": "proj_bot",
      "role": "project",
      "assignedProject": "my-app",
      "assignedPath": "/home/user/my-app",
      "accessLevel": "readWrite",
      "permissionMode": "approve",
      "allowedUsers": ["111111111", "222222222"]
    }
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
  "whisperLanguage": "",
  "language": "en"
}
```

#### Global Settings

| Field | Default | Description |
|-------|---------|-------------|
| `admins` | **(required)** | Admin user ID list. Admins can use **all** bots. |
| `accessLevel` | `"readWrite"` | Global default. `"readWrite"` = full access. `"readOnly"` = read/search only, no writes. |
| `permissionMode` | `"allowAll"` | Global default (only when readWrite). `"allowAll"` = pre-authorize. `"auto"` = background safety classifier . `"approve"` = button confirmation. |
| `language` | `"en"` | Menu language. `"en"` or `"zh"`. Switchable via menu button. |
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

> Most configuration changes take effect immediately (permissions, rate limits, timeouts, etc.). **Exceptions that require restart:** `dashboardIntervalMinutes` and adding/removing bots. The interactive setup (`@master bots`, `@master config`) offers a one-click restart button when needed.

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

## 🏗 Architecture

![Architecture](docs/architecture.png)

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

## 🔧 Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Bot not responding in group | Group Privacy enabled | @BotFather → Bot Settings → Group Privacy → **Turn off** |
| `409 Conflict` in logs | Another process polling same bot | `pkill -f "claude.*channels"` then `daemon.sh restart` |
| Bot replies `(no output)` | Empty prompt or stdin timeout | Ensure message has content beyond @mention |
| Progress stuck, no response | Claude session hung or timed out | `daemon.sh logs` to diagnose, then `daemon.sh restart` |
| Daemon keeps crashing | Rapid crash loop | Watchdog gives up after 5 rapid crashes. Check logs, fix issue, restart |
| Bot restarted itself | Project bot edited daemon code | Expected — watchdog auto-restarts, master bot notifies group |
| Dashboard shows no data | No invocations since daemon start | Stats are in-memory, reset on restart. Make a call first |

## 🔒 Security & Privacy

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

## 🤝 Contributing

PRs welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Push and open a PR

For bugs, please include daemon logs (`daemon.sh logs 100`) and your `bot-pool.json` (redact tokens).

## 🙏 Acknowledgements

Dashboard design inspired by [claude-hud](https://github.com/jarrodwatts/claude-hud) — context window tracking and session metrics concepts.

## 📄 License

MIT
