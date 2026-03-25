[English](README.md) | [中文](README_CN.md)

# claude-telegram-bots

通过 Telegram 机器人池实现多项目 Claude Code 编排。

把一个 Telegram 群组变成你所有 Claude Code 项目的远程控制中心。每个项目分配一个专属机器人 —— @提及执行任务、回复继续对话、语音指令、自动看板、定时任务。

## 工作原理

```
Telegram 群组 "我的项目"
┌──────────────────────────────────────┐
│  🏠 主控      📂 项目A    📂 项目B    │
│                                      │
│  你: @proj_a_bot 修复登录bug         │
│  项目A: 👀                           │
│  项目A: ⚙️ working... (12s)         │
│    → 🔧 Read: auth.ts               │
│    → 🔧 Edit: auth.ts               │
│  项目A: 已修复，修改了 auth.ts ...   │
│                                      │
│  📊 项目状态看板 (置顶)              │
│  ┌────────────────────────────────┐  │
│  │ 项目A  🌿 main · 2分钟前      │  │
│  │   📊 [opus-4-6] ████░░░░ 38%  │  │
│  │ 项目B  🌿 feat/x · 1小时前    │  │
│  │   📊 [sonnet-4-6] ██░░░░ 15%  │  │
│  │ 3 次调用 | 2m15s | $0.45      │  │
│  │ ⏱ 额度重置: 2h34m            │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## 功能特性

- **一个项目一个机器人** —— 每个代码仓库对应一个专属 Telegram 机器人
- **@提及 = 执行** —— `@bot 修复登录bug` 在该项目目录运行 Claude Code
- **回复继续对话** —— 回复机器人的消息即可延续上下文
- **引用任意内容** —— 回复文字、图片或语音的同时 @机器人
- **实时进度** —— 工作中实时显示 Claude 正在使用的工具
- **主控机器人** —— 看板、搜索、定时任务、重启/记忆通知（必须配置）
- **项目看板** —— 置顶消息：git 状态、context 用量、费用、额度倒计时
- **定时任务** —— 为每个 bot 配置定时执行的任务
- **定时记忆** —— 自动保存活跃项目的对话上下文
- **语音 & 图片** —— Whisper 语音转文字，视觉能力分析截图
- **两层权限** —— 访问级别（读写/只读）+ 权限模式（预授权/按钮确认）
- **多用户访问** —— 管理员 + 按 bot 配置成员权限

## 前置要求

- **[Claude Code CLI](https://claude.ai/claude-code)** —— 本地安装并登录，需要有效订阅（Max 或 Pro）
- **[Bun](https://bun.sh)** >= 1.0 —— 运行时
- **[ffmpeg](https://ffmpeg.org)** + **[whisper](https://github.com/openai/whisper)** —— 可选，用于语音转文字

> 本项目通过 CLI 模式（`claude -p`）在本地运行 Claude Code，需要在同一台机器上运行。不支持 API key 模式。

## 安装指南

### 第一步：克隆和安装

```bash
git clone https://github.com/qiudeqiu/claude-telegram-bots.git
cd claude-telegram-bots
bun install
```

### 第二步：在 Telegram 创建机器人

打开 [@BotFather](https://t.me/BotFather)：

1. 发送 `/newbot`，选择名称和用户名
2. **保存 token**（格式：`123456789:AAH...`）
3. 为每个机器人重复以上步骤

**需要多少个机器人？**

| 角色 | 数量 | 用途 |
|------|------|------|
| 主控机器人 | 1 | 管理命令：help、status、search、cron |
| 项目机器人 | 每个项目 1 个 | 在对应项目目录运行 Claude Code |

例：3 个项目 = 1 主控 + 3 项目机器人 = 共 4 个

### 第三步：运行安装脚本

```bash
bash scripts/setup.sh
```

脚本会：
- 检查依赖（bun、claude、ffmpeg、whisper）
- 要求输入你的 Telegram User ID（从 [@userinfobot](https://t.me/userinfobot) 获取）
- 创建状态目录 `~/.claude/channels/telegram/`
- 选择权限模式（allowAll 或 approve）
- 创建符号链接

### 第四步：添加机器人到池

```bash
# 主控机器人（只需一个）
bash scripts/manage-pool.sh add <主控token> --master

# 项目机器人
bash scripts/manage-pool.sh add <项目token1>
bash scripts/manage-pool.sh add <项目token2>

