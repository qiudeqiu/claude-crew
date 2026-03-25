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

你的 Claude Code 远程指挥部 —— 一个 bot 一个项目。一人群控所有项目，或将 AI 超能力共享给团队，同一个群里各司其职、互不干扰。任何设备、任何时间。

## 🎯 三种使用模式

### 1:1 专注模式

私聊 bot，一对一操控项目 —— 一个 bot、一个项目、互不干扰。

![Focus Mode](docs/scene-focus.png)

### 1:N 集中模式

把所有 bot 拉进一个群，@mention 切换项目 —— 不用来回跳转。

![Hub Mode](docs/scene-hub.png)

### 团队协作模式

2–10 人共用一个群，per-bot 权限控制谁能操作什么项目 —— 协作不冲突。

![Team Mode](docs/scene-team.png)

## ✨ 功能特性

### 即时反馈

发送消息后 bot 立即回应 👀 —— 你随时知道命令已被接收。

![Acknowledged](docs/feat-ack.png)

### 实时进度

Claude 工作时实时显示正在做什么 —— 读文件、编辑、执行命令，全部流式推送到聊天中。

![Progress](docs/feat-progress.png)

### 灵活权限

在预授权模式（快速、无确认）和审批模式（写操作前按钮确认）之间自由切换 —— 按 bot 或全局配置。

![Permission](docs/feat-permission.png)

### 置顶看板

Master bot 发送置顶看板，一览所有项目状态 —— git 分支、context 用量、费用、额度倒计时。

![Dashboard](docs/feat-dashboard.png)

### 更多特性

- **一个项目一个机器人** —— 每个代码仓库对应一个专属 Telegram 机器人
- **@提及 = 执行** —— `@bot 修复登录bug` 在该项目目录运行 Claude Code
- **回复继续对话** —— 回复机器人的消息即可延续上下文
- **引用任意内容** —— 回复文字、图片或语音的同时 @机器人
- **主控机器人** —— 看板、搜索、定时任务、重启/记忆通知（必须配置）
- **项目看板** —— 置顶消息：git 状态、context 用量、费用、额度倒计时
- **定时任务** —— 为每个 bot 配置定时执行的任务
- **定时记忆** —— 自动保存活跃项目的对话上下文
- **语音 & 图片** —— Whisper 语音转文字，视觉能力分析截图
- **多用户访问** —— 管理员 + 按 bot 配置成员权限

## 📊 方案对比

| 能力 | **claude-crew** | Claude Code Remote | Claude Code Telegram 插件 | Happy Coder |
|-----|:-:|:-:|:-:|:-:|
| 多项目编排 | ✅ 一个 bot 一个项目 | ❌ 单会话 | ❌ 单 bot | ❌ 单会话 |
| 团队协作 | ✅ 2-10 人，按 bot 配权限 | ❌ 仅单人 | ❌ 仅单人 | ❌ 仅单人 |
| 群内 @mention 路由 | ✅ | ❌ | ❌ | ❌ |
| 置顶看板 | ✅ Git、context、费用、额度 | ❌ | ❌ | ❌ |
| 定时任务 | ✅ | ❌ | ❌ | ❌ |
| 跨项目搜索 | ✅ | ❌ | ❌ | ❌ |
| 实时进度 | ✅ 工具级流式反馈 | ✅ | ✅ | ✅ |
| 权限模式 | ✅ allowAll / approve / readOnly | ✅ | ✅ 配对 + 白名单 | ✅ |
| 零安装客户端 | ✅ Telegram 已在手机上 | ❌ 仅终端 | ✅ Telegram | ❌ 需装原生 app |
| 多 agent 支持 | 仅 Claude | 仅 Claude | 仅 Claude | Claude、Codex、Gemini |
| 端到端加密 | Telegram 传输加密 | 不适用 | Telegram 传输加密 | ✅ 零知识加密 |
| 原生移动端体验 | Telegram（够用） | ❌ | Telegram | ✅ 精致原生 app |

## 📋 使用建议

### 适合谁？

| 场景 | 适合度 | 建议配置 |
|------|--------|---------|
| 个人开发者，2–5 个项目 | 最佳 | `permissionMode: "allowAll"`，单管理员 |
| 小团队（2–3 人） | 适合 | `permissionMode: "approve"`，per-bot `allowedUsers` |
| 共享机器，信任度不一 | 谨慎使用 | 不信任的用户设 `accessLevel: "readOnly"`，信任的设 `"approve"` |
| 企业 / 多租户 | 不适用 | 建议使用 Docker 隔离方案 |

### 配置建议

- **不确定时先用 `approve` 模式** —— 之后随时可以切换到 `allowAll`
- **敏感项目设 `readOnly`** —— 团队成员可以查看代码但没有写入风险
- **用 per-bot `allowedUsers`** 而不是把所有人加到 `admins` —— admin 可以操作所有 bot
- **限流计划下调低 `maxConcurrent`** —— 默认 3 可能太多
- **明确指定 `whisperLanguage`**（如 `"zh"`、`"en"`）—— 语音识别准确率更高

