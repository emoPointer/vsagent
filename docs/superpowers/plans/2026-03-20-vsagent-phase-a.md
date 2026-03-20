# vsagent Phase A: History Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tauri v2 (Rust + React) desktop app that reads Claude Code JSONL session files from `~/.claude/projects/`, imports them into SQLite, and displays a searchable, browsable conversation history browser.

**Architecture:** Rust backend handles SQLite persistence (rusqlite + FTS5), JSONL parsing/import, and file watching (notify crate). React frontend renders a three-column layout with workspace/session sidebar, virtual-scrolled message view, and FTS5-powered search. All IPC goes through typed Tauri commands and events.

**Tech Stack:** Tauri v2, React 19, TypeScript, Rust 1.80+, rusqlite (bundled + FTS5), notify 6, Zustand 5, TanStack Query v5, TanStack Virtual v3, react-markdown 9, Tailwind CSS 3, shadcn/ui, Vitest

---

## File Map

```
vsagent/
├── src/                              # React frontend
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── MainPanel.tsx
│   │   │   └── ResizeHandle.tsx
│   │   ├── sidebar/
│   │   │   ├── WorkspaceGroup.tsx
│   │   │   ├── ConversationItem.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   └── FilterBar.tsx
│   │   ├── conversation/
│   │   │   ├── ConversationHeader.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageItem.tsx
│   │   │   ├── UserMessage.tsx
│   │   │   ├── AssistantMessage.tsx
│   │   │   └── EmptyState.tsx
│   │   └── common/
│   │       ├── StatusDot.tsx
│   │       ├── ProviderBadge.tsx
│   │       └── TimeAgo.tsx
│   ├── features/
│   │   ├── conversations/
│   │   │   ├── useConversations.ts
│   │   │   ├── useMessages.ts
│   │   │   └── conversationStore.ts
│   │   └── search/
│   │       └── useSearch.ts
│   ├── lib/
│   │   ├── tauri.ts
│   │   └── utils.ts
│   └── types/
│       └── index.ts
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── db/
│       │   ├── mod.rs
│       │   ├── migrations.rs
│       │   ├── workspace.rs
│       │   ├── conversation.rs
│       │   └── message.rs
│       ├── importer/
│       │   ├── mod.rs
│       │   ├── parser.rs
│       │   └── sync.rs
│       ├── watcher/
│       │   └── mod.rs
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── workspaces.rs
│       │   ├── conversations.rs
│       │   ├── messages.rs
│       │   └── search.rs
│       └── domain/
│           └── types.rs
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── .gitignore
```

---

## Task 1: Install Rust + Init Git + Create GitHub Repo

**Files:** `.gitignore`, `README.md`

- [ ] **Install Rust via rustup**

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustc --version   # expect: rustc 1.8x.x
cargo --version   # expect: cargo 1.8x.x
```

- [ ] **Init git in project root**

```bash
cd /home/emopointer/vsagent
git init
git checkout -b main
```

- [ ] **Create .gitignore**

```bash
cat > /home/emopointer/vsagent/.gitignore << 'EOF'
node_modules/
dist/
target/
src-tauri/target/
*.db
*.db-shm
*.db-wal
.env
.env.local
EOF
```

- [ ] **Create private GitHub repo and push**

```bash
cd /home/emopointer/vsagent
git add docs/ multi_agent_ide_plan.md .gitignore
git commit -m "chore: init project with design specs"
gh repo create emopointer/vsagent --private --source=. --remote=origin --push
```

Expected: repo created at `github.com/emopointer/vsagent` (private)

---

## Task 2: Scaffold Frontend (Vite + React + TypeScript)

**Files:** `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`

- [ ] **Create package.json**

```bash
cat > /home/emopointer/vsagent/package.json << 'EOF'
{
  "name": "vsagent",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "tauri": "tauri"
  }
}
EOF
```

- [ ] **Install frontend dependencies**

```bash
cd /home/emopointer/vsagent
npm install --save react@^19 react-dom@^19
npm install --save @tanstack/react-query@^5 @tanstack/react-virtual@^3
npm install --save zustand@^5
npm install --save react-markdown@^9 rehype-highlight@^7
npm install --save lucide-react date-fns
npm install --save-dev vite@^6 @vitejs/plugin-react@^4 typescript@^5
npm install --save-dev @types/react@^19 @types/react-dom@^19
npm install --save-dev vitest@^2 @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
npm install --save-dev tailwindcss@^3 postcss autoprefixer
npm install --save-dev @tauri-apps/cli@^2
npm install --save @tauri-apps/api@^2
```

- [ ] **Create vite.config.ts**

```typescript
// /home/emopointer/vsagent/vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
}));
```

- [ ] **Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

- [ ] **Configure Tailwind**

```bash
cd /home/emopointer/vsagent
npx tailwindcss init -p
```

Edit `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

- [ ] **Create index.html**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>vsagent</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Create src/main.tsx and test setup**

