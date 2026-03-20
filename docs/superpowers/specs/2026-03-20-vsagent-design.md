# vsagent — Design Spec
**Date:** 2026-03-20
**Status:** Approved (initial, subject to revision)

---

## 1. 项目目标

构建一个类似 VS Code 的桌面 IDE，以 **conversation（对话）** 为第一公民，统一管理 Claude Code、Codex CLI、Gemini CLI 等 AI agent 的会话历史与交互。

核心区别于现有终端管理器（tmux/Claude Squad/Agent Deck）：视图单位是对话/任务，而不是终端 pane。

---

## 2. 两阶段 MVP

### Phase A：只读历史浏览器
- 扫描 `~/.claude/projects/**/*.jsonl`，导入 SQLite
- 左侧会话列表（按 workspace 分组）
- 中间消息历史（虚拟滚动）
- 全局搜索（SQLite FTS5）
- 文件监听，自动增量同步

### Phase B：继续对话（Phase A 完成后叠加）
- PTY 进程管理（启动 Claude Code 子进程）
- 流式输出渲染
- 用户输入框 + 发送/停止
- 新建会话

---

## 3. 技术栈

| 层 | 选型 |
|---|---|
| 桌面框架 | Tauri v2 |
| 前端 | React 19 + TypeScript |
| UI 组件 | shadcn/ui + Tailwind CSS |
| 状态管理 | Zustand + TanStack Query |
| 虚拟滚动 | @tanstack/react-virtual |
| Markdown 渲染 | react-markdown + rehype-highlight |
| SQLite | rusqlite + rusqlite_migration |
| 文件监听 | notify crate |
| 错误处理 | anyhow + 自定义 AppError |

---

## 4. 数据模型（SQLite）

```sql
-- 工作区（从 JSONL 的 cwd 字段自动派生）
CREATE TABLE workspaces (
    id           TEXT PRIMARY KEY,  -- SHA256(root_path)
    name         TEXT NOT NULL,     -- 目录名（最后一段路径）
    root_path    TEXT NOT NULL UNIQUE,
    git_repo_root TEXT,             -- git root（可能与 root_path 不同）
    updated_at   INTEGER NOT NULL,
    created_at   INTEGER NOT NULL
);

-- 会话（一个 sessionId = 一个 conversation）
CREATE TABLE conversations (
    id              TEXT PRIMARY KEY,  -- sessionId from JSONL
    workspace_id    TEXT REFERENCES workspaces(id),
    provider        TEXT NOT NULL DEFAULT 'claude_code',
    -- Phase A 所有导入行写 'claude_code'
    title           TEXT,              -- 从第一条 user 消息自动截取前 60 字符
    status          TEXT NOT NULL DEFAULT 'idle',
    -- Phase A 所有导入行写 'idle'；有效值：idle|running|waiting_input|error|archived
    branch_name     TEXT,              -- gitBranch from JSONL
    pinned          INTEGER DEFAULT 0,
    archived        INTEGER DEFAULT 0,
    last_message_at INTEGER,
    jsonl_path      TEXT NOT NULL,     -- 原始文件路径，Phase B 用于 resume
    created_at      INTEGER NOT NULL,
    updated_at      INTEGER NOT NULL
);

-- 消息
CREATE TABLE messages (
    id                  TEXT PRIMARY KEY,  -- uuid from JSONL
    conversation_id     TEXT NOT NULL REFERENCES conversations(id),
    parent_id           TEXT,              -- parentUuid，保留线程结构
    role                TEXT NOT NULL,     -- user|assistant|system
    content_text        TEXT,              -- 提取的纯文本（用于 FTS）
    content_json        TEXT,              -- 原始 content array JSON（精确渲染用）
    token_count_input   INTEGER,           -- 若 JSONL 提供则写入，否则 NULL
    token_count_output  INTEGER,           -- 若 JSONL 提供则写入，否则 NULL
    seq                 INTEGER NOT NULL,
    created_at          INTEGER NOT NULL
);

-- FTS 全文搜索
CREATE VIRTUAL TABLE messages_fts USING fts5(
    content_text,
    conversation_id UNINDEXED,
    id UNINDEXED  -- 与 messages.id 对应，搜索结果通过 messages_fts.id = messages.id 关联
);

-- 索引
CREATE INDEX idx_conv_workspace  ON conversations(workspace_id);
CREATE INDEX idx_conv_updated    ON conversations(updated_at DESC);
CREATE INDEX idx_msg_conv        ON messages(conversation_id, seq);
```

