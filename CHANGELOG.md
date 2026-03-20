## [0.1.0] - 2026-03-21

### Features
- Read-only history browser for Claude Code sessions
- SQLite database with FTS5 full-text search
- Three-column layout with drag-to-resize sidebar
- Conversation list grouped by workspace (git repository)
- Virtual scrolling for large conversation histories
- Markdown rendering for assistant messages
- File watcher for live session updates
- Debounced full-text search with result highlighting

### Design Rationale
- Tauri v2 chosen for native desktop performance with web UI flexibility
- SQLite FTS5 enables fast full-text search without external dependencies
- Incremental import (INSERT OR IGNORE) ensures re-imports are idempotent
- SHA256 workspace IDs derived from git root path for stable identity across renames
- React Query for server state + Zustand for UI state keeps concerns separate

### Notes & Caveats
- Phase A is read-only; no agent control features yet
- webkit2gtk system deps required for Linux (not bundled)
- FTS5 snippet tags stripped to plain text (no syntax highlighting in results)
