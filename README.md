# vsagent

A VS Code-style desktop IDE for managing AI agent sessions.

Phase A: Read-only history browser for Claude Code sessions.

## Features

- Browse Claude Code session history from `~/.claude/projects/`
- Conversations grouped by workspace (git repository)
- Full-text search across all messages (SQLite FTS5)
- Live updates via file watcher (new sessions appear automatically)
- Virtual scrolling for large conversation histories
- Markdown rendering for assistant messages

## Development

### Prerequisites

- Rust (install via rustup)
- Node.js 20+

### Run

```bash
npm install
npm run tauri dev
```

### Test

```bash
# Frontend tests
npm run test

# Rust tests
cd src-tauri && cargo test
```

### Build

```bash
npm run tauri build
```

## Architecture

- **Frontend**: React 19 + TypeScript + Vite 6 + Tailwind CSS
- **Backend**: Tauri v2 + Rust
- **Database**: SQLite with FTS5 (stored at `~/.vsagent/vsagent.db`)
- **State**: Zustand (UI state) + TanStack Query (server state)