**Phase A 明确省略的字段：**
- `messages` 无 `raw_payload_json`（由 `content_json` 承担原始 JSON 存储职责）
- `events` 表整体推迟到 Phase B

---

## 5. Rust 后端结构

```
src-tauri/src/
├── db/           # migrations, workspace/conversation/message CRUD
├── importer/     # scanner + parser + sync (JSONL → SQLite)
├── watcher/      # notify: 监听 ~/.claude/projects/ 变化
├── commands/     # Tauri commands: workspaces, conversations, messages, search
└── domain/       # 共享 types (对应前端 TypeScript 类型)
```

### JSONL 解析规则（parser.rs）

**行级 type 过滤：**

| JSONL `type` 字段 | 处理方式 |
|---|---|
| `"user"` | 提取 `message.content` → `Message { role: "user" }` |
| `"assistant"` | 提取 `message.content` → `Message { role: "assistant" }` |
| `"system"` | 提取 `message.content` → `Message { role: "system" }`，title 不从此类型取 |
| `"progress"` | 跳过（hook 进度，不是对话内容） |
| `"summary"` | 跳过（Claude Code 内部摘要，非用户可见消息） |
| 其他未知 type | 跳过并记录到 warn 日志 |

**content 字段提取规则（`content` 为数组）：**

| content block `type` | `content_text` 提取 | `content_json` |
|---|---|---|
| `"text"` | 直接取 `text` 字段 | 保存完整 block |
| `"tool_use"` | 格式化为 `[tool: {name}]` | 保存完整 block |
| `"tool_result"` | 取 `content` 字段（若为字符串）或 `[tool_result]` | 保存完整 block |
| 其他未知 type | 跳过此 block | 保存完整 block |
| `content` 为字符串（非数组） | 直接使用 | 包装成 `[{"type":"text","text":"..."}]` |

**元数据提取：**
- `sessionId` 首次出现 → 创建 Conversation（若已存在则跳过）
- `cwd` → 查找或创建 Workspace；`git_repo_root` 通过 `git -C {cwd} rev-parse --show-toplevel` 获取（失败则 NULL）。**此调用必须按 `root_path` 缓存**（每个唯一 workspace 最多执行一次，结果写入 workspaces 表后复用），超时限制 2s，超时视为 NULL
- `gitBranch` → `conversation.branch_name`
- `usage.input_tokens` / `usage.output_tokens` → `token_count_input` / `token_count_output`（若存在）
- `timestamp` → `message.created_at`（Unix ms）
- `seq` → 该消息在所属 sessionId 的 JSONL 文件中的 0-based 行索引（仅计入 type 为 user/assistant/system 的行）；这是唯一保证稳定且插入时序准确的排序依据，不依赖 timestamp（同一 session 内 timestamp 可能乱序或重复）。**增量导入时**，新消息的 seq 起始值 = `SELECT COUNT(*) FROM messages WHERE conversation_id = ?`（即已导入的 message-type 行总数），不依赖原始文件行号偏移。**此 COUNT 查询与后续 INSERT 必须在同一 SQLite 事务（IMMEDIATE 级别）内执行**，防止并发导入同一 conversation 时产生重复 seq 值

### 解析失败处理策略

- **单行 JSON 解析失败**：跳过该行，写 `warn!` 日志，继续下一行
- **`sessionId` 缺失**：跳过整个文件（无法归属会话），写 `error!` 日志
- **`content` 字段缺失或类型不符**：写入空 `content_text`，保存原始 JSON 到 `content_json`
- **部分解析成功的 conversation**：导入已解析的消息，不丢弃整个会话
- **用户可见**：应用底栏 Logs 面板显示跳过行数统计（Phase A 简化版）