# 确认
bash scripts/manage-pool.sh list
```

### 第五步：创建 Telegram 群组

1. 在 Telegram 创建一个**私密群组**
2. 把**所有机器人**（主控 + 项目）拉进群
3. **关键步骤** —— 对每个机器人在 @BotFather 中：

   `/mybots` → 选择机器人 → **Bot Settings** → **Group Privacy** → **Turn off**

   > 不关闭 Group Privacy，机器人无法看到群消息！

### 第六步：设置群组 ID

在群里发一条消息，然后：

```bash
# 自动检测
bash scripts/manage-pool.sh init-group

# 或手动设置
bash scripts/manage-pool.sh set-group <群组ID>
```

手动获取群组 ID：
```bash
curl -s "https://api.telegram.org/bot<TOKEN>/getUpdates" \
  | python3 -c "
import sys, json
for r in json.load(sys.stdin).get('result', []):
    c = r.get('message', {}).get('chat', {})
    if c.get('type') in ('group', 'supergroup'):
        print(f'{c[\"id\"]}  {c.get(\"title\", \"\")}')"
```

### 第七步：分配项目

```bash
bash scripts/manage-pool.sh assign <机器人用户名> <项目名> <项目路径>

# 示例：
bash scripts/manage-pool.sh assign frontend_bot my-app ~/my-app
bash scripts/manage-pool.sh assign api_bot backend ~/backend
```

### 第八步：启动

```bash
bash scripts/daemon.sh start
bash scripts/daemon.sh status   # 确认所有机器人在线
```

## 使用方法

### 与机器人交互

| 操作 | 方式 | 示例 |
|------|------|------|
| 执行任务 | `@bot 需求` | `@frontend_bot 修复登录bug` |
| 继续对话 | 回复机器人消息 | 回复并追问 |
| 引用 + 提问 | 回复任意消息 + `@bot` | 选中消息 → 回复 → `@bot 解释一下` |
| 图片分析 | 图片 + `@bot 说明` | 截图 + `@api_bot 这个报错怎么回事？` |
| 语音指令 | 回复机器人消息发语音 | 对着机器人的消息录语音 |

### 引用消息

回复一条消息的同时 @机器人时，引用内容会自动包含：

- **文字** —— 全文传给 Claude
- **图片** —— 下载后由 Claude 分析
- **语音** —— 转文字后传给 Claude
- **文件** —— 附带文件名和类型信息

### 主控机器人命令

| 命令 | 说明 |
|------|------|
| `@主控 help` | 显示所有命令和项目列表 |
| `@主控 status` | 强制刷新项目看板 |
| `@主控 search <关键词>` | 跨项目搜索代码 |
| `@主控 restart` | 重启 daemon（重新加载配置） |
| `@主控 cron list` | 查看定时任务 |
| `@主控 cron add @bot HH:MM 任务` | 每天定时执行 |
| `@主控 cron add @bot */N 任务` | 每 N 分钟执行 |
| `@主控 cron del <id>` | 删除定时任务 |

### Daemon 管理

```bash
daemon.sh start      # 启动（后台运行）
daemon.sh stop       # 停止
daemon.sh restart    # 重启
daemon.sh status     # 状态 + 机器人池概览
daemon.sh logs       # 最近 50 行日志
daemon.sh logs 200   # 最近 200 行
```

## 配置

### 访问与权限（两层控制）

权限分两层配置，可在全局或单 bot 级别设置：

**第一层：访问级别**（`accessLevel`）— bot 能做什么：

| 级别 | 行为 | 适用场景 |
|------|------|----------|
| `readWrite`（默认） | 可读写文件、执行命令 | 管理员、可信协作者 |
| `readOnly` | 仅可读取、搜索、分析。禁止编辑文件和写入命令 | 审查人员、新成员、审计 |

**第二层：权限模式**（`permissionMode`）— 写操作如何授权（仅 `readWrite` 时生效）：

| 模式 | 行为 | 适用场景 |
|------|------|----------|
| `allowAll`（默认） | Bash、Edit、Write、Agent、Skill 预授权，无确认提示 | 个人可信环境 |
| `approve` | 先以只读运行。如需写操作，Telegram 弹出按钮确认后重试 | 多人团队、敏感项目 |

**权限配置矩阵** — 各组合下的实际能力：

| `accessLevel` | `permissionMode` | 读取/搜索 | Bash（只读） | 编辑/写入 | Bash（写入） | 授权方式 |
|---------------|------------------|:---------:|:-----------:|:---------:|:----------:|:-------:|
| `readWrite` | `allowAll` | ✅ | ✅ | ✅ | ✅ | 自动 |
| `readWrite` | `approve` | ✅ | ✅ | ✅ | ✅ | 按钮确认 |
| `readOnly` | （忽略） | ✅ | ✅ | ❌ | ❌ | 不适用 |

结合访问控制：

| 用户角色 | Bot 配置了 `allowedUsers` | 能否使用 | 实际权限 |
|---------|--------------------------|:-------:|---------|
| **管理员**（`admins` 列表） | 任意 | ✅ | 该 bot 的 `accessLevel` + `permissionMode` |
| **成员**（在 `allowedUsers` 中） | 包含此用户 | ✅ | 该 bot 的 `accessLevel` + `permissionMode` |
| **成员**（不在列表中） | 未包含此用户 | ❌ | 无权限 |
| **其他人** | 任意 | ❌ | 静默忽略 |

### bot-pool.json

所有配置集中在一个文件 — `~/.claude/channels/telegram/bot-pool.json`。

安装向导和 `manage-pool.sh add` 生成完整配置，全局设置和单 bot 字段的默认值均可见。示例：

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
  "whisperLanguage": ""
}
```

