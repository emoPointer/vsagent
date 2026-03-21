# vsagent

A desktop application for browsing, searching, and continuing Claude Code AI agent sessions. Built with Tauri v2 (Rust) + React + TypeScript.

![vsagent screenshot](docs/screenshot.png)

## What it does

vsagent reads your Claude Code session history from `~/.claude/projects/` and gives you a fast, searchable UI to review past conversations and resume them in an embedded terminal.

**Key capabilities:**

- **Session browser** — All Claude Code sessions grouped by workspace (git repo), sorted by recent activity
- **Conversation viewer** — Full message history with structured rendering: text, tool calls (`▶ Bash`, `▶ Read`, etc.), and tool output in collapsible blocks
- **Embedded terminal** — Resume any session directly via `claude --resume <id>` in a built-in PTY terminal (powered by xterm.js). The terminal opens in the workspace's root directory automatically.
- **Full-text search** — Search across all messages with SQLite FTS5; results highlight in context
- **Live updates** — File watcher detects new sessions and messages as they're written
- **Themes** — Light, dark, and system-follow themes
- **Settings** — Configurable font size, panel layout, and other preferences

## Screenshots

```
┌─────────────────┬──────────────────────────────────────────┐
│  Workspaces     │  Conversation  │  Terminal                │
│                 │                │                          │
│ ▼ my-project    │ You            │  $ claude --resume ...   │
│   session 1     │  列出文件       │  > Loading session...    │
│   session 2     │               │  > Welcome back!         │
│                 │ Claude         │                          │
│ ▼ other-project │  ▶ Bash [展开] │                          │
│   session 3     │  ls -la        │                          │
│                 │  ├─ output ──  │                          │
│                 │  │ total 28    │                          │
│                 │  │ ...         │                          │
└─────────────────┴────────────────┴──────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop runtime | [Tauri v2](https://tauri.app/) (Rust) |
| Frontend | React 19 + TypeScript + Vite 6 |
| Styling | Tailwind CSS v4 |
| UI state | Zustand |
| Server state | TanStack Query (React Query v5) |
| Terminal | xterm.js + portable_pty (Rust) |
| Database | SQLite with FTS5, via `rusqlite` |
| Markdown | react-markdown + remark-gfm |

## Prerequisites

- **Rust** — install via [rustup](https://rustup.rs/)
- **Node.js 20+**
- **Claude Code** — install via `npm install -g @anthropic-ai/claude-code`

> vsagent reads session data written by Claude Code. You need Claude Code installed and at least one session in `~/.claude/projects/` for the browser to show anything.

## Getting Started

```bash
# Clone and install dependencies
git clone https://github.com/your-username/vsagent.git
cd vsagent
npm install

# Start in development mode (hot-reload)
npm run tauri dev
```

The app opens automatically. It scans `~/.claude/projects/` on startup and imports any JSONL session files into a local SQLite database at `~/.vsagent/vsagent.db`.

## Building

```bash
# Production build (outputs to src-tauri/target/release/bundle/)
npm run tauri build
```

## Usage

### Browsing Sessions

The left sidebar lists all workspaces (git repositories) with their sessions. Click any session to view its full conversation history in the main panel.

### Viewing Conversations

Messages are rendered with rich structure:

- **Your messages** — shown with a "You" label and blue accent
- **Claude's text replies** — rendered as Markdown
- **Tool calls** — shown as collapsible cards: `▶ ToolName` with the input parameters
- **Tool output** — shown as monospace terminal output, scrollable if long

### Resuming a Session in the Terminal

Switch to **Terminal mode** (button in the top bar) to open an embedded PTY terminal. The terminal automatically runs `claude --resume <session-id>` in the workspace's root directory, resuming the conversation from where it left off.

Chinese IME input (and other input methods) is fully supported.

### Searching

Use the search bar at the top of the sidebar to search across all messages. Results show the matching message with context.

## Architecture

```
vsagent/
├── src/                        # React frontend
│   ├── components/
│   │   ├── layout/             # Sidebar, MainPanel, ResizeHandle
│   │   ├── sidebar/            # WorkspaceGroup, ConversationItem, SearchBar
│   │   ├── conversation/       # ConversationView, MessageList
│   │   │   └── blocks/         # TextBlock, ToolUseBlock, ToolResultBlock
│   │   ├── terminal/           # TerminalView (xterm.js + Tauri PTY)
│   │   └── settings/           # SettingsPanel
│   ├── lib/
│   │   └── contentBlocks.ts    # Parses content_json into typed blocks
│   ├── store/                  # Zustand stores
│   └── types/                  # TypeScript interfaces
│
└── src-tauri/                  # Rust backend
    └── src/
        ├── db/                 # SQLite: schema, JSONL import, FTS search
        ├── pty/                # PTY session management (create/kill/resize/write)
        ├── fs/                 # File watcher for ~/.claude/projects/
        └── lib.rs              # Tauri command handlers
```

### Data Flow

1. **Import**: On startup (and via file watcher), Rust reads JSONL files from `~/.claude/projects/**/*.jsonl` and inserts them into SQLite.
2. **Query**: React components call Tauri commands (`get_workspaces`, `get_conversations`, `get_messages`, `search_messages`) which query SQLite.
3. **Terminal**: When the user opens the terminal, Rust spawns a PTY process and streams output back to xterm.js via Tauri events (`pty:output:<id>`).

### Message Content

Claude Code stores message content as JSON blocks in JSONL files. vsagent parses `content_json` to distinguish:

- `{"type":"text"}` — plain text / Markdown
- `{"type":"tool_use"}` — Claude invoking a tool (Bash, Read, Write, etc.)
- `{"type":"tool_result"}` — the output returned to Claude (treated as tool output, not human input)

## Tests

```bash
# Frontend unit tests (Vitest)
npm run test

# Rust unit tests
cd src-tauri && cargo test
```

## License

MIT
