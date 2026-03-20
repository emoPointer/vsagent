# 多 Agent 桌面 IDE 方案（面向 Claude Code / Codex / Gemini CLI）

## 1. 项目目标

设计并实现一个类似 VS Code 的桌面应用，用来统一管理和继续使用多个 AI coding agents（至少包括 Claude Code、Codex CLI、Gemini CLI）。

核心目标不是“在一个终端里管理多个终端”，而是提供一个**面向对话与任务的 IDE**：

- 左侧显示所有 agent 会话列表
- 按项目 / 仓库 / agent 类型组织会话
- 点击会话后，在主视图中查看完整历史
- 在当前会话中继续输入并驱动对应 agent 执行
- 能看到 agent 输出、工具调用、命令执行、文件改动、状态变化
- 保留历史、支持搜索、支持恢复
- 最终形成一个真正的“多 agent 开发工作台”

---

## 2. 产品定位

### 2.1 这不是一个终端管理器

现有方案的问题：

- 本质仍然是 terminal multiplexer
- 视图单位是 pane / tab，而不是 conversation / task
- 历史不结构化，难以检索
- 不适合长期积累科研与开发上下文
- 无法自然展示 agent 的工具调用、差异、状态和上下文

### 2.2 这是一个 Agent IDE

视图单位改为：

- **Workspace（工作区）**：一个项目或仓库
- **Conversation（对话）**：和某个 agent 的一段连续会话
- **Run / Turn（回合）**：一次用户输入与 agent 回复
- **Execution（执行）**：agent 发起的命令、patch、工具调用、文件变更

用户感知应接近：

- 左侧像 VS Code Explorer + Chat 列表
- 中间像 Chat 窗口 + 活动记录
- 右侧像 Inspector / Diff / Context / Files



---

## 3. 用户场景

### 3.1 日常编程场景

- 不想记住每个 pane 属于哪个 agent，自动为每个对话命名
- 不想靠 tmux session 名称管理复杂任务
- 希望像邮件客户端 / IDE 一样管理历史和状态
- 在使用其中一个agent进行对话时依然可以通过侧边看到各个agent的工作状态，优先将正在工作的agent放到前方

---

## 4. 核心功能需求

## 4.1 会话管理

必须支持：

- 新建会话，新建时依旧是终端，用户可能会export一些变量，用户可以会启动不同的agent，根据用户启用的agent再标记为claude还是codex还是geminicli
- 继续历史会话
- 删除 / 归档会话
- 重命名会话
- 收藏 / Pin 会话
- 按 agent 类型过滤
- 按 workspace / repo 过滤
- 按关键字搜索会话历史
- 按状态过滤：运行中 / 等待输入 / 出错 / 已完成

### 4.2 消息与历史

每个会话中必须保留：

- 用户输入
- agent 回复
- 系统提示词（若可用）
- 工具调用记录
- shell 命令及输出
- 文件 patch / diff
- 时间戳
- token / 耗时 / 状态（若 CLI 能提供）

### 4.3 agent 交互

支持至少三类 backend adapter：

- Claude Code
- Codex CLI
- Gemini CLI

每种 adapter 要具备：

- 启动新会话
- 恢复历史会话（若原生支持）
- 发送用户输入
- 读取流式输出
- 识别会话完成、等待输入、报错
- 收集工具调用 / shell 输出 / patch 信息

### 4.4 仓库与文件联动

- 会话绑定 workspace / repo
- 能查看当前 repo 文件树
- 显示本次会话改动的文件
- 一键打开 diff
- 支持在 IDE 内展示 patch 预览
- 支持“接受 / 拒绝本次改动”（取决于 adapter 能力）

### 4.5 搜索与知识沉淀

- 全局搜索历史会话
- 搜索某个 repo 的全部 AI 历史
- 搜索包含特定文件、命令或报错的对话
- 基于 tag / issue / experiment 编号管理会话

### 4.6 状态感知

每个会话都应显示：

- 当前 agent 类型
- 当前 workspace
- 当前分支
- 最后活跃时间
- 当前状态（idle / running / waiting\_input / error）
- 是否有未审阅 diff

### 4.7 未来增强

- 多 agent 协同同一任务
- 一个主任务拆成多个子会话
- prompt 模板库
- 会话摘要自动生成
- 实验日志自动关联
- GitHub issue / PR 关联
- 本地知识库索引

---

## 5. 非功能需求

### 5.1 平台

优先支持：

- Ubuntu 桌面