```tsx
// /home/emopointer/vsagent/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

```css
/* /home/emopointer/vsagent/src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-panel: #2d2d30;
  --text-primary: #cccccc;
  --text-muted: #888888;
  --accent: #007acc;
  --border: #3d3d3d;
}

body {
  background-color: var(--bg-primary);
  color: var(--text-primary);
  font-family: 'Segoe UI', system-ui, sans-serif;
  font-size: 13px;
  margin: 0;
  overflow: hidden;
}
```

```typescript
// /home/emopointer/vsagent/src/test-setup.ts
import "@testing-library/jest-dom";
```

- [ ] **Create placeholder App.tsx**

```tsx
// /home/emopointer/vsagent/src/App.tsx
export default function App() {
  return <div className="h-screen flex items-center justify-center text-white">vsagent loading...</div>;
}
```

- [ ] **Verify frontend builds**

```bash
cd /home/emopointer/vsagent
npm run build
```

Expected: `dist/` created, no errors

---

## Task 3: Initialize Tauri v2 Backend

**Files:** `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/build.rs`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`

- [ ] **Run Tauri init**

```bash
cd /home/emopointer/vsagent
npx tauri init
```

Answer prompts:
- App name: `vsagent`
- Window title: `vsagent`
- Web assets relative path: `../dist`
- Dev server URL: `http://localhost:1420`
- Frontend dev command: `npm run dev`
- Frontend build command: `npm run build`

This creates `src-tauri/` directory.

- [ ] **Replace src-tauri/Cargo.toml with full dependencies**

```toml
[package]
name = "vsagent"
version = "0.1.0"
description = "Agent IDE - unified session management"
authors = ["emopointer"]
edition = "2021"

[lib]
name = "vsagent_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = ["unstable"] }
tauri-plugin-shell = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.32", features = ["bundled", "modern-full"] }
rusqlite_migration = "1.3"
notify = "7"
notify-debouncer-mini = "0.4"
anyhow = "1"
sha2 = "0.10"
hex = "0.4"
dirs = "5"
log = "0.4"
env_logger = "0.11"
chrono = { version = "0.4", features = ["serde"] }
tokio = { version = "1", features = ["full"] }

[dev-dependencies]
tempfile = "3"
```

- [ ] **Create src-tauri/src/lib.rs (app state + setup)**

```rust
// /home/emopointer/vsagent/src-tauri/src/lib.rs
use std::sync::Mutex;
use rusqlite::Connection;

pub mod db;
pub mod domain;
pub mod importer;
pub mod watcher;
pub mod commands;

pub struct AppState {
    pub db: Mutex<Connection>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let conn = db::open().expect("failed to open database");
    db::migrations::run(&conn).expect("failed to run migrations");

    let state = AppState { db: Mutex::new(conn) };

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::workspaces::list_workspaces,
            commands::conversations::list_conversations,
            commands::conversations::pin_conversation,
            commands::conversations::archive_conversation,
            commands::messages::list_messages,
            commands::search::search_messages,
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            let data_dir = dirs::home_dir()
                .unwrap()
                .join(".claude")
                .join("projects");

            // Run initial import in background
            tauri::async_runtime::spawn(async move {
                let state = handle.state::<AppState>();
                let conn = state.db.lock().unwrap();
                if let Err(e) = importer::sync::import_all(&conn, &data_dir) {
                    log::error!("Initial import failed: {e}");
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error running tauri application");
}
```

- [ ] **Update src-tauri/src/main.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    vsagent_lib::run()
}
```

- [ ] **Verify Tauri compiles**

```bash
cd /home/emopointer/vsagent
cargo build --manifest-path src-tauri/Cargo.toml 2>&1 | tail -5
```

Expected: compiles (may be slow first time), no errors

- [ ] **Commit**

```bash
cd /home/emopointer/vsagent
git add .
git commit -m "feat: scaffold Tauri v2 + React + TypeScript project"
git push origin main
```

---

## Task 4: Domain Types

**Files:** `src-tauri/src/domain/types.rs`

- [ ] **Create domain/types.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/domain/types.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub root_path: String,
    pub git_repo_root: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub workspace_id: Option<String>,
    pub provider: String,
    pub title: Option<String>,
    pub status: String,
    pub branch_name: Option<String>,
    pub pinned: bool,
    pub archived: bool,
    pub last_message_at: Option<i64>,
    pub jsonl_path: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub id: String,
    pub conversation_id: String,
    pub parent_id: Option<String>,
    pub role: String,
    pub content_text: Option<String>,
    pub content_json: Option<String>,
    pub token_count_input: Option<i64>,
    pub token_count_output: Option<i64>,
    pub seq: i64,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub message_id: String,
    pub conversation_id: String,
    pub conversation_title: Option<String>,
    pub role: String,
    pub snippet: String,
    pub rank: f64,
}

// mod.rs
```

```rust
// /home/emopointer/vsagent/src-tauri/src/domain/mod.rs
pub mod types;
pub use types::*;
```

---

## Task 5: SQLite Migrations

**Files:** `src-tauri/src/db/mod.rs`, `src-tauri/src/db/migrations.rs`

- [ ] **Create db/mod.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/db/mod.rs
use anyhow::Result;
use rusqlite::Connection;
use dirs::home_dir;

pub mod migrations;
pub mod workspace;
pub mod conversation;
pub mod message;

pub fn open() -> Result<Connection> {
    let db_path = home_dir()
        .ok_or_else(|| anyhow::anyhow!("cannot find home dir"))?
        .join(".vsagent")
        .join("vsagent.db");

    std::fs::create_dir_all(db_path.parent().unwrap())?;
    let conn = Connection::open(&db_path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    Ok(conn)
}

pub fn open_in_memory() -> Result<Connection> {
    let conn = Connection::open_in_memory()?;
    conn.execute_batch("PRAGMA foreign_keys=ON;")?;
    Ok(conn)
}
```

- [ ] **Create db/migrations.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/db/migrations.rs
use anyhow::Result;
use rusqlite::Connection;

pub fn run(conn: &Connection) -> Result<()> {
    conn.execute_batch(SCHEMA)?;
    Ok(())
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS workspaces (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    root_path     TEXT NOT NULL UNIQUE,
    git_repo_root TEXT,
    updated_at    INTEGER NOT NULL,
    created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
    id              TEXT PRIMARY KEY,
    workspace_id    TEXT REFERENCES workspaces(id),
    provider        TEXT NOT NULL DEFAULT 'claude_code',
    title           TEXT,
    status          TEXT NOT NULL DEFAULT 'idle',
    branch_name     TEXT,
    pinned          INTEGER NOT NULL DEFAULT 0,
    archived        INTEGER NOT NULL DEFAULT 0,
    last_message_at INTEGER,
    jsonl_path      TEXT NOT NULL,
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
    id                  TEXT PRIMARY KEY,
    conversation_id     TEXT NOT NULL REFERENCES conversations(id),
    parent_id           TEXT,
    role                TEXT NOT NULL,
    content_text        TEXT,
    content_json        TEXT,
    token_count_input   INTEGER,
    token_count_output  INTEGER,
    seq                 INTEGER NOT NULL,
    created_at          INTEGER NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content_text,
    conversation_id UNINDEXED,
    id UNINDEXED
);

CREATE INDEX IF NOT EXISTS idx_conv_workspace ON conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conv_updated   ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_msg_conv       ON messages(conversation_id, seq);
"#;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::open_in_memory;

    #[test]
    fn migrations_run_twice_without_error() {
        let conn = open_in_memory().unwrap();
        run(&conn).unwrap();
        run(&conn).unwrap(); // idempotent
    }

    #[test]
    fn all_tables_created() {
        let conn = open_in_memory().unwrap();
        run(&conn).unwrap();

        let mut stmt = conn.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).unwrap();
        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .flatten()
            .collect();

        assert!(tables.contains(&"workspaces".to_string()));
        assert!(tables.contains(&"conversations".to_string()));
        assert!(tables.contains(&"messages".to_string()));
    }
}
```

- [ ] **Run tests**

```bash
cd /home/emopointer/vsagent/src-tauri
cargo test db::migrations
```

Expected: 2 tests pass

- [ ] **Commit**

```bash
git add src-tauri/src/db/ src-tauri/src/domain/
git commit -m "feat: SQLite schema, migrations, domain types"
```

---

## Task 6: DB CRUD (Workspace, Conversation, Message)

**Files:** `src-tauri/src/db/workspace.rs`, `conversation.rs`, `message.rs`

- [ ] **Create db/workspace.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/db/workspace.rs
use anyhow::Result;
use rusqlite::{Connection, params};
use crate::domain::Workspace;

pub fn upsert(conn: &Connection, ws: &Workspace) -> Result<()> {
    conn.execute(
        "INSERT INTO workspaces (id, name, root_path, git_repo_root, updated_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
           git_repo_root = excluded.git_repo_root,
           updated_at = excluded.updated_at",
        params![ws.id, ws.name, ws.root_path, ws.git_repo_root, ws.updated_at, ws.created_at],
    )?;
    Ok(())
}

pub fn list(conn: &Connection) -> Result<Vec<Workspace>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, root_path, git_repo_root, created_at, updated_at
         FROM workspaces ORDER BY name"
    )?;
    let rows = stmt.query_map([], |row| Ok(Workspace {
        id: row.get(0)?,
        name: row.get(1)?,
        root_path: row.get(2)?,
        git_repo_root: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    }))?;
    Ok(rows.flatten().collect())
}

pub fn find_by_path(conn: &Connection, root_path: &str) -> Result<Option<Workspace>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, root_path, git_repo_root, created_at, updated_at
         FROM workspaces WHERE root_path = ?1"
    )?;
    let mut rows = stmt.query_map(params![root_path], |row| Ok(Workspace {
        id: row.get(0)?,
        name: row.get(1)?,
        root_path: row.get(2)?,
        git_repo_root: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    }))?;
    Ok(rows.next().and_then(|r| r.ok()))
}
```

- [ ] **Create db/conversation.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/db/conversation.rs
use anyhow::Result;
use rusqlite::{Connection, params};
use crate::domain::Conversation;

pub fn upsert(conn: &Connection, c: &Conversation) -> Result<()> {
    conn.execute(
        "INSERT INTO conversations
           (id, workspace_id, provider, title, status, branch_name, pinned, archived,
            last_message_at, jsonl_path, created_at, updated_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)
         ON CONFLICT(id) DO UPDATE SET
           title = COALESCE(excluded.title, title),
           branch_name = excluded.branch_name,
           last_message_at = excluded.last_message_at,
           updated_at = excluded.updated_at",
        params![
            c.id, c.workspace_id, c.provider, c.title, c.status,
            c.branch_name, c.pinned as i64, c.archived as i64,
            c.last_message_at, c.jsonl_path, c.created_at, c.updated_at
        ],
    )?;
    Ok(())
}

pub fn list(conn: &Connection, workspace_id: Option<&str>) -> Result<Vec<Conversation>> {
    let sql = match workspace_id {
        Some(_) => "SELECT id,workspace_id,provider,title,status,branch_name,pinned,archived,
                           last_message_at,jsonl_path,created_at,updated_at
                    FROM conversations WHERE workspace_id=?1 AND archived=0
                    ORDER BY updated_at DESC",
        None => "SELECT id,workspace_id,provider,title,status,branch_name,pinned,archived,
                        last_message_at,jsonl_path,created_at,updated_at
                 FROM conversations WHERE archived=0
                 ORDER BY pinned DESC, updated_at DESC",
    };
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map(params![workspace_id.unwrap_or("")], |row| {
        Ok(Conversation {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            provider: row.get(2)?,
            title: row.get(3)?,
            status: row.get(4)?,
            branch_name: row.get(5)?,
            pinned: row.get::<_, i64>(6)? != 0,
            archived: row.get::<_, i64>(7)? != 0,
            last_message_at: row.get(8)?,
            jsonl_path: row.get(9)?,
            created_at: row.get(10)?,
            updated_at: row.get(11)?,
        })
    })?;
    Ok(rows.flatten().collect())
}

pub fn set_pinned(conn: &Connection, id: &str, pinned: bool) -> Result<()> {
    conn.execute(
        "UPDATE conversations SET pinned=?1 WHERE id=?2",
        params![pinned as i64, id],
    )?;
    Ok(())
}

pub fn set_archived(conn: &Connection, id: &str, archived: bool) -> Result<()> {
    conn.execute(
        "UPDATE conversations SET archived=?1 WHERE id=?2",
        params![archived as i64, id],
    )?;
    Ok(())
}

pub fn exists(conn: &Connection, id: &str) -> Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM conversations WHERE id=?1",
        params![id],
        |r| r.get(0),
    )?;
    Ok(count > 0)
}
```

- [ ] **Create db/message.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/db/message.rs
use anyhow::Result;
use rusqlite::{Connection, params};
use crate::domain::{Message, SearchResult};

pub fn insert_ignore(conn: &Connection, m: &Message) -> Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO messages
           (id, conversation_id, parent_id, role, content_text, content_json,
            token_count_input, token_count_output, seq, created_at)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
        params![
            m.id, m.conversation_id, m.parent_id, m.role,
            m.content_text, m.content_json,
            m.token_count_input, m.token_count_output,
            m.seq, m.created_at
        ],
    )?;

    // Sync to FTS if inserted
    if !m.content_text.as_ref().map_or(true, |t| t.is_empty()) {
        conn.execute(
            "INSERT OR IGNORE INTO messages_fts(content_text, conversation_id, id)
             VALUES (?1, ?2, ?3)",
            params![m.content_text, m.conversation_id, m.id],
        )?;
    }
    Ok(())
}

pub fn count_for_conversation(conn: &Connection, conversation_id: &str) -> Result<i64> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM messages WHERE conversation_id=?1",
        params![conversation_id],
        |r| r.get(0),
    )?;
    Ok(count)
}

pub fn list(conn: &Connection, conversation_id: &str) -> Result<Vec<Message>> {
    let mut stmt = conn.prepare(
        "SELECT id, conversation_id, parent_id, role, content_text, content_json,
                token_count_input, token_count_output, seq, created_at
         FROM messages WHERE conversation_id=?1 ORDER BY seq"
    )?;
    let rows = stmt.query_map(params![conversation_id], |row| Ok(Message {
        id: row.get(0)?,
        conversation_id: row.get(1)?,
        parent_id: row.get(2)?,
        role: row.get(3)?,
        content_text: row.get(4)?,
        content_json: row.get(5)?,
        token_count_input: row.get(6)?,
        token_count_output: row.get(7)?,
        seq: row.get(8)?,
        created_at: row.get(9)?,
    }))?;
    Ok(rows.flatten().collect())
}

pub fn search(conn: &Connection, query: &str, limit: i64) -> Result<Vec<SearchResult>> {
    let mut stmt = conn.prepare(
        "SELECT f.id, f.conversation_id, c.title, m.role,
                snippet(messages_fts, 0, '<b>', '</b>', '...', 20),
                rank
         FROM messages_fts f
         JOIN messages m ON m.id = f.id
         JOIN conversations c ON c.id = f.conversation_id
         WHERE messages_fts MATCH ?1
         ORDER BY rank LIMIT ?2"
    )?;
    let rows = stmt.query_map(params![query, limit], |row| Ok(SearchResult {
        message_id: row.get(0)?,
        conversation_id: row.get(1)?,
        conversation_title: row.get(2)?,
        role: row.get(3)?,
        snippet: row.get(4)?,
        rank: row.get(5)?,
    }))?;
    Ok(rows.flatten().collect())
}
```

- [ ] **Write tests for message CRUD**

```rust
// Add to bottom of db/message.rs
#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{open_in_memory, migrations};

    fn setup() -> Connection {
        let conn = open_in_memory().unwrap();
        migrations::run(&conn).unwrap();
        // Insert prerequisite conversation
        conn.execute(
            "INSERT INTO conversations(id,provider,status,jsonl_path,created_at,updated_at)
             VALUES('conv1','claude_code','idle','/tmp/test.jsonl',0,0)",
            [],
        ).unwrap();
        conn
    }

    #[test]
    fn insert_and_list_messages() {
        let conn = setup();
        let msg = Message {
            id: "msg1".into(),
            conversation_id: "conv1".into(),
            parent_id: None,
            role: "user".into(),
            content_text: Some("Hello world".into()),
            content_json: None,
            token_count_input: None,
            token_count_output: None,
            seq: 0,
            created_at: 1000,
        };
        insert_ignore(&conn, &msg).unwrap();
        let msgs = list(&conn, "conv1").unwrap();
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].role, "user");
    }

    #[test]
    fn insert_ignore_is_idempotent() {
        let conn = setup();
        let msg = Message {
            id: "msg1".into(),
            conversation_id: "conv1".into(),
            parent_id: None,
            role: "user".into(),
            content_text: Some("Hello".into()),
            content_json: None,
            token_count_input: None,
            token_count_output: None,
            seq: 0,
            created_at: 1000,
        };
        insert_ignore(&conn, &msg).unwrap();
        insert_ignore(&conn, &msg).unwrap(); // should not error or duplicate
        assert_eq!(count_for_conversation(&conn, "conv1").unwrap(), 1);
    }

    #[test]
    fn fts_search_returns_results() {
        let conn = setup();
        let msg = Message {
            id: "msg1".into(),
            conversation_id: "conv1".into(),
            parent_id: None,
            role: "assistant".into(),
            content_text: Some("The quick brown fox jumps".into()),
            content_json: None,
            token_count_input: None,
            token_count_output: None,
            seq: 0,
            created_at: 1000,
        };
        insert_ignore(&conn, &msg).unwrap();
        let results = search(&conn, "quick brown", 10).unwrap();
        assert!(!results.is_empty());
        assert!(results[0].snippet.contains("quick") || results[0].snippet.contains("brown"));
    }
}
```

- [ ] **Run tests**

```bash
cd /home/emopointer/vsagent/src-tauri
cargo test db::
```

Expected: all tests pass

---

## Task 7: JSONL Parser

**Files:** `src-tauri/src/importer/parser.rs`

- [ ] **Create importer/mod.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/importer/mod.rs
pub mod parser;
pub mod sync;
```

- [ ] **Create importer/parser.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/importer/parser.rs
use anyhow::Result;
use serde::Deserialize;
use serde_json::Value;
use crate::domain::Message;

/// Raw JSONL line structure from Claude Code
#[derive(Debug, Deserialize)]
pub struct RawLine {
    pub uuid: Option<String>,
    #[serde(rename = "parentUuid")]
    pub parent_uuid: Option<String>,
    #[serde(rename = "type")]
    pub line_type: String,
    #[serde(rename = "sessionId")]
    pub session_id: Option<String>,
    pub cwd: Option<String>,
    #[serde(rename = "gitBranch")]
    pub git_branch: Option<String>,
    pub timestamp: Option<String>,
    #[serde(rename = "isSidechain")]
    pub is_sidechain: Option<bool>,
    pub message: Option<RawMessage>,
}

#[derive(Debug, Deserialize)]
pub struct RawMessage {
    pub role: Option<String>,
    pub content: Option<Value>,
    pub usage: Option<RawUsage>,
}

#[derive(Debug, Deserialize)]
pub struct RawUsage {
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
}

/// Parsed line result - either a message or metadata-only
pub struct ParsedLine {
    pub message: Option<Message>,
    pub session_id: Option<String>,
    pub cwd: Option<String>,
    pub git_branch: Option<String>,
    pub timestamp_ms: Option<i64>,
}

/// Roles we accept as messages
fn is_message_role(role: &str) -> bool {
    matches!(role, "user" | "assistant" | "system")
}

/// Extract plain text from content (array or string)
pub fn extract_text(content: &Value) -> String {
    match content {
        Value::String(s) => s.clone(),
        Value::Array(blocks) => {
            blocks.iter().filter_map(|block| {
                let t = block.get("type")?.as_str()?;
                match t {
                    "text" => block.get("text")?.as_str().map(String::from),
                    "tool_use" => {
                        let name = block.get("name")?.as_str().unwrap_or("unknown");
                        Some(format!("[tool: {name}]"))
                    }
                    "tool_result" => {
                        let inner = block.get("content")?;
                        match inner {
                            Value::String(s) => Some(s.clone()),
                            _ => Some("[tool_result]".into()),
                        }
                    }
                    _ => None,
                }
            }).collect::<Vec<_>>().join("\n")
        }
        _ => String::new(),
    }
}

/// Normalize content to a JSON array string for storage
pub fn normalize_content_json(content: &Value) -> String {
    match content {
        Value::Array(_) => serde_json::to_string(content).unwrap_or_default(),
        Value::String(s) => {
            serde_json::to_string(&serde_json::json!([{"type": "text", "text": s}]))
                .unwrap_or_default()
        }
        _ => "[]".into(),
    }
}

/// Parse a single JSONL line string
pub fn parse_line(line: &str, seq: i64) -> Option<ParsedLine> {
    let raw: RawLine = serde_json::from_str(line)
        .map_err(|e| log::warn!("JSONL parse error: {e} on: {}", &line[..line.len().min(80)]))
        .ok()?;

    // Skip sidechains (subagent conversations)
    if raw.is_sidechain == Some(true) {
        return None;
    }

    let ts_ms = raw.timestamp.as_ref().and_then(|ts| {
        chrono::DateTime::parse_from_rfc3339(ts).ok().map(|dt| dt.timestamp_millis())
    });

    let mut result = ParsedLine {
        message: None,
        session_id: raw.session_id.clone(),
        cwd: raw.cwd.clone(),
        git_branch: raw.git_branch.clone(),
        timestamp_ms: ts_ms,
    };

    // Only user/assistant/system produce messages
    if !matches!(raw.line_type.as_str(), "user" | "assistant" | "system") {
        return Some(result);
    }

    let msg_raw = raw.message.as_ref()?;
    let role = msg_raw.role.as_deref()?;
    if !is_message_role(role) {
        return Some(result);
    }

    let id = raw.uuid.clone().unwrap_or_else(|| format!("auto-{seq}"));
    let session_id = raw.session_id.clone().unwrap_or_default();

    let (content_text, content_json) = match &msg_raw.content {
        Some(c) => {
            let text = extract_text(c);
            let json = normalize_content_json(c);
            (
                if text.is_empty() { None } else { Some(text) },
                if json == "[]" { None } else { Some(json) },
            )
        }
        None => (None, None),
    };

    let (token_in, token_out) = msg_raw.usage.as_ref().map_or((None, None), |u| {
        (u.input_tokens, u.output_tokens)
    });

    result.message = Some(Message {
        id,
        conversation_id: session_id,
        parent_id: raw.parent_uuid.clone(),
        role: role.to_string(),
        content_text,
        content_json,
        token_count_input: token_in,
        token_count_output: token_out,
        seq,
        created_at: ts_ms.unwrap_or(0),
    });

    Some(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    const USER_LINE: &str = r#"{"uuid":"u1","parentUuid":null,"type":"user","sessionId":"sess1","cwd":"/home/user/proj","gitBranch":"main","timestamp":"2026-01-01T00:00:00Z","isSidechain":false,"message":{"role":"user","content":"Hello Claude"}}"#;

    const ASSISTANT_LINE: &str = r#"{"uuid":"a1","parentUuid":"u1","type":"assistant","sessionId":"sess1","cwd":"/home/user/proj","gitBranch":"main","timestamp":"2026-01-01T00:00:01Z","isSidechain":false,"message":{"role":"assistant","content":[{"type":"text","text":"Hello! How can I help?"}],"usage":{"input_tokens":10,"output_tokens":20}}}"#;

    const TOOL_USE_LINE: &str = r#"{"uuid":"a2","parentUuid":"u1","type":"assistant","sessionId":"sess1","cwd":"/home/user/proj","gitBranch":"main","timestamp":"2026-01-01T00:00:02Z","isSidechain":false,"message":{"role":"assistant","content":[{"type":"tool_use","id":"t1","name":"Read","input":{"path":"/foo"}}]}}"#;

    const PROGRESS_LINE: &str = r#"{"type":"progress","sessionId":"sess1","data":{"type":"hook_progress"}}"#;

    const SIDECHAIN_LINE: &str = r#"{"uuid":"s1","type":"user","sessionId":"sess1","isSidechain":true,"message":{"role":"user","content":"sidechain"}}"#;

    const CORRUPT_LINE: &str = r#"{"this is not valid json"#;

    #[test]
    fn parses_user_message() {
        let result = parse_line(USER_LINE, 0).unwrap();
        let msg = result.message.unwrap();
        assert_eq!(msg.role, "user");
        assert_eq!(msg.content_text.unwrap(), "Hello Claude");
        assert_eq!(msg.conversation_id, "sess1");
        assert_eq!(msg.seq, 0);
    }

    #[test]
    fn parses_assistant_message_with_usage() {
        let result = parse_line(ASSISTANT_LINE, 1).unwrap();
        let msg = result.message.unwrap();
        assert_eq!(msg.role, "assistant");
        assert!(msg.content_text.as_deref().unwrap().contains("Hello"));
        assert_eq!(msg.token_count_input, Some(10));
        assert_eq!(msg.token_count_output, Some(20));
    }

    #[test]
    fn parses_tool_use_as_bracket_notation() {
        let result = parse_line(TOOL_USE_LINE, 2).unwrap();
        let msg = result.message.unwrap();
        assert_eq!(msg.content_text.as_deref().unwrap(), "[tool: Read]");
    }

    #[test]
    fn progress_line_returns_no_message() {
        let result = parse_line(PROGRESS_LINE, 3).unwrap();
        assert!(result.message.is_none());
        assert_eq!(result.session_id.unwrap(), "sess1");
    }

    #[test]
    fn sidechain_line_is_skipped() {
        let result = parse_line(SIDECHAIN_LINE, 4);
        assert!(result.is_none());
    }

    #[test]
    fn corrupt_line_returns_none() {
        let result = parse_line(CORRUPT_LINE, 5);
        assert!(result.is_none());
    }

    #[test]
    fn extracts_metadata_from_non_message_lines() {
        let result = parse_line(PROGRESS_LINE, 0).unwrap();
        assert_eq!(result.session_id.unwrap(), "sess1");
    }
}
```

- [ ] **Run parser tests**

```bash
cd /home/emopointer/vsagent/src-tauri
cargo test importer::parser
```

Expected: 7 tests pass

---

## Task 8: Importer Sync

**Files:** `src-tauri/src/importer/sync.rs`

- [ ] **Create importer/sync.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/importer/sync.rs
use std::path::{Path, PathBuf};
use std::io::{BufRead, BufReader};
use std::fs::File;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use anyhow::Result;
use rusqlite::Connection;
use sha2::{Sha256, Digest};

use crate::db::{workspace, conversation, message};
use crate::domain::{Workspace, Conversation};
use crate::importer::parser;

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn workspace_id(path: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.as_bytes());
    hex::encode(hasher.finalize())
}

/// Get git repo root for a directory (cached via DB workspace table)
fn get_git_root(path: &str) -> Option<String> {
    let output = Command::new("git")
        .args(["-C", path, "rev-parse", "--show-toplevel"])
        .output()
        .ok()?;
    if output.status.success() {
        String::from_utf8(output.stdout).ok().map(|s| s.trim().to_string())
    } else {
        None
    }
}

/// Import all JSONL files under a root directory
pub fn import_all(conn: &Connection, root: &Path) -> Result<()> {
    if !root.exists() {
        log::info!("Claude projects dir does not exist: {}", root.display());
        return Ok(());
    }

    for entry in walkdir(root) {
        if let Err(e) = import_file(conn, &entry) {
            log::error!("Failed to import {}: {e}", entry.display());
        }
    }
    Ok(())
}

/// Walk directory and collect .jsonl files
fn walkdir(root: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    if let Ok(entries) = std::fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                files.extend(walkdir(&path));
            } else if path.extension().map_or(false, |e| e == "jsonl") {
                files.push(path);
            }
        }
    }
    files
}

/// Import a single JSONL file incrementally
pub fn import_file(conn: &Connection, jsonl_path: &Path) -> Result<()> {
    let file = File::open(jsonl_path)?;
    let reader = BufReader::new(file);
    let path_str = jsonl_path.to_string_lossy().to_string();

    let mut session_id: Option<String> = None;
    let mut cwd: Option<String> = None;
    let mut git_branch: Option<String> = None;
    let mut first_ts: Option<i64> = None;
    let mut last_ts: Option<i64> = None;
    let mut first_user_text: Option<String> = None;

    // Collect all parsed lines first to determine seq offsets
    let mut parsed_lines = Vec::new();
    for line in reader.lines() {
        let line = line?;
        let line = line.trim();
        if line.is_empty() { continue; }

        if let Some(parsed) = parser::parse_line(line, 0) {
            // Update metadata
            if session_id.is_none() { session_id = parsed.session_id.clone(); }
            if cwd.is_none() { cwd = parsed.cwd.clone(); }
            if git_branch.is_none() { git_branch = parsed.git_branch.clone(); }
            if let Some(ts) = parsed.timestamp_ms {
                if first_ts.is_none() { first_ts = Some(ts); }
                last_ts = Some(ts);
            }
            parsed_lines.push(parsed);
        }
    }

    let session_id = match session_id {
        Some(id) => id,
        None => {
            log::warn!("No sessionId found in {}", jsonl_path.display());
            return Ok(());
        }
    };

    // Ensure workspace
    let workspace_id_val = if let Some(ref cwd_str) = cwd {
        let ws_id = workspace_id(cwd_str);
        if workspace::find_by_path(conn, cwd_str)?.is_none() {
            let name = Path::new(cwd_str)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| cwd_str.clone());
            let git_root = get_git_root(cwd_str);
            workspace::upsert(conn, &Workspace {
                id: ws_id.clone(),
                name,
                root_path: cwd_str.clone(),
                git_repo_root: git_root,
                created_at: first_ts.unwrap_or_else(now_ms),
                updated_at: now_ms(),
            })?;
        }
        Some(ws_id)
    } else {
        None
    };

    // Ensure conversation
    let now = now_ms();
    conversation::upsert(conn, &Conversation {
        id: session_id.clone(),
        workspace_id: workspace_id_val,
        provider: "claude_code".into(),
        title: None, // set after we find first user message
        status: "idle".into(),
        branch_name: git_branch,
        pinned: false,
        archived: false,
        last_message_at: last_ts,
        jsonl_path: path_str,
        created_at: first_ts.unwrap_or(now),
        updated_at: now,
    })?;

    // Import messages with correct seq
    // seq = count of already-imported messages + index in this batch
    let existing_count = message::count_for_conversation(conn, &session_id)?;
    let mut msg_seq = existing_count;

    conn.execute("BEGIN IMMEDIATE", [])?;
    for parsed in parsed_lines {
        if let Some(mut msg) = parsed.message {
            if msg.conversation_id == session_id {
                // Extract first user message for title
                if first_user_text.is_none() && msg.role == "user" {
                    first_user_text = msg.content_text.as_ref().map(|t| {
                        t.chars().take(60).collect()
                    });
                }
                msg.seq = msg_seq;
                message::insert_ignore(conn, &msg)?;
                msg_seq += 1;
            }
        }
    }
    conn.execute("COMMIT", [])?;

    // Update title if we found one
    if let Some(title) = first_user_text {
        conn.execute(
            "UPDATE conversations SET title=?1 WHERE id=?2 AND title IS NULL",
            rusqlite::params![title, session_id],
        )?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{open_in_memory, migrations};
    use tempfile::tempdir;
    use std::io::Write;

    fn setup() -> Connection {
        let conn = open_in_memory().unwrap();
        migrations::run(&conn).unwrap();
        conn
    }

    fn write_jsonl(dir: &Path, name: &str, lines: &[&str]) -> PathBuf {
        let path = dir.join(name);
        let mut f = File::create(&path).unwrap();
        for line in lines {
            writeln!(f, "{line}").unwrap();
        }
        path
    }

    const LINE_U: &str = r#"{"uuid":"u1","parentUuid":null,"type":"user","sessionId":"sess1","cwd":"/tmp/proj","gitBranch":"main","timestamp":"2026-01-01T00:00:00Z","isSidechain":false,"message":{"role":"user","content":"Hello"}}"#;
    const LINE_A: &str = r#"{"uuid":"a1","parentUuid":"u1","type":"assistant","sessionId":"sess1","cwd":"/tmp/proj","gitBranch":"main","timestamp":"2026-01-01T00:00:01Z","isSidechain":false,"message":{"role":"assistant","content":[{"type":"text","text":"Hi there"}]}}"#;

    #[test]
    fn import_file_creates_conversation_and_messages() {
        let conn = setup();
        let dir = tempdir().unwrap();
        let path = write_jsonl(dir.path(), "test.jsonl", &[LINE_U, LINE_A]);

        import_file(&conn, &path).unwrap();

        let convs = conversation::list(&conn, None).unwrap();
        assert_eq!(convs.len(), 1);
        assert_eq!(convs[0].id, "sess1");
        assert_eq!(convs[0].title.as_deref(), Some("Hello"));

        let msgs = message::list(&conn, "sess1").unwrap();
        assert_eq!(msgs.len(), 2);
        assert_eq!(msgs[0].role, "user");
        assert_eq!(msgs[1].role, "assistant");
    }

    #[test]
    fn import_is_idempotent() {
        let conn = setup();
        let dir = tempdir().unwrap();
        let path = write_jsonl(dir.path(), "test.jsonl", &[LINE_U, LINE_A]);

        import_file(&conn, &path).unwrap();
        import_file(&conn, &path).unwrap(); // second import

        let msgs = message::list(&conn, "sess1").unwrap();
        assert_eq!(msgs.len(), 2); // no duplicates
    }

    #[test]
    fn import_all_skips_missing_dir() {
        let conn = setup();
        let result = import_all(&conn, Path::new("/nonexistent/path/xyz"));
        assert!(result.is_ok()); // should not error
    }
}
```

- [ ] **Run sync tests**

```bash
cd /home/emopointer/vsagent/src-tauri
cargo test importer::sync
```

Expected: 3 tests pass

- [ ] **Commit**

```bash
git add src-tauri/src/
git commit -m "feat: JSONL parser + importer sync with full test coverage"
```

---

## Task 9: Tauri Commands

**Files:** `src-tauri/src/commands/`

- [ ] **Create commands/mod.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/commands/mod.rs
pub mod workspaces;
pub mod conversations;
pub mod messages;
pub mod search;
```

- [ ] **Create commands/workspaces.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/commands/workspaces.rs
use tauri::State;
use crate::AppState;
use crate::db::workspace;
use crate::domain::Workspace;

#[tauri::command]
pub fn list_workspaces(state: State<AppState>) -> Result<Vec<Workspace>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    workspace::list(&conn).map_err(|e| e.to_string())
}
```

- [ ] **Create commands/conversations.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/commands/conversations.rs
use tauri::State;
use crate::AppState;
use crate::db::conversation;
use crate::domain::Conversation;

#[tauri::command]
pub fn list_conversations(
    state: State<AppState>,
    workspace_id: Option<String>,
) -> Result<Vec<Conversation>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conversation::list(&conn, workspace_id.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pin_conversation(
    state: State<AppState>,
    id: String,
    pinned: bool,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conversation::set_pinned(&conn, &id, pinned).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn archive_conversation(
    state: State<AppState>,
    id: String,
    archived: bool,
) -> Result<(), String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    conversation::set_archived(&conn, &id, archived).map_err(|e| e.to_string())
}
```

- [ ] **Create commands/messages.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/commands/messages.rs
use tauri::State;
use crate::AppState;
use crate::db::message;
use crate::domain::Message;

#[tauri::command]
pub fn list_messages(
    state: State<AppState>,
    conversation_id: String,
) -> Result<Vec<Message>, String> {
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    message::list(&conn, &conversation_id).map_err(|e| e.to_string())
}
```

- [ ] **Create commands/search.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/commands/search.rs
use tauri::State;
use crate::AppState;
use crate::db::message;
use crate::domain::SearchResult;

#[tauri::command]
pub fn search_messages(
    state: State<AppState>,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    if query.trim().is_empty() {
        return Ok(vec![]);
    }
    let conn = state.db.lock().map_err(|e| e.to_string())?;
    message::search(&conn, &query, 50).map_err(|e| e.to_string())
}
```

- [ ] **Verify compilation**

```bash
cd /home/emopointer/vsagent/src-tauri
cargo build 2>&1 | tail -5
```

Expected: no errors

---

## Task 10: File Watcher

**Files:** `src-tauri/src/watcher/mod.rs`, update `src-tauri/src/lib.rs`

- [ ] **Create watcher/mod.rs**

```rust
// /home/emopointer/vsagent/src-tauri/src/watcher/mod.rs
use std::path::PathBuf;
use std::time::Duration;
use notify::{Watcher, RecursiveMode, RecommendedWatcher};
use notify::event::{EventKind, CreateKind, ModifyKind, RemoveKind};
use tauri::{AppHandle, Emitter};

use crate::AppState;
use crate::importer::sync;
use crate::db::conversation;

#[derive(Clone, serde::Serialize)]
struct ConversationUpdatedPayload {
    conversation_id: String,
}

pub fn start(app: AppHandle, watch_path: PathBuf) {
    tauri::async_runtime::spawn_blocking(move || {
        let (tx, rx) = std::sync::mpsc::channel();

        let mut watcher = RecommendedWatcher::new(tx, notify::Config::default()
            .with_poll_interval(Duration::from_millis(500)))
            .expect("failed to create watcher");

        watcher.watch(&watch_path, RecursiveMode::Recursive)
            .expect("failed to watch path");

        log::info!("Watching: {}", watch_path.display());

        for res in rx {
            match res {
                Ok(event) => handle_event(&app, event),
                Err(e) => log::error!("Watch error: {e}"),
            }
        }
    });
}

fn handle_event(app: &AppHandle, event: notify::Event) {
    let state = app.state::<AppState>();

    for path in &event.paths {
        if path.extension().map_or(true, |e| e != "jsonl") {
            continue;
        }

        match event.kind {
            EventKind::Create(CreateKind::File) | EventKind::Modify(ModifyKind::Data(_)) => {
                let conn = state.db.lock().unwrap();
                if let Err(e) = sync::import_file(&conn, path) {
                    log::error!("Watch import failed for {}: {e}", path.display());
                    return;
                }

                // Emit update event to frontend
                let path_str = path.to_string_lossy().to_string();
                if let Ok(convs) = conversation::list(&conn, None) {
                    if let Some(conv) = convs.iter().find(|c| c.jsonl_path == path_str) {
                        let _ = app.emit("conversation:updated", ConversationUpdatedPayload {
                            conversation_id: conv.id.clone(),
                        });
                    }
                }
                // Always emit list refresh
                let _ = app.emit("conversations:changed", ());
            }
            EventKind::Remove(_) => {
                let conn = state.db.lock().unwrap();
                let path_str = path.to_string_lossy().to_string();
                conn.execute(
                    "UPDATE conversations SET archived=1 WHERE jsonl_path=?1",
                    rusqlite::params![path_str],
                ).ok();
                let _ = app.emit("conversations:changed", ());
            }
            _ => {}
        }
    }
}
```

- [ ] **Update lib.rs to start watcher in setup**

Replace the `setup` block in `src-tauri/src/lib.rs`:

```rust
.setup(|app| {
    let handle = app.handle().clone();
    let data_dir = dirs::home_dir()
        .unwrap()
        .join(".claude")
        .join("projects");

    // Run initial import
    {
        let state = handle.state::<AppState>();
        let conn = state.db.lock().unwrap();
        if let Err(e) = importer::sync::import_all(&conn, &data_dir) {
            log::error!("Initial import failed: {e}");
        }
    }

    // Start file watcher
    watcher::start(handle.clone(), data_dir);

    Ok(())
})
```

- [ ] **Verify compilation**

```bash
cd /home/emopointer/vsagent/src-tauri
cargo build 2>&1 | tail -3
```

Expected: compiles cleanly

- [ ] **Commit**

```bash
git add src-tauri/src/
git commit -m "feat: Tauri commands + file watcher with notify"
git push origin main
```

---

## Task 11: React Types + Tauri Bindings

**Files:** `src/types/index.ts`, `src/lib/tauri.ts`, `src/lib/utils.ts`

- [ ] **Create src/types/index.ts**

```typescript
// /home/emopointer/vsagent/src/types/index.ts

export interface Workspace {
  id: string;
  name: string;
  root_path: string;
  git_repo_root: string | null;
  created_at: number;
  updated_at: number;
}

export interface Conversation {
  id: string;
  workspace_id: string | null;
  provider: string;
  title: string | null;
  status: 'idle' | 'running' | 'waiting_input' | 'error' | 'archived';
  branch_name: string | null;
  pinned: boolean;
  archived: boolean;
  last_message_at: number | null;
  jsonl_path: string;
  created_at: number;
  updated_at: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  parent_id: string | null;
  role: 'user' | 'assistant' | 'system';
  content_text: string | null;
  content_json: string | null;
  token_count_input: number | null;
  token_count_output: number | null;
  seq: number;
  created_at: number;
}

export interface SearchResult {
  message_id: string;
  conversation_id: string;
  conversation_title: string | null;
  role: string;
  snippet: string;
  rank: number;
}
```

- [ ] **Create src/lib/tauri.ts**

```typescript
// /home/emopointer/vsagent/src/lib/tauri.ts
import { invoke } from '@tauri-apps/api/core';
import type { Workspace, Conversation, Message, SearchResult } from '../types';

export const api = {
  listWorkspaces: () =>
    invoke<Workspace[]>('list_workspaces'),

  listConversations: (workspaceId?: string) =>
    invoke<Conversation[]>('list_conversations', { workspaceId }),

  pinConversation: (id: string, pinned: boolean) =>
    invoke<void>('pin_conversation', { id, pinned }),

  archiveConversation: (id: string, archived: boolean) =>
    invoke<void>('archive_conversation', { id, archived }),

  listMessages: (conversationId: string) =>
    invoke<Message[]>('list_messages', { conversationId }),

  searchMessages: (query: string) =>
    invoke<SearchResult[]>('search_messages', { query }),
};
```

- [ ] **Create src/lib/utils.ts**

```typescript
// /home/emopointer/vsagent/src/lib/utils.ts
import { formatDistanceToNow } from 'date-fns';

export function timeAgo(ms: number): string {
  try {
    return formatDistanceToNow(new Date(ms), { addSuffix: true });
  } catch {
    return 'unknown';
  }
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

export function classNames(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
```

- [ ] **Write utility tests**

```typescript
// /home/emopointer/vsagent/src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';
import { truncate, classNames } from './utils';

describe('truncate', () => {
  it('returns text unchanged when under limit', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('truncates with ellipsis when over limit', () => {
    const result = truncate('hello world', 5);
    expect(result).toBe('hello…');
    expect(result.length).toBe(6);
  });
});

describe('classNames', () => {
  it('joins truthy class names', () => {
    expect(classNames('a', 'b', false, undefined, 'c')).toBe('a b c');
  });
});
```

- [ ] **Run frontend tests**

```bash
cd /home/emopointer/vsagent
npm run test
```

Expected: utils tests pass

---

## Task 12: Three-Column Layout

**Files:** `src/App.tsx`, `src/components/layout/`

- [ ] **Create layout components**

```tsx
// /home/emopointer/vsagent/src/components/layout/ResizeHandle.tsx
import { useCallback, useRef } from 'react';

interface Props {
  onResize: (delta: number) => void;
}

export function ResizeHandle({ onResize }: Props) {
  const dragging = useRef(false);
  const startX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    startX.current = e.clientX;
    e.preventDefault();

    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      onResize(e.clientX - startX.current);
      startX.current = e.clientX;
    };
    const onUp = () => { dragging.current = false; };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    window.addEventListener('mouseup', () => {
      window.removeEventListener('mousemove', onMove);
    }, { once: true });
  }, [onResize]);

  return (
    <div
      className="w-1 cursor-col-resize hover:bg-blue-500 transition-colors flex-shrink-0"
      style={{ background: 'var(--border)' }}
      onMouseDown={onMouseDown}
    />
  );
}
```

```tsx
// /home/emopointer/vsagent/src/components/layout/Sidebar.tsx
import { ReactNode } from 'react';

interface Props {
  width: number;
  children: ReactNode;
}

export function Sidebar({ width, children }: Props) {
  return (
    <div
      className="flex flex-col h-full overflow-hidden flex-shrink-0"
      style={{ width, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      {children}
    </div>
  );
}
```

```tsx
// /home/emopointer/vsagent/src/components/layout/MainPanel.tsx
import { ReactNode } from 'react';

interface Props { children: ReactNode; }

export function MainPanel({ children }: Props) {
  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--bg-primary)' }}>
      {children}
    </div>
  );
}
```

- [ ] **Update App.tsx with full layout + providers**

```tsx
// /home/emopointer/vsagent/src/App.tsx
import { useState, useCallback } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from './components/layout/Sidebar';
import { MainPanel } from './components/layout/MainPanel';
import { ResizeHandle } from './components/layout/ResizeHandle';
import { SidebarContent } from './components/sidebar/SidebarContent';
import { ConversationView } from './components/conversation/ConversationView';
import { useConversationStore } from './features/conversations/conversationStore';
import { useWatcherEvents } from './features/conversations/useWatcherEvents';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

function AppInner() {
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const selectedId = useConversationStore((s) => s.selectedId);
  useWatcherEvents();

  const handleResize = useCallback((delta: number) => {
    setSidebarWidth((w) => Math.max(180, Math.min(500, w + delta)));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar width={sidebarWidth}>
        <SidebarContent />
      </Sidebar>
      <ResizeHandle onResize={handleResize} />
      <MainPanel>
        {selectedId
          ? <ConversationView conversationId={selectedId} />
          : <EmptyMain />
        }
      </MainPanel>
    </div>
  );
}

function EmptyMain() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--text-muted)' }}>
      <div className="text-4xl">⚡</div>
      <p className="text-sm">Select a conversation to view history</p>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
    </QueryClientProvider>
  );
}
```

---

## Task 13: Conversation Store + Sidebar

**Files:** `src/features/conversations/conversationStore.ts`, `src/features/conversations/useConversations.ts`, `src/components/sidebar/`

- [ ] **Create conversationStore.ts**

```typescript
// /home/emopointer/vsagent/src/features/conversations/conversationStore.ts
import { create } from 'zustand';

interface ConversationStore {
  selectedId: string | null;
  select: (id: string) => void;
  clear: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  selectedId: null,
  select: (id) => set({ selectedId: id }),
  clear: () => set({ selectedId: null }),
}));
```

- [ ] **Create useConversations.ts**

```typescript
// /home/emopointer/vsagent/src/features/conversations/useConversations.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/tauri';

export function useConversations(workspaceId?: string) {
  return useQuery({
    queryKey: ['conversations', workspaceId],
    queryFn: () => api.listConversations(workspaceId),
  });
}

export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.listWorkspaces(),
  });
}
```

- [ ] **Create useMessages.ts**

```typescript
// /home/emopointer/vsagent/src/features/conversations/useMessages.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/tauri';

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => api.listMessages(conversationId),
    enabled: !!conversationId,
  });
}
```

- [ ] **Create useWatcherEvents.ts**

```typescript
// /home/emopointer/vsagent/src/features/conversations/useWatcherEvents.ts
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useQueryClient } from '@tanstack/react-query';

export function useWatcherEvents() {
  const qc = useQueryClient();

  useEffect(() => {
    const unlistenUpdated = listen<{ conversation_id: string }>('conversation:updated', (e) => {
      qc.invalidateQueries({ queryKey: ['messages', e.payload.conversation_id] });
    });
    const unlistenChanged = listen('conversations:changed', () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['workspaces'] });
    });

    return () => {
      unlistenUpdated.then((fn) => fn());
      unlistenChanged.then((fn) => fn());
    };
  }, [qc]);
}
```

- [ ] **Create sidebar components**

```tsx
// /home/emopointer/vsagent/src/components/common/StatusDot.tsx
interface Props { status: string; }

const colors: Record<string, string> = {
  idle: '#555',
  running: '#22c55e',
  waiting_input: '#f59e0b',
  error: '#ef4444',
  archived: '#374151',
};

export function StatusDot({ status }: Props) {
  return (
    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: colors[status] ?? '#555' }} />
  );
}
```

```tsx
// /home/emopointer/vsagent/src/components/common/TimeAgo.tsx
import { timeAgo } from '../../lib/utils';

interface Props { ms: number | null; }

export function TimeAgo({ ms }: Props) {
  if (!ms) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  return <span style={{ color: 'var(--text-muted)' }}>{timeAgo(ms)}</span>;
}
```

```tsx
// /home/emopointer/vsagent/src/components/sidebar/ConversationItem.tsx
import { Conversation } from '../../types';
import { StatusDot } from '../common/StatusDot';
import { TimeAgo } from '../common/TimeAgo';
import { truncate } from '../../lib/utils';

interface Props {
  conversation: Conversation;
  selected: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, selected, onClick }: Props) {
  return (
    <button
      className="w-full text-left px-3 py-2 flex flex-col gap-0.5 hover:bg-opacity-10 transition-colors"
      style={{
        background: selected ? 'rgba(0,122,204,0.2)' : 'transparent',
        borderLeft: selected ? '2px solid #007acc' : '2px solid transparent',
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 w-full">
        <StatusDot status={conversation.status} />
        <span className="flex-1 truncate text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
          {conversation.title ?? conversation.id.slice(0, 8)}
        </span>
        {conversation.pinned && <span className="text-xs">📌</span>}
      </div>
      <div className="flex items-center gap-2 pl-4">
        {conversation.branch_name && (
          <span className="text-xs truncate max-w-24" style={{ color: 'var(--text-muted)' }}>
            {conversation.branch_name}
          </span>
        )}
        <span className="text-xs ml-auto">
          <TimeAgo ms={conversation.last_message_at} />
        </span>
      </div>
    </button>
  );
}
```

```tsx
// /home/emopointer/vsagent/src/components/sidebar/SearchBar.tsx
import { useRef } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function SearchBar({ value, onChange }: Props) {
  return (
    <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
      <input
        type="text"
        placeholder="Search conversations..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1 text-xs rounded outline-none"
        style={{
          background: 'var(--bg-panel)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
        }}
      />
    </div>
  );
}
```

```tsx
// /home/emopointer/vsagent/src/components/sidebar/WorkspaceGroup.tsx
import { useState } from 'react';
import { Conversation, Workspace } from '../../types';
import { ConversationItem } from './ConversationItem';
import { useConversationStore } from '../../features/conversations/conversationStore';

interface Props {
  workspace: Workspace;
  conversations: Conversation[];
  searchQuery: string;
}

export function WorkspaceGroup({ workspace, conversations, searchQuery }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { selectedId, select } = useConversationStore();

  const filtered = conversations.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.title?.toLowerCase().includes(q) ||
      c.branch_name?.toLowerCase().includes(q) ||
      c.id.includes(q)
    );
  });

  if (filtered.length === 0) return null;

  return (
    <div>
      <button
        className="w-full px-3 py-1.5 text-left flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setExpanded((e) => !e)}
      >
        <span>{expanded ? '▾' : '▸'}</span>
        <span className="truncate">{workspace.name}</span>
        <span className="ml-auto">{filtered.length}</span>
      </button>
      {expanded && filtered.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          selected={selectedId === conv.id}
          onClick={() => select(conv.id)}
        />
      ))}
    </div>
  );
}
```

```tsx
// /home/emopointer/vsagent/src/components/sidebar/SidebarContent.tsx
import { useState, useMemo } from 'react';
import { SearchBar } from './SearchBar';
import { WorkspaceGroup } from './WorkspaceGroup';
import { useConversations, useWorkspaces } from '../../features/conversations/useConversations';
import { useConversationStore } from '../../features/conversations/conversationStore';

export function SidebarContent() {
  const [search, setSearch] = useState('');
  const { data: workspaces = [] } = useWorkspaces();
  const { data: conversations = [], isLoading } = useConversations();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof conversations>();
    const ungrouped: typeof conversations = [];

    for (const conv of conversations) {
      if (conv.workspace_id) {
        const list = map.get(conv.workspace_id) ?? [];
        list.push(conv);
        map.set(conv.workspace_id, list);
      } else {
        ungrouped.push(conv);
      }
    }
    return { map, ungrouped };
  }, [conversations]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 text-sm font-semibold" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}>
        vsagent
      </div>
      <SearchBar value={search} onChange={setSearch} />

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <p className="px-3 py-4 text-xs" style={{ color: 'var(--text-muted)' }}>Loading...</p>
        )}
        {!isLoading && conversations.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No Claude Code sessions found.
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Start a session with Claude Code to see history here.
            </p>
          </div>
        )}
        {workspaces.map((ws) => (
          <WorkspaceGroup
            key={ws.id}
            workspace={ws}
            conversations={grouped.map.get(ws.id) ?? []}
            searchQuery={search}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## Task 14: Conversation + Message View

**Files:** `src/components/conversation/`

- [ ] **Create ConversationView.tsx**

```tsx
// /home/emopointer/vsagent/src/components/conversation/ConversationView.tsx
import { useMessages } from '../../features/conversations/useMessages';
import { useConversations } from '../../features/conversations/useConversations';
import { MessageList } from './MessageList';

interface Props { conversationId: string; }

export function ConversationView({ conversationId }: Props) {
  const { data: messages = [], isLoading } = useMessages(conversationId);
  const { data: conversations = [] } = useConversations();
  const conv = conversations.find((c) => c.id === conversationId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-2 flex items-center gap-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {conv?.title ?? conversationId.slice(0, 8)}
          </h1>
          {conv?.branch_name && (
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
              {conv.branch_name}
            </p>
          )}
        </div>
        <span className="text-xs px-2 py-0.5 rounded"
          style={{ background: 'var(--bg-panel)', color: 'var(--text-muted)' }}>
          {conv?.provider ?? 'claude_code'}
        </span>
      </div>

      {/* Messages */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading messages...</p>
        </div>
      ) : (
        <MessageList messages={messages} />
      )}
    </div>
  );
}
```

- [ ] **Create MessageList.tsx with virtual scrolling**

```tsx
// /home/emopointer/vsagent/src/components/conversation/MessageList.tsx
import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Message } from '../../types';
import { MessageItem } from './MessageItem';