#### 全局配置

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `admins` | **（必填）** | 管理员用户 ID 列表。管理员可用**所有** bot。 |
| `accessLevel` | `"readWrite"` | 全局默认。`"readWrite"` = 读写。`"readOnly"` = 仅读取搜索，禁止写入 |
| `permissionMode` | `"allowAll"` | 全局默认（仅 readWrite 时生效）。`"allowAll"` = 预授权。`"approve"` = 按钮确认 |
| `memoryIntervalMinutes` | `120` | 定时记忆间隔（分钟）。`0` = 关闭 |
| `masterExecute` | `false` | 允许 master bot 执行非命令任务 |
| `maxConcurrent` | `3` | 最大并发 Claude 调用数 |
| `rateLimitSeconds` | `5` | 同一 bot 调用间隔（秒） |
| `sessionTimeoutMinutes` | `10` | 单次调用超时（分钟） |
| `dashboardIntervalMinutes` | `30` | 看板刷新间隔（分钟） |
| `whisperLanguage` | （自动检测） | 语音识别语言，如 `"zh"`、`"en"`、`"ja"` |

#### 单 Bot 配置

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `accessLevel` | （继承全局） | 覆盖该 bot 的访问级别。`"readOnly"` 为仅查看 |
| `permissionMode` | （继承全局） | 覆盖该 bot 的权限模式（仅 `readWrite` 时生效） |
| `allowedUsers` | `[]` | 可使用该 bot 的成员 ID 列表。管理员始终有权限 |

#### 访问控制

| 角色 | 访问范围 | 可审批权限 |
|------|----------|-----------|
| **管理员**（`admins` 列表） | 所有 bot | 是 |
| **成员**（bot 级 `allowedUsers`） | 仅配置了的 bot | 否 |
| **其他人** | 无 — 静默忽略 | 否 |

> 配置修改后无需重启 daemon — 每次调用时自动重新读取。
>

### manage-pool.sh 命令

```bash
manage-pool.sh add <token> [--master]      # 添加机器人
manage-pool.sh list                         # 列出所有机器人
manage-pool.sh assign <用户名> <名称> <路径>  # 分配项目
manage-pool.sh release [项目名]              # 释放分配
manage-pool.sh remove <用户名>               # 移除机器人
manage-pool.sh set-group <ID>               # 设置群组 ID
manage-pool.sh init-group                   # 自动检测群组
```

## 架构