后续可扩展：

- macOS
- Windows

### 5.2 性能

- 左侧加载 1000+ 会话仍能流畅滚动
- 打开单个会话历史时间 < 300ms（本地缓存命中）
- 流式输出延迟低
- 长日志不能卡死 UI

### 5.3 数据可靠性

- 会话持久化到本地数据库
- 应用崩溃后尽量恢复到上次状态
- 输出日志追加写入，避免长内容丢失

### 5.4 可扩展性

- 新增 agent 时不改 UI 主架构
- 通过 adapter plugin 接入新 CLI
- 数据模型尽量统一，不被单一供应商绑死

---

## 6. 总体架构

推荐采用：

- **桌面端**：Tauri
- **前端**：React + TypeScript
- **本地后端**：Rust（Tauri command + process manager）
- **数据库**：SQLite
- **前端状态管理**：Zustand / TanStack Query
- **编辑器组件**：Monaco Editor
- **Diff 展示**：Monaco Diff Editor
- **终端回退视图**：xterm.js（仅用于必要场景）

### 6.1 为什么选 Tauri

原因：

- Ubuntu 桌面分发方便
- 内存占用比 Electron 更低
- Rust 做本地进程与日志处理更稳
- 很适合“前端 UI + 本地系统集成”类型产品

### 6.2 分层架构

#### UI 层

负责：

- 窗口布局
- 列表、对话、diff、搜索、状态展示
- 用户输入与快捷键

#### 应用服务层

负责：

- 会话管理
- 工作区管理
- 搜索索引
- 状态聚合
- 命令调度

#### Adapter 层

统一抽象不同 agent CLI：

- ClaudeCodeAdapter
- CodexAdapter
- GeminiCliAdapter

#### 进程层

负责：

- 启动 CLI 进程
- PTY / stdin/stdout 管理
- 流式日志采集
- 退出码与错误监控

#### 存储层

负责：

- SQLite 持久化
- 日志文件存储
- patch 快照
- UI 偏好设置

---

## 7. 关键设计决策

## 7.1 不直接依赖“截取终端画面”作为主数据源

不要把产品建立在“录屏式抓终端输出 + OCR/ANSI 解析”这种方案上。

正确方向是：

- 能走结构化 adapter 就走结构化 adapter
- 若 CLI 没有官方结构化输出，再退化为 PTY 文本解析
- 数据模型始终统一成 conversation / message / event / diff

### 7.2 对外统一抽象，不让 UI 知道底层是哪个 agent

UI 永远只依赖统一接口：

- createConversation()
- sendMessage()
- streamEvents()
- listConversations()
- resumeConversation()
- cancelRun()

这样才能后续扩展更多 agent。

### 7.3 把“会话”作为第一公民，而不是 terminal session

一个 conversation 需要拥有：

- id
- title
- workspace\_id
- provider
- provider\_session\_ref
- status
- created\_at / updated\_at
- tags
- summary

---

## 8. 数据模型设计

## 8.1 workspaces

```text
workspaces
- id
- name
- root_path
- git_repo_root
- default_branch
- created_at
- updated_at
```

## 8.2 conversations

```text
conversations
- id
- workspace_id
- provider                // claude_code | codex | gemini_cli
- provider_session_ref    // 底层 agent 原始会话引用（如果有）
- title
- description
- status                  // idle | running | waiting_input | error | archived
- branch_name
- pinned
- archived
- last_message_at
- created_at
- updated_at
```

## 8.3 messages

```text
messages
- id
- conversation_id
- role                    // user | assistant | system
- content_text
- seq
- created_at
- token_count_input
- token_count_output
- raw_payload_json
```

## 8.4 events

```text
events
- id
- conversation_id
- message_id              // 可为空；有些 event 独立存在
- event_type              // tool_call | shell_output | patch | status | error | thinking | file_change
- payload_json
- created_at
```

## 8.5 runs

```text
runs
- id
- conversation_id
- trigger_message_id
- status                  // running | success | failed | cancelled
- started_at
- finished_at
- exit_code
- error_text
```

## 8.6 file\_changes

```text
file_changes
- id
- conversation_id
- run_id
- file_path
- change_type             // added | modified | deleted | renamed
- patch_text
- before_hash
- after_hash
- created_at
```

## 8.7 tags

```text
tags
- id
- name

conversation_tags
- conversation_id
- tag_id
```

---

## 9. Adapter 抽象接口

定义统一接口（伪代码）：

