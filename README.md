# vsagent

A native desktop client for browsing, searching, and resuming [Claude Code](https://docs.anthropic.com/en/docs/claude-code) sessions. Built with Tauri v2 (Rust) + React + TypeScript.

> **Think of it as a GUI for your Claude Code history** — browse past conversations with rich rendering, search across all sessions, and resume any session in an embedded terminal.

## Features

### Session Browser
- Flat conversation list sorted by recency, with project name and git branch as subtitle
- Auto-imported from `~/.claude/projects/` — new sessions appear automatically via file watcher
- Auto-rename: uses Claude Code's `custom-title` when available, falls back to first user message
- Per-conversation settings: environment variables injected at PTY spawn

### Rich Conversation Viewer
- **Human messages** — shown with "You" label and blue accent
- **Claude text** — rendered as Markdown with syntax-highlighted code blocks
- **Tool calls** — collapsible cards (`▶ Bash`, `▶ Read`, `▶ Write`, etc.) showing input parameters
- **Tool output** — monospace terminal output, scrollable and collapsible for long results
- Virtual scrolling for conversations with thousands of messages

### Multi-Panel Layout
- **Drag & drop** a conversation from the sidebar to the center area to open side-by-side panels
- Each panel is 50% width; scroll horizontally to see more panels
- Dragging over a single panel animates it to 50% in real-time with a ghost placeholder
- Custom scrollbar at top, hidden by default, fades in on hover
- Scroll horizontally with mouse wheel in the title bar zone

### Embedded Terminal
- Resume any session via `claude --resume <id>` in a built-in PTY terminal
- Terminal opens in the workspace's root directory automatically
- Full ANSI rendering, Unicode support, IME input (Chinese, Japanese, etc.)
- Image paste from clipboard (Ctrl+V) and file drag-and-drop

### Search
- Full-text search across all messages powered by SQLite FTS5
- Results show matching text with context, deduplicated per conversation
- Sidebar auto-opens when typing in the search bar

### Customization
- Themes: dark, light, system-follow
- Font family: Geist Mono, JetBrains Mono, Fira Code, IBM Plex Mono, Source Code Pro, Commit Mono
- Adjustable font size
- Keyboard shortcuts: `Ctrl+B` toggle sidebar

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop runtime | [Tauri v2](https://tauri.app/) (Rust) |
| Frontend | React 19 + TypeScript + Vite 6 |
| Styling | Tailwind CSS v4 |
| UI state | Zustand |
| Server state | TanStack Query v5 |
| Terminal | xterm.js + portable-pty (Rust) |
| Database | SQLite + FTS5 via rusqlite |
| Markdown | react-markdown + rehype-highlight |

## Prerequisites

- **Rust** — install via [rustup](https://rustup.rs/)
- **Node.js 20+**
- **Claude Code** — `npm install -g @anthropic-ai/claude-code`

### Linux additional dependencies

```bash
# Ubuntu / Debian
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# Clipboard support (for image paste in terminal)
sudo apt install xclip          # X11
# or
sudo apt install wl-clipboard   # Wayland
```

> vsagent reads session data written by Claude Code. You need at least one session in `~/.claude/projects/` for the browser to show anything.

## Getting Started

```bash
git clone https://github.com/emoPointer/vsagent.git
cd vsagent
npm install

# Development mode (hot-reload)
npm run tauri dev
```

The app scans `~/.claude/projects/` on startup and imports JSONL session files into a local SQLite database at `~/.vsagent/vsagent.db`.

## Building

```bash
# Production build
npm run tauri build

# Output: src-tauri/target/release/bundle/
# - .deb (Linux)
# - .dmg / .app (macOS)
# - .msi (Windows)
```

## Usage

### Browsing Sessions

The left sidebar lists all conversations sorted by most recent activity. Each entry shows the conversation title, project name, git branch, and a relative timestamp. Hover the left edge or press `Ctrl+B` to toggle the sidebar.

### Multi-Panel View

Drag any conversation from the sidebar into the center area. Panels arrange horizontally at 50% width each. Use the mouse wheel over the title bar area to scroll between panels. Click the ✕ button to close a panel.

### Resuming in Terminal

Click a conversation to open it, then switch to **Terminal** mode via the tab in the header. The embedded terminal runs `claude --resume <session-id>` in the original workspace directory.

### Per-Conversation Environment Variables

Click the gear icon on any conversation in the sidebar to set environment variables. These are injected when spawning the PTY terminal. Format: one `KEY=VALUE` per line, no quotes.

### Searching

Use the search bar at the top to search across all messages. Results highlight matching text with surrounding context. The search uses SQLite FTS5 for fast full-text indexing.

## Architecture

```
vsagent/
├── src/                          # React frontend
│   ├── components/
│   │   ├── sidebar/              # ConversationItem, SidebarContent, SearchBar
│   │   ├── conversation/         # ConversationView, MessageList
│   │   │   └── blocks/           # TextBlock, ToolUseBlock, ToolResultBlock
│   │   ├── panels/               # MultiPanelArea (drag-to-add, scrollbar)
│   │   ├── terminal/             # TerminalView (xterm.js + PTY)
│   │   ├── settings/             # SettingsPanel
│   │   └── common/               # StatusDot, TimeAgo, ConfirmDialog
│   ├── features/
│   │   ├── conversations/        # Zustand store, React Query hooks, watcher
│   │   ├── settings/             # Settings store (theme, font, fontSize)
│   │   └── search/               # Search hook
│   ├── lib/
│   │   ├── tauri.ts              # All Tauri IPC wrappers
│   │   └── contentBlocks.ts      # Parses content_json into typed blocks
│   └── App.tsx                   # Root layout: titlebar, sidebar, main area
│
└── src-tauri/                    # Rust backend
    └── src/
        ├── db/                   # SQLite schema, migrations, CRUD
        ├── importer/             # JSONL parser + incremental sync
        ├── pty/                  # PTY session management
        ├── watcher/              # File watcher for ~/.claude/projects/
        ├── commands/             # Tauri command handlers
        ├── domain/               # Shared types
        └── lib.rs                # App setup, command registration
```

### Data Flow

1. **Import** — On startup and via file watcher, Rust reads JSONL files from `~/.claude/projects/**/*.jsonl` and inserts them into SQLite (idempotent via INSERT OR IGNORE).
2. **Query** — React components call Tauri commands which query SQLite. React Query caches results with 30s stale time.
3. **Terminal** — Rust spawns a PTY process; output is streamed to xterm.js via Tauri events (`pty:output:<id>`). Input flows back via the `pty_write` command.
4. **Watcher** — A debounced file watcher emits `watcher:changed` events when JSONL files are modified, triggering re-import and UI refresh.

### Message Content Model

Claude Code stores messages as JSON blocks in JSONL files. vsagent parses `content_json` to render structured content:

| Block type | Meaning | Rendering |
|------------|---------|-----------|
| `text` | Plain text / Markdown | Rendered via react-markdown |
| `tool_use` | Claude invoking a tool | Collapsible card with tool name + parameters |
| `tool_result` | Output returned to Claude | Monospace terminal output block |

A `user` message where all blocks are `tool_result` is treated as tool output (not human input).

## Tests

```bash
# Frontend unit tests
npm run test

# Rust unit tests
cd src-tauri && cargo test
```

## Roadmap

- [ ] Conversation export (Markdown, JSON)
- [ ] Session cost tracking (token usage, API costs)
- [ ] Keyboard navigation for conversation list
- [ ] Custom themes / color schemes
- [ ] Plugin system for custom renderers

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE)