interface Props { messages: Message[]; }

export function MessageList({ messages }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 5,
  });

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No messages in this session.</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-y-auto px-4 py-2">
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%',
                     transform: `translateY(${virtualItem.start}px)` }}
          >
            <MessageItem message={messages[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Create MessageItem.tsx, UserMessage.tsx, AssistantMessage.tsx**

```tsx
// /home/emopointer/vsagent/src/components/conversation/MessageItem.tsx
import { Message } from '../../types';
import { UserMessage } from './UserMessage';
import { AssistantMessage } from './AssistantMessage';

interface Props { message: Message; }

export function MessageItem({ message }: Props) {
  if (message.role === 'user') return <UserMessage message={message} />;
  if (message.role === 'assistant') return <AssistantMessage message={message} />;
  return null; // skip system messages in view
}
```

```tsx
// /home/emopointer/vsagent/src/components/conversation/UserMessage.tsx
import { Message } from '../../types';
import { timeAgo } from '../../lib/utils';

interface Props { message: Message; }

export function UserMessage({ message }: Props) {
  const text = message.content_text ?? '';
  return (
    <div className="flex flex-col gap-1 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
          style={{ background: 'var(--accent)', color: 'white' }}>You</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {timeAgo(message.created_at)}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
        {text}
      </p>
    </div>
  );
}
```

```tsx
// /home/emopointer/vsagent/src/components/conversation/AssistantMessage.tsx
import ReactMarkdown from 'react-markdown';
import { Message } from '../../types';
import { timeAgo } from '../../lib/utils';

interface Props { message: Message; }

export function AssistantMessage({ message }: Props) {
  const text = message.content_text ?? '';
  const isToolCall = text.startsWith('[tool:');

  return (
    <div className="flex flex-col gap-1 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
          style={{ background: '#4c1d95', color: 'white' }}>Claude</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {timeAgo(message.created_at)}
        </span>
        {message.token_count_output && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
            {message.token_count_output} tokens
          </span>
        )}
      </div>
      {isToolCall ? (
        <code className="text-xs px-2 py-1 rounded" style={{ background: 'var(--bg-panel)', color: '#22c55e' }}>
          {text}
        </code>
      ) : (
        <div className="prose prose-invert prose-sm max-w-none text-sm"
          style={{ color: 'var(--text-primary)' }}>
          <ReactMarkdown>{text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
```

---

## Task 15: Search Feature

**Files:** `src/features/search/useSearch.ts`, update sidebar to show search results

- [ ] **Create useSearch.ts**

```typescript
// /home/emopointer/vsagent/src/features/search/useSearch.ts
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/tauri';

export function useSearch() {
  const [query, setQuery] = useState('');

  // Debounce: only search after query is 2+ chars and stable
  const debouncedQuery = useDebouncedValue(query, 300);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.searchMessages(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  return { query, setQuery, results, isLoading };
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useMemo(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

The search is wired through the `SearchBar` in the sidebar — when there are search results, the sidebar shows them instead of the workspace-grouped conversation list. Update `SidebarContent.tsx` to handle this state if desired (treat as enhancement).

---

## Task 16: Verify End-to-End + Commit

- [ ] **Run all Rust tests**

```bash
cd /home/emopointer/vsagent/src-tauri
cargo test 2>&1 | tail -20
```

Expected: all tests pass, 0 failures

- [ ] **Run frontend tests**

```bash
cd /home/emopointer/vsagent
npm run test
```

Expected: all pass

- [ ] **Start dev server and verify UI**

```bash
cd /home/emopointer/vsagent
npm run tauri dev
```

Manual checks:
- [ ] App window opens
- [ ] Left sidebar shows workspaces from `~/.claude/projects/`
- [ ] Clicking a conversation loads messages in the center
- [ ] Messages render with role labels (You / Claude)
- [ ] Search box filters conversations by title

- [ ] **Create README.md**

```markdown
# vsagent

A VS Code-style desktop IDE for managing AI agent sessions.

Phase A: Read-only history browser for Claude Code sessions.

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
cargo test --manifest-path src-tauri/Cargo.toml
npm run test
```

## Architecture

See [docs/superpowers/specs/2026-03-20-vsagent-design.md](docs/superpowers/specs/2026-03-20-vsagent-design.md)
```

- [ ] **Final commit and push**

```bash
cd /home/emopointer/vsagent
git add .
git commit -m "feat: Phase A complete - Claude Code history browser"
git push origin main
```

---

## Quick Reference

| Command | Purpose |
|---|---|
| `npm run tauri dev` | Start development |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Run Rust tests |
| `npm run test` | Run frontend tests |
| `cargo build --manifest-path src-tauri/Cargo.toml` | Check Rust compilation |
| `npm run build` | Build frontend |