```ts
interface AgentAdapter {
  provider: 'claude_code' | 'codex' | 'gemini_cli'

  isInstalled(): Promise<boolean>
  getVersion(): Promise<string>

  createConversation(input: CreateConversationInput): Promise<CreateConversationResult>
  resumeConversation(input: ResumeConversationInput): Promise<ResumeConversationResult>
  sendMessage(input: SendMessageInput): Promise<RunHandle>
  cancelRun(runId: string): Promise<void>
  listNativeSessions?(workspacePath: string): Promise<NativeSessionSummary[]>
  importNativeSession?(nativeSessionId: string): Promise<ImportedConversation>
}
```

流式事件统一成：

```ts
type AgentStreamEvent =
  | { type: 'assistant_text_delta'; text: string }
  | { type: 'assistant_message_done'; messageId: string }
  | { type: 'tool_call'; toolName: string; args: unknown }
  | { type: 'shell_output'; stream: 'stdout' | 'stderr'; text: string }
  | { type: 'patch'; filePath: string; patch: string }
  | { type: 'status'; status: 'running' | 'waiting_input' | 'completed' }
  | { type: 'error'; message: string }
```

---

## 10. 三类 agent 的接入策略

## 10.1 第一优先：优先研究是否有官方结构化模式

对于 Claude Code、Codex CLI、Gemini CLI，实施团队需要逐个确认：

- 是否有 JSON 输出模式
- 是否能列出历史会话
- 是否有 resume / continue 参数
- 是否能输出工具调用、patch、命令结果
- 是否有 API / IPC / stdout 事件格式

### 10.2 第二优先：基于子进程 + PTY 封装

若没有足够的结构化接口，则：

- 使用 PTY 启动原生 CLI
- 记录 stdin/stdout/stderr
- 解析 ANSI 流
- 将文本切分成 message/event
- 维护 provider\_session\_ref

### 10.3 第三优先：导入原生历史

若底层 CLI 自己保存历史文件，可实现 importer：

- 扫描其本地 history 目录
- 解析原始日志 / jsonl / sqlite
- 导入到本应用数据库
- 建立 provider\_session\_ref 映射

### 10.4 强约束

- 不要一开始追求 100% 兼容所有 CLI 细节
- 先把 Claude Code 接好，再抽象到 Codex/Gemini
- 所有 provider 特殊逻辑都必须封装在 adapter 内部

---

## 11. UI 设计

## 11.1 总体布局

推荐三栏 + 底栏：

### 左栏：导航区

包含：

- Workspace 列表
- 会话列表
- 搜索框
- 过滤器（provider / status / tag）
- 新建会话按钮

左栏每个会话项显示：

- 标题
- provider 图标
- repo / branch
- 最后活跃时间
- 状态圆点
- 未审阅 diff 标记

### 中栏：对话主区

包含：

- 会话标题栏
- 消息流
- agent 流式输出
- 用户输入框
- 发送 / 停止按钮
- 快捷动作（总结 / 重命名 / 打 tag / 新分支会话）

### 右栏：上下文检查器

Tab 形式：

- Diff
- Files
- Commands
- Metadata
- Linked Context

### 底栏：执行面板

- Logs
- Problems
- Raw Events
- Fallback Terminal

---

## 12. 关键交互流程

## 12.1 新建会话

1. 直接打开一个终端，用户可以进行任意的终端操作
2. 用于启动claude , codex, geminicli后自动标记为相应的agent
3. 根据内容自动命名对话

## 12.2 继续历史会话

1. 用户在左栏点击会话
2. 应用加载 messages/events/file\_changes
3. 若 provider 支持 resume，则绑定到底层 session
4. 用户输入新消息后继续执行

## 12.3 查看改动

1. agent 运行产生 patch / 文件变更
2. 右侧 Diff tab 高亮提醒
3. 用户点击查看逐文件 diff
4. 可选择复制 patch、导出 patch、打开文件

## 12.4 搜索历史

1. 用户输入关键词
2. 搜索 conversations + messages + file\_changes
3. 按相关度返回结果
4. 定位到会话与具体消息

---

## 13. 最小可行产品（MVP）

## 13.1 MVP 范围

第一版只做：

- Ubuntu 桌面应用
- 支持 1 个 workspace 类型（本地 repo）
- 支持 2 个 provider：Claude Code + Codex
- 左侧会话列表
- 中间聊天区
- 本地 SQLite 持久化
- 流式输出
- 基础状态机
- 基础 diff 展示
- 基础搜索

