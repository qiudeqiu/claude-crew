# Project Rules

## Iron Rule: Repo Purity

The GitHub repo contains ONLY open-source project code and user-facing documentation. Everything else stays local:

- **Never commit**: internal planning (roadmap, product-brief), promotional content (video/, scripts, articles), personal notes, .DS_Store, build artifacts (dist/)
- **Allowed in repo**: source code (src/), scripts (scripts/), README.md, README_CN.md, CLAUDE.md, LICENSE, package.json, docs/ (user-facing images only), .gitignore
- **Before every git add**: verify no internal files are staged. When in doubt, check .gitignore.
- **New directories**: if creating a new directory for internal use, add it to .gitignore immediately.

## Iron Rule: Highlights Sync

The Highlights section in README reflects the project's current capabilities. When new features are implemented that add selling points or solve new pain points, update the Highlights section. Always frame from the user's perspective (what they can DO), not the developer's perspective (how it's IMPLEMENTED). Narrative must always center on multi-project management and multi-person remote collaboration.

## Iron Rule: Changelog Sync

After completing a version milestone (v0.3, v0.4, etc.) per the roadmap, summarize all changes and append a new version section to the Changelog in both README.md and README_CN.md. Keep existing version entries. Format follows the v0.2.0 entry as template.

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