### 本项目不做什么

- **无 Docker 隔离** —— 所有 bot 运行在同一进程中，可访问本地文件系统。内置权限系统（accessLevel + permissionMode + allowedUsers）足以满足个人和小团队使用，但不构成对不信任用户的安全边界。
- **无 API key 模式** —— 需要本地安装 Claude Code CLI 并拥有有效订阅（Max 或 Pro），不支持 Anthropic API key。
- **无云部署** —— 设计为运行在代码所在的本地机器或个人服务器上。

## 📦 前置条件

> **本项目不是独立的 AI 机器人。** 它是 Claude Code CLI 之上的远程控制层。你需要一台 24/7 运行的电脑（Mac/Linux/服务器），上面安装并登录了 Claude Code CLI 且有有效订阅。你的 Telegram 消息会路由到这台机器，在本地执行 `claude -p` 后将结果返回。安装脚本会自动检查依赖。

### 必需

| 依赖 | 用途 | 安装方式 |
|------|------|---------|
| **[Claude Code CLI](https://claude.ai/claude-code)** | 核心运行时 —— 所有 AI 任务通过 `claude -p` 执行 | `npm install -g @anthropic-ai/claude-code` |
| **有效订阅** | Claude Code 需要 Max 或 Pro 计划 | [claude.ai/pricing](https://claude.ai/pricing) |
| **已登录会话** | CLI 必须已完成认证 | 运行 `claude` 并完成登录 |
| **[Bun](https://bun.sh)** >= 1.0 | Daemon 运行时 | `curl -fsSL https://bun.sh/install \| bash` |

### 可选

| 依赖 | 用途 | 安装方式 |
|------|------|---------|
| [ffmpeg](https://ffmpeg.org) | 语音消息转码 | `brew install ffmpeg` |
| [whisper](https://github.com/openai/whisper) | 语音转文字 | `pipx install openai-whisper` |

### 安装前验证

```bash
claude --version    # 应输出版本号（不是 "command not found"）
bun --version       # 应输出 >= 1.0
```

## 🚀 快速开始

```bash
git clone https://github.com/qiudeqiu/claude-crew.git && cd claude-crew && bun install
bash scripts/setup.sh          # 交互式安装向导
bash scripts/manage-pool.sh add <主控token> --master
bash scripts/manage-pool.sh add <项目token>
bash scripts/manage-pool.sh assign <bot用户名> <项目名> <路径>
bash scripts/daemon.sh start
```

> 在 [@BotFather](https://t.me/BotFather) 创建 bot，拉入私密群组，每个 bot 关闭 Group Privacy。

<details>
<summary><b>详细安装步骤</b></summary>

## 安装指南

### 第一步：克隆和安装

```bash
git clone https://github.com/qiudeqiu/claude-crew.git
cd claude-crew
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

</details>

## 📱 使用方法

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

## ⚙️ 配置

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

> 大部分配置修改后立即生效（权限、限流、超时等）。**需要 `daemon.sh restart` 的例外：**`dashboardIntervalMinutes` 和 `bots` 数组的增删。
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

## 🏗 架构

![Architecture](docs/architecture.png)

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

## 🔧 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 机器人在群里不响应 | Group Privacy 未关闭 | @BotFather → Bot Settings → Group Privacy → **Turn off** |
| 日志出现 `409 Conflict` | 有其他进程在轮询同一个机器人 | `pkill -f "claude.*channels"` 然后 `daemon.sh restart` |
| 机器人回复 `(无输出)` | 消息内容为空或 stdin 超时 | 确保消息除了 @提及外还有实际内容 |
| 进度卡住没反应 | Claude 会话超时或崩溃 | `daemon.sh logs` 查看日志，然后 `daemon.sh restart` |
| Daemon 持续崩溃 | 快速崩溃循环 | watchdog 连续 5 次崩溃后放弃。检查日志，修复后重启 |
| 机器人自己重启了 | 项目机器人修改了 daemon 代码 | 正常现象 —— watchdog 自动重启，群里会收到通知 |
| 看板无数据 | daemon 启动后未调用 | 统计在内存中，重启后重置。先发一次任务 |

## 🔒 安全与隐私

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

## 🤝 参与贡献

欢迎 PR！请先开 issue 讨论你想做的改动。

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feat/my-feature`)
3. 提交修改
4. Push 并发起 PR

报告 bug 时请附上 daemon 日志 (`daemon.sh logs 100`) 和 `bot-pool.json`（隐去 token）。

## 🙏 致谢

看板设计参考了 [claude-hud](https://github.com/jarrodwatts/claude-hud) —— context window 追踪和会话指标的理念。

## 📄 开源协议

MIT
