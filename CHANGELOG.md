## [0.4.0] - 2026-03-22

### Features
- Multi-panel layout: drag conversations from sidebar to center area for side-by-side view
- Panels are 50% width each, horizontally scrollable with custom scrollbar at top
- Drag UX: 1 panel animates to 50% in real-time during drag, ghost placeholder shown
- 2+ panels: auto-scroll to right end during drag, dashed placeholder at end
- Custom scrollbar: hidden by default, thin 3px track at top, fades in on hover
- Wheel-to-horizontal-scroll in title bar zone (top 36px)
- Close button (✕) on each panel when 2+ panels open
- Flat conversation list sorted by recency with project name/branch as subtitle
- Font family selector in settings (Geist Mono, JetBrains Mono, Fira Code, etc.)
- Auto-rename conversations via Claude Code's custom-title JSONL entries

### Bug Fixes
- Fixed env var deletion: invalidate conversation-env query cache on save
- Prevent text selection during sidebar drag operations
- Disabled Tauri drag-drop interception for JS drop events to work

### Design Rationale
- dragCounter ref pattern prevents spurious dragleave when cursor crosses child elements
- Wheel listener on outerRef with Y-position check — only intercepts in title bar zone, doesn't block terminal/content scroll
- Scrollbar overlay uses pointerEvents: none (visual only), thumb has pointerEvents: auto for dragging
- document.body.style.userSelect toggled during drag to prevent global text selection

## [0.3.0] - 2026-03-21

### Features
- Embedded PTY terminal in main panel (portable-pty + xterm.js)
- Conversation view has [历史 | 终端] toggle in header
- Clicking "终端" tab spawns PTY with `claude --resume <session_id>` in workspace directory
- Terminal supports full ANSI rendering, cursorBlink, color scheme matching app theme
- WorkspaceGroup "+" button opens terminal in workspace directory for new sessions
- ConversationItem hover shows "▶" to resume in external terminal (fallback)
- Ctrl+C behavior (double to exit claude) is native Claude Code behavior, no special handling needed

### Design Rationale
- portable-pty chosen over tauri-plugin-shell for true PTY (vs pipe): supports ANSI, resize, raw mode
- xterm.js used for terminal rendering (same as VS Code terminal)
- PTY sessions keyed by conversation_id; session killed on component unmount
- PTY output streamed via Tauri events `pty:output:<session_id>`

### Notes & Caveats
- PTY session is fresh each time the terminal tab is opened (no persistence of terminal state)
- Claude Code's `--resume` flag requires `claude` to be in PATH
- If workspace path is not found, PTY falls back to /tmp

## [0.2.0] - 2026-03-21

### Features
- Syntax highlighting in code blocks (rehype-highlight + highlight.js github-dark theme)
- Enhanced conversation header: workspace path, branch, message count, tool call count, token total, date
- "$ terminal" button opens a terminal emulator in the workspace directory
- Search result deduplication: each conversation appears only once in search results

### Design Rationale
- highlight.js CSS imported from JS entry point to avoid PostCSS @import ordering issues
- Terminal opener tries gnome-terminal → konsole → xfce4-terminal → xterm in order
- Token/tool stats computed client-side from messages array to avoid extra DB query

### Notes & Caveats
- Terminal button silently fails if no supported terminal emulator is installed
- stats.toolCalls counts messages containing tool_use blocks, not individual tool invocations

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