```
watchdog.sh（进程守护）
└── daemon.ts（单进程）
    ├── grammY 长轮询所有机器人
    ├── @提及 / 回复 → claude -p --continue --allowedTools --output-format stream-json
    │   ├── stream-json 事件 → 群里实时进度消息
    │   ├── result 事件 → context/费用/token 统计，发送结果，删除进度
    │   └── rate_limit_event → 额度重置倒计时
    ├── 看板：置顶消息，可配置刷新间隔
    │   ├── 每个项目：git 状态、context 用量条、模型、费用
    │   ├── 汇总：调用次数、耗时、费用、各模型 token
    │   └── 额度重置倒计时
    ├── 定时记忆：为活跃项目自动保存上下文（可配置间隔）
    ├── 定时任务：每分钟检查
    ├── 重启检测：daemon 被项目 bot 重启时通知群组
    └── 语音：ffmpeg（ogg→wav）→ whisper → 文字 → claude

~/.claude/channels/telegram/（状态目录）
├── bot-pool.json        # 唯一配置文件：token、权限、设置
├── cron.json            # 定时任务
├── dashboard-msg.json   # 置顶看板消息 ID
├── daemon.pid           # 运行中的进程 ID
├── restart-note.json    # （临时）项目 bot 重启时的上下文
├── daemon.ts            → 符号链接到 repo/src/daemon.ts
├── daemon.sh            → 符号链接到 repo/scripts/daemon.sh
├── watchdog.sh          → 符号链接到 repo/scripts/watchdog.sh
└── manage-pool.sh       → 符号链接到 repo/scripts/manage-pool.sh
```

### 进程守护

daemon 在 **watchdog** 下运行，崩溃自动重启：
- 崩溃后 3 秒重试
- 5 分钟内连续崩溃 5 次则放弃
- `daemon.sh stop` 先删除 PID 文件，watchdog 检测到后正常退出

### 自修改安全

当项目 bot 修改了 daemon 自身的代码（例如 telegram-pool 项目的 bot 编辑 `daemon.ts`）：
1. Claude 先完成所有编辑并回复结果
2. 可选写入 `restart-note.json` 记录修改摘要
3. 最后执行 `daemon.sh restart`
4. watchdog 重启 daemon，master bot 在群里通知摘要

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 机器人在群里不响应 | Group Privacy 未关闭 | @BotFather → Bot Settings → Group Privacy → **Turn off** |
| 日志出现 `409 Conflict` | 有其他进程在轮询同一个机器人 | `pkill -f "claude.*channels"` 然后 `daemon.sh restart` |
| 机器人回复 `(无输出)` | 消息内容为空或 stdin 超时 | 确保消息除了 @提及外还有实际内容 |
| 进度卡住没反应 | Claude 会话超时或崩溃 | `daemon.sh logs` 查看日志，然后 `daemon.sh restart` |
| Daemon 持续崩溃 | 快速崩溃循环 | watchdog 连续 5 次崩溃后放弃。检查日志，修复后重启 |
| 机器人自己重启了 | 项目机器人修改了 daemon 代码 | 正常现象 —— watchdog 自动重启，群里会收到通知 |
| 看板无数据 | daemon 启动后未调用 | 统计在内存中，重启后重置。先发一次任务 |

## 安全与隐私

### 数据完全本地化

所有数据存储在你的本地机器上 — **不会发送到任何第三方服务器**：

| 数据 | 位置 | 共享给 |
|------|------|--------|
| Bot token、配置 | `~/.claude/channels/telegram/bot-pool.json` | 无 |
| 日志、会话状态 | `~/.claude/channels/telegram/` | 无 |
| 项目源代码 | 你的本地目录 | 无 |

唯一的外部通信：
- **Telegram Bot API** — 收发消息（你的 bot、你的群组）
- **Claude API** — 执行任务（你的订阅）

无数据分析、无遥测、无云端同步、无远程数据库。

### 访问控制

- **角色访问控制**：管理员可用所有 bot；成员仅可用配置了其 ID 的 bot；其他人静默忽略
- **两层权限**：`accessLevel`（读写/只读）+ `permissionMode`（预授权/按钮确认）— 可全局和单 bot 配置
- **环境隔离**：Claude 子进程接收过滤后的环境变量 — bot token 和敏感密钥被排除
- **Token 保护**：`bot-pool.json` 权限 0600，`.gitignore` 排除

### 运行时保护

- **并发限制**：可配置并发数和 bot 冷却时间
- **超时保护**：可配置单次调用超时
- **进程守护**：watchdog 崩溃自动重启，连续崩溃 5 次后放弃
- **自重启安全**：项目 bot 修改 daemon 代码时，先完成并回复，最后才重启

## 致谢

看板设计参考了 [claude-hud](https://github.com/jarrodwatts/claude-hud) —— context window 追踪和会话指标的理念。

## 开源协议

MIT