### 文件监听规范（watcher.rs）

- **监听路径**：`~/.claude/projects/`，**递归**监听所有子目录
- **事件类型**：
  - `Create`（新 JSONL 文件）→ 全量导入该文件
  - `Modify`（文件追加）→ 从上次已知行数开始增量导入
  - `Remove`（文件删除）→ 标记对应 conversation 为 `archived`，不删除数据
  - `Rename` → 在 Linux/inotify 上，Rename 实际以 Remove + Create 对到达，由上述两个分支处理；此分支作为非 Linux 平台兜底，更新 `jsonl_path` 并重新导入目标文件
- **防抖**：合并 500ms 内同一文件的连续事件，避免活跃 session 写入时触发大量 sync
- **平台**：Ubuntu 使用 inotify 后端（notify crate 自动选择）

---

## 6. React 前端结构

```
src/
├── components/
│   ├── layout/       # Sidebar, MainPanel, ResizeHandle
│   ├── sidebar/      # WorkspaceGroup, ConversationItem, SearchBar, FilterBar
│   ├── conversation/ # ConversationHeader, MessageList, MessageItem,
│   │                 # UserMessage, AssistantMessage, EmptyState
│   └── common/       # StatusDot, ProviderBadge, TimeAgo
├── features/
│   ├── conversations/ # useConversations, useMessages, conversationStore
│   └── search/        # useSearch
├── lib/               # tauri.ts (type-safe invoke), utils.ts
└── types/             # index.ts (镜像 Rust domain types)
```

### 首次运行 / 空状态处理

| 场景 | 行为 |
|---|---|
| `~/.claude/projects/` 不存在 | 左栏显示空状态："未检测到 Claude Code 历史，请先使用 Claude Code 开始一个会话" |
| 目录存在但无 JSONL 文件 | 左栏显示空状态，同上文案 |
| 有 JSONL 但全部解析失败 | 左栏显示空状态 + 底栏 Logs 面板显示错误摘要 |
| 正常情况 | 导入完成后左栏渲染会话列表 |

应用不创建 `~/.claude/projects/`，只读取。

---

## 7. 数据流

**启动时：**
```
~/.claude/projects/**/*.jsonl
    → (Rust importer) 扫描+解析
    → SQLite (增量同步)
    → Tauri commands
    → React 渲染
```

**运行时（文件变化，防抖 500ms）：**
```
Modify 事件（已有文件追加内容）：
  notify watcher → 增量 sync → emit "conversation:updated" { conversation_id }
      → React invalidate messages query for that conversation → 自动重新渲染

Create 事件（新 JSONL 文件）：
  notify watcher → 全量导入该文件 → emit "conversations:changed"
      → React invalidate 全量 conversations list → 左栏出现新会话

Remove 事件（文件删除）：
  notify watcher → 标记 archived → emit "conversations:changed"
      → React invalidate 全量 conversations list
```

---

## 8. Provider 策略

- **Phase A MVP**：只支持 Claude Code（JSONL 格式已知），`provider` 字段硬写 `"claude_code"`
- **架构**：importer 层预留 provider adapter 接口，后续扩展 Codex/Gemini 不改 schema
- **扩展顺序**：Claude Code → Codex CLI → Gemini CLI

---

## 9. 关键约束

- 1000+ 会话左侧列表流畅滚动（虚拟列表）
- 打开会话历史 < 300ms（SQLite 本地缓存命中）
- 消息列表虚拟滚动，不因长历史卡死 UI
- 应用重启后历史不丢失
- 损坏的 JSONL 行跳过，不崩溃，底栏显示跳过统计

---

## 10. 未做（Phase A 明确排除）

- PTY/进程管理
- 新建会话 / 发消息
- 右侧 Inspector 面板（Diff、Files、Metadata）
- Diff 展示
- 多 provider 支持（Codex、Gemini）
- 云同步
- 自动会话命名（Phase A 截取第一条 user 消息前 60 字符作为 title）