暂不做：

- 云同步
- 多窗口
- 在线协作
- 插件市场
- 自动总结
- 权限复杂编排
- 复杂多 agent 编排

### 13.2 MVP 成功标准

用户可以：

- 在一个桌面程序里看到全部 Claude / Codex 会话
- 点击任意历史继续对话
- 看见 agent 的持续输出
- 看见这次改了哪些文件
- 关闭程序后再次打开，历史还在

---

## 14. 分阶段实施计划

## Phase 0：技术预研（3–5 天）

目标：把底层不确定性打透。

任务：

1. 调研 Claude Code / Codex / Gemini CLI 的：
   - 安装检测方式
   - 启动方式
   - resume 方式
   - 是否存在结构化输出
   - 历史保存位置
   - 会话标识方式
2. 做最小 Rust PoC：
   - 启动子进程
   - 捕获流式输出
   - 持久化到 sqlite
3. 给每个 provider 产出一页 adapter feasibility 结论

输出物：

- `docs/provider-research/*.md`
- `poc/process-runner/`
- 风险清单

## Phase 1：基础框架（5–7 天）

目标：把桌面壳、数据库、状态管理搭起来。

任务：

- 初始化 Tauri + React + TS 工程
- 建立 SQLite schema 和 migration
- 完成左中右布局
- 建立 conversation/message/event 基础读写
- 实现 workspace 管理

输出物：

- 可启动的桌面应用
- 假数据驱动 UI

## Phase 2：Claude Code Adapter（5–10 天）

目标：先接通一个 provider，形成闭环。

任务：

- 实现 ClaudeCodeAdapter
- 新建会话
- 发送消息
- 流式输出
- 会话保存
- 错误状态处理
- 若可行则实现 resume / import native history

验收：

- 能完整创建和继续 Claude Code 会话

## Phase 3：Codex Adapter（4–8 天）

目标：扩展第二个 provider，验证抽象。

任务：

- 实现 CodexAdapter
- 对齐统一事件模型
- 补足 provider 差异
- 修正 UI 中 provider-specific 漏洞

验收：

- 左侧能同时管理 Claude / Codex 历史

## Phase 4：Diff / 搜索 / 状态完善（5–7 天）

任务：

- 解析 file changes
- 集成 Monaco Diff
- 全文搜索 messages / file\_changes
- 状态徽标与运行面板
- 收藏、归档、tag

## Phase 5：Gemini CLI + 打磨（4–8 天）

任务：

- 接入 GeminiCliAdapter
- 性能优化
- 崩溃恢复
- 打包分发
- 端到端测试

---

## 15. 建议的代码结构

```text
app/
  src/
    components/
      layout/
      sidebar/
      conversation/
      inspector/
      logs/
    features/
      workspaces/
      conversations/
      messages/
      search/
      diffs/
    stores/
    hooks/
    lib/
    types/
  src-tauri/
    src/
      main.rs
      commands/
      db/
      adapters/
        mod.rs
        claude_code.rs
        codex.rs
        gemini.rs
      process/
        pty.rs
        runner.rs
        parser.rs
      domain/
      state/
      search/
    migrations/
  docs/
    architecture.md
    provider-research/
    api-contracts/
```

---

## 16. 状态机设计

每个 conversation / run 需要显式状态机。

### conversation 状态

```text
idle
running
waiting_input
error
archived
```

### run 状态

```text
queued
running
completed
failed
cancelled
```

状态转换要明确记录 event，便于 UI 恢复和调试。

---

## 17. 搜索设计

建议双层方案：

### 第一层：SQLite FTS

索引：

- conversation title
- message content
- file path
- patch text

### 第二层：结构化过滤

- provider
- workspace
- branch
- status
- tag
- 最近活跃时间

后续再考虑 embedding 检索，但不要作为 MVP 阻塞项。

---

## 18. 风险与难点

## 18.1 最大风险：不同 CLI 对历史与恢复支持不一致

应对：

- 从 day 1 就引入 provider\_session\_ref
- 即使不能完美恢复原生 session，也保证本应用层历史完整
- 必要时以“新 run 继承历史上下文”的方式模拟 continue

## 18.2 第二风险：流式输出解析不稳定

应对：

- 保留 raw event log
- 解析失败时允许 fallback 到 raw terminal view
- parser 层保持可替换

## 18.3 第三风险：patch 捕获能力有限

应对：

- 若 agent 本身不提供 patch event，则在 run 前后做 git diff / 文件快照比较
- 每次 run 开始前记录工作树状态
- run 结束后计算差异

