# Project Rules

## Iron Rule: README Sync

After every code change, check if README.md needs updating. If any feature, configuration, architecture, or behavior described in README.md has changed, update it before considering the task complete.

## Daemon Self-Modification

This project runs as a daemon. When modifying `daemon.ts` or related files via a Telegram bot session:

1. Finish ALL edits first
2. Send reply/summary to the user
3. Write restart note: `echo '{"project":"...","summary":"..."}' > ~/.claude/channels/telegram/restart-note.json`
4. Run `daemon.sh restart` as the **very last command** — restarting kills your process

## Output Persistence

When executing tasks via Telegram, important outputs (plans, scripts, analysis, designs) should be saved as project files rather than only returned as chat messages. Chat messages are ephemeral and not shared across sessions. Files persist and are accessible to all future sessions.

Examples: save video scripts to `docs/`, save analysis to `docs/`, save plans to project root.

## Architecture

- Single daemon process, grammY long-polling for all bots
- `claude -p --allowedTools --output-format stream-json` for task execution
- Real-time progress via stream-json event parsing
- Smart routing: keyword match only (no Claude-based routing — too unreliable)
- Dashboard stats: in-memory accumulation per daemon lifecycle, not persisted
- Permission modes: `allowAll` (default) or `approve` (button confirm)