## 18.4 第四风险：长上下文与大日志导致 UI 卡顿

应对：

- 消息虚拟列表
- 日志按块加载
- diff 延迟渲染
- 原始输出存文件，数据库只存索引和摘要

---

## 19. 建议的工程规范

- 所有 provider 逻辑必须通过 adapter 层进入系统
- 不允许 UI 直接拼接 CLI 命令
- 所有 event 都应持久化
- 所有 parser 都要有 fixtures 测试
- 所有数据库 schema 变更都要 migration
- 对 provider 失败必须有清晰错误提示

---

## 20. 测试策略

### 单元测试

- parser 测试
- adapter 映射测试
- state machine 测试
- repository/db 测试

### 集成测试

- 新建会话 -> 发消息 -> 收到输出 -> 存库
- 恢复会话 -> 继续消息
- 产生 diff -> 展示 diff

### 端到端测试

- Ubuntu 上真实安装 Claude Code / Codex 后跑 smoke test
- 启动应用
- 新建会话
- 发一条简单 prompt
- 验证左栏更新、消息显示、数据库写入

---

## 21. 给 Claude Code / Codex 的实施指令

下面是建议直接交给实施 agent 的任务拆分方式。

### 任务 1：仓库初始化

目标：初始化 Tauri + React + TypeScript 项目，建立基础布局和 SQLite 持久化。

要求：

- 搭建三栏布局
- 建立 migrations
- 实现 conversation/message/event 基础表
- 用 mock 数据驱动 UI
- 输出运行说明

### 任务 2：定义统一领域模型与 adapter 接口

目标：定义 provider-agnostic 的 Conversation、Message、Event、Run、FileChange 模型，以及 AgentAdapter 接口。

要求：

- 前后端共享类型定义
- 给出 TypeScript 类型和 Rust struct
- 明确状态机
- 提供示例 JSON payload

### 任务 3：实现 Claude Code adapter PoC

目标：接入 Claude Code，支持新建会话、发消息、流式输出、持久化。

要求：

- 优先寻找官方结构化输出能力
- 若没有，则基于 PTY 实现
- 所有原始输出保存到 raw log
- 解析为统一 AgentStreamEvent
- 提供故障回退视图

### 任务 4：实现 Codex adapter PoC

目标：接入 Codex CLI，映射到统一事件模型。

要求：

- 对齐 Claude adapter 的接口
- 分析 resume 和 history 能力
- 产出 provider 差异文档

### 任务 5：实现会话列表 + 历史继续

目标：完成左侧会话导航与点击继续。

要求：

- 支持搜索 / 过滤 / pin / archive
- 点击会话加载历史消息
- 发送新消息可继续当前 conversation

### 任务 6：实现 Diff 与文件改动追踪

目标：在右侧展示本次会话文件改动。

要求：

- 优先使用 provider patch event
- 否则基于 git diff / 文件快照比较
- 支持单文件 diff 浏览

### 任务 7：Gemini CLI 接入与发布打磨

目标：接入第三个 provider，完成 MVP 打包。

要求：

- 完成 ubuntu 打包
- 完成设置页：安装检测、可执行路径、日志目录
- 完成崩溃恢复

---

## 22. 建议的任务优先级

必须先做：

1. 统一数据模型
2. SQLite + migration
3. Tauri 进程管理
4. Claude adapter
5. 会话列表与聊天主区
6. 历史继续

其次再做：

7. Codex adapter
8. diff 与文件改动
9. 搜索
10. Gemini adapter

最后再做：

11. 自动总结
12. 多 agent 编排
13. 云同步
14. 插件机制

---

## 23. 最终交付定义

MVP 完成时，产品应满足：

- Ubuntu 上可安装运行
- 可以管理多个 workspace
- 左侧能统一显示 Claude Code / Codex / Gemini CLI 会话
- 点击历史即可继续操作
- 能看到完整消息流与关键执行日志
- 能看到会话相关的文件改动
- 能搜索历史
- 应用重启后历史不丢失

---

## 24. 一句话总结

这个项目的本质不是“更高级的 tmux”，而是一个**面向 AI 会话、代码变更和任务历史的本地桌面 IDE**。架构上必须把 **conversation 作为第一公民**，把 Claude Code / Codex / Gemini CLI 作为可插拔 provider，通过统一 adapter、事件模型和本地持久化层来实现长期可扩展的多 agent 工作台。

