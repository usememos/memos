# 备忘录（memos）扩展开发架构蓝图：菜单与 Webhook 通知模块

【修订版 v2 概览与决策】

为避免重复造轮子并对齐仓库现状，本修订版确立以下方向：

- Webhook 采用“沿用现有实现 + 能力增强”的路线：
  - 沿用现有用户 Webhook 存储于用户设置（UserSetting.WEBHOOKS），以及既有 API：`/api/v1/{parent=users/*}/webhooks`。
  - 沿用 Memo 事件触发派发（Memo 创建/更新/删除）与异步投递（PostAsync）。
  - 不再落地“新建表 `user_webhook_configs` 与 `/api/v1/webhooks` 路由”的方案；原文中相关章节标记为“废弃（不执行）”。
  - 在服务层引入 NotificationService + Notifier 抽象：支持 RAW（原始通用 Webhook）、WeCom（企业微信机器人）、Bark 三类发送器；RAW 继续复用现有 `plugin/webhook`，WeCom/Bark 由适配器构造第三方要求的 payload 与容错响应。
  - 增强安全与稳健性：SSRF 防护（仅 http/https、禁止回环/内网、DNS 解析后二次 IP 校验）、可选 HMAC-SHA256 请求签名（`X-Memos-Signature`）、指数退避重试与并发限流、失败熔断、指标与日志可观测。
  - 兼容策略：短期可不改 proto/store 时，将“类型”编码为 `url` 前缀（如 `wecom://...`、`bark://...`）或 `title` 约定；长期方案再演进为在 Webhook 结构中新增 `type` 字段（届时需要 proto 变更与数据迁移）。
  - 前端在“设置”页增强 Webhook 管理：类型选择、签名开关、测试发送按钮；沿用现有用户 Webhook API，不新增独立 `/api/v1/webhooks` 路由。

- 菜单模块采用“低侵入 MVP → 价值验证 → 正式域建模”的路线：
  - MVP 阶段不新增库表与 API，仅用前端拼装并创建“订单 Memo”，通过约定标签/内容格式便于筛选与统计。
  - 若验证有价值，再进入正式域建模：新增 proto/service/store，完善权限与分享展示。

—— 本段为修订版 v2 的“优先级更高的指导”，对原文中与之冲突的设计（尤其是新表与新 REST 路径）予以废弃说明，以免与仓库现状产生偏差。——

【分阶段实施计划（按优先级）】

Phase 0｜对齐与清理（0.5 天）
- 标注并冻结原文中“新建 `user_webhook_configs` 表与 `/api/v1/webhooks` 路由”的章节为“废弃（不执行）”。
- 在 README/开发计划中补充本文修订摘要与目标对齐说明。

Phase 1｜Webhook 后端增强（2–4 天）
- 引入 NotificationService、Notifier 接口；实现 `RawNotifier`（复用 plugin/webhook）、`WeComNotifier`、`BarkNotifier`。
- 安全与稳健性：
  - SSRF 防护：scheme 白名单（http/https）、IP 黑名单（回环/内网/元数据），DNS 解析与二次校验。
  - 可选 HMAC-SHA256 签名头 `X-Memos-Signature`（含时间戳，防重放）。
  - 指数退避重试（含抖动）、单用户并发限流、失败熔断与降级。
  - 统一日志与指标：成功/失败计数、耗时、目标主机，避免泄露完整 URL。
- 对第三方响应做“宽容处理”：对 WeCom/Bark 遵循各自返回规范，不再强制 `{code:0}`。

Phase 2｜Webhook 前端增强（1–2 天）
- 设置页新增 Webhook 管理强化：
  - 类型选择（RAW/WeCom/Bark）、签名开关、测试发送按钮。
  - 短期兼容：类型编码放入 `url` 前缀或 `title`；长期等 proto 变更后切换为独立字段。
- 沿用 `/api/v1/{parent=users/*}/webhooks` API，无需新增路由。

Phase 3｜菜单 MVP（1–2 天，可选先行）
- 仅前端：新增“下单”UI，通过拼装内容与标签创建 Memo（示例：`#order #menu:{id} item:{id} qty:{n}`）。
- 列表页/筛选器：基于标签/关键字的视图与导出。

Phase 4｜菜单正式域建模（3–7 天，可选）
- 新增 `menu_service.proto`、后端 service/store，三库迁移同步（SQLite/MySQL/Postgres）。
- 设计字段：使用 enum 表达 visibility；时间统一 `google.protobuf.Timestamp`；建立必要索引。
- 权限与分享：遵循 `users/{user}/menus/{menu}` 风格的资源名与鉴权。

【风险与成本】
- 与上游冲突风险：新增表/路由会与现状冲突——已通过“沿用现有 Webhook 模型”规避。
- 安全风险：直连第三方的 SSRF/签名/限流缺失将导致可用性与安全隐患——通过 Phase 1 加固。
- 菜单域投入产出不确定：通过 MVP 先行验证，降低沉没成本。

【验收标准（关键用例）】
- 用户在设置页创建三类 Webhook，触发 Memo 事件后分别成功投递（RAW/WeCom/Bark）。
- 可选签名开启后，第三方侧能验证 `X-Memos-Signature`。
- 人工压测并发投递场景：无明显阻塞，失败具备重试与合理日志；主机/IP 黑名单生效。
- 菜单 MVP：可在前端完成下单并生成可筛选的订单 Memo；能导出基础统计。

【过时章节说明】
- 原文“Webhook 配置数据库模式（`user_webhook_configs`）”与“`/api/v1/webhooks` 路由”相关段落标记为废弃（不执行）。
- 原文保留作为对照，但以后端现状与本修订版为准实施。


## 第 1 节：现有 `memos` 架构分析

为了确保新增模块能够无缝集成并保持项目既有的高质量标准，首先必须对 `memos` 的核心架构、技术选型和设计哲学进行深入分析。此分析将为后续的开发工作奠定坚实的基础，确保扩展功能与原生功能在风格、性能和维护性上保持一致。

### 1.1 核心技术栈与设计哲学

`memos` 项目的核心定位是一个现代、开源、自托管的知识管理和笔记平台，其技术选型和设计哲学紧密围绕着性能、隐私和可扩展性展开 1。

- **技术栈构成**：项目采用前后端分离的架构。后端服务使用 Go 语言构建，旨在实现最佳的资源利用率和高并发性能；前端则采用 React 和 TypeScript 技术栈，提供了一个响应式且现代化的用户界面 3。这种组合在现代 Web 应用中非常普遍，兼顾了服务端的稳定高效与客户端的丰富交互体验。
    
- **核心设计哲学**：
    
    1. **隐私优先与数据所有权**：`memos` 强调用户对数据的完全控制。所有数据都存储在用户自选的本地数据库中（支持 SQLite、PostgreSQL、MySQL），并且其核心运行时不依赖任何第三方云服务 1。
        
    2. **轻量级与高性能**：项目追求最小的系统资源占用和高效的性能表现，这体现在其 Go 后端和精简的部署要求上 3。
        
    3. **API 优先设计**：`memos` 采用 API-First 的设计原则，提供了一套完整的 RESTful API，这为第三方集成和功能扩展铺平了道路 3。
        
- **开源许可**：项目基于 MIT 许可证开源，该许可证非常宽松，完全允许并鼓励社区在此基础上进行二次开发、修改和商业使用，为本次开发计划提供了法律保障 3。
    

对于本次开发任务，这些特性意味着：新增的 Webhook 通知模块虽然会引入外部依赖，但必须设计为可选的用户配置项，以维持核心应用的“零外部依赖”原则。同时，所有新功能的实现都应遵循 API 优先的原则，首先定义清晰的 API 契约。

### 1.2 后端架构 (Go)

`memos` 的后端代码库遵循了 Go 社区推崇的标准化项目布局，实现了清晰的关注点分离 6。通过分析其 Go 包文档，可以识别出几个关键的目录结构及其职责 5：

- `/server`：此目录是应用的核心，包含了主要的业务逻辑、服务编排以及 HTTP 服务器的启动和配置代码。
    
- `/store`：作为数据持久化层，该目录抽象了所有与数据库的交互。它定义了数据访问对象（DAO）的接口，并为不同的数据库（如 SQLite, PostgreSQL）提供了具体的实现。这种设计使得业务逻辑层无需关心底层数据库的具体类型。
    
- `/router/api/v1`：此目录负责定义所有 v1 版本的 RESTful API 路由和对应的处理器（Handlers）。它将传入的 HTTP 请求路由到 `/server` 中相应的服务逻辑进行处理。
    
- `/db`：包含数据库迁移脚本和特定数据库的连接逻辑，是 `/store` 层的底层支持。
    

这种分层结构为我们的二次开发提供了明确的指导。新的菜单和 Webhook 功能将在现有结构中进行扩展：

- 新的数据模型和数据库操作将在 `/store` 目录中定义。
    
- 核心业务逻辑，如菜单管理、下单处理、通知发送等，将在 `/server` 目录中以新服务的形式实现。
    
- 所有对外的功能都将通过在 `/router/api/v1` 目录中添加新的 API 端点来暴露。
    

### 1.3 前端架构 (React/TypeScript)

`memos` 的前端是一个使用 TypeScript 构建的单页应用（SPA），具有良好的组件化结构 3。近期的代码提交活动表明，项目正在持续进行前端依赖升级和组件功能增强（例如，为代码块组件增加主题感知的高亮功能），这反映了一个健康且现代化的前端工程实践 8。

值得注意的是，社区用户反馈中提到了对更直观的文本格式化 UI 和更好的内容组织方式（如看板视图）的需求 9。这提示我们在设计新模块的用户界面时，应注重提供丰富、直观的交互体验。为了保持视觉风格的统一，新组件的开发应尽可能复用项目现有的 UI 组件库和设计系统。从 `usememos/mui` 这个仓库的存在可以推断，项目可能使用了 Material-UI 或其变体作为基础 UI 框架 2。

### 1.4 架构和谐性与领域演进

本次计划开发的两个模块在架构层面代表了两种截然不同的挑战，对它们的正确认识是设计成功的关键。

- **菜单模块**：这是一个**领域扩展**。它深度集成于应用的核心数据模型，需要创建与现有 `users` 表强关联的新数据表，并且其核心功能（下单）会直接影响到另一核心领域（创建备忘录）。它的设计重点在于稳健的数据建模、与现有服务的无缝集成以及高效的数据查询。
    
- **Webhook 通知模块**：这是一个**横切关注点**。它本质上是一个工具性功能，应与核心业务逻辑保持松耦合。当某个事件（如“备忘录已创建”）发生时，它需要被触发，然后执行一个独立的任务（发送 HTTP 请求）。它不需要了解“备忘录”或“菜单”的内部复杂性，只需要知道事件的发生和必要的上下文数据。它的设计重点在于通用性、可扩展性和事件驱动的抽象。
    

这种区别引导我们采用不同的设计策略。此外，引入一个公开的“菜单”功能，意味着 `memos` 将从一个纯粹的个人知识管理工具，向一个支持多用户互动的平台演进。这个转变要求我们在设计数据模型和 API 时，必须比原始应用更加审慎地处理数据的可见性（公开 vs. 私有）和访问控制，这是确保系统安全和用户隐私的基础。

## 第 2 节：菜单模块详细开发计划

本节将提供一个完整且可执行的菜单模块开发方案，涵盖从概念设计、数据建模到前后端实现的全过程。

### 2.1 概念框架与用户故事

为了精确定义模块的功能边界和用户体验，我们采用用户故事的形式来描述需求：

- **作为用户，我想要创建一个新菜单，并为其设置标题和描述，以便我可以分享一系列菜品。**
    
- **作为菜单创建者，我想要向我的菜单中添加菜品，每个菜品都包含名称、价格、描述，并能上传一张图片。**
    
- **作为任何用户，我想要浏览系统中所有公开的菜单列表。**
    
- **作为任何用户，我想要查看单个菜单的详细信息，包括其所有的菜品和图片。**
    
- **作为浏览菜单的用户，我想要“点”一个菜品，这个操作应该在我的个人备忘录中自动创建一条新的待办事项，格式为：“点餐：来自【菜单标题】的【菜品名称】”。**
    

### 2.2 数据库模式扩展

`memos` 项目支持多种数据库，因此新的数据表结构设计必须使用通用的 SQL 数据类型和约束，并通过 `/store` 目录中的数据访问层进行实现，以保证兼容性 1。为了支持菜单模块，需要在数据库中引入以下新表：

**表 1：菜单模块数据库模式**

|表名|字段名|数据类型|约束/索引|描述|
|---|---|---|---|---|
|`menus`|`id`|`INTEGER`|`PRIMARY KEY`, `AUTOINCREMENT`|菜单唯一标识符|
||`creator_id`|`INTEGER`|`NOT NULL`, `FOREIGN KEY (users.id)`, `INDEX`|创建者用户 ID|
||`title`|`TEXT`|`NOT NULL`|菜单标题|
||`description`|`TEXT`||菜单描述|
||`visibility`|`TEXT`|`NOT NULL`, `DEFAULT 'PUBLIC'`|可见性 (例如, 'PUBLIC', 'PRIVATE')|
||`created_ts`|`INTEGER`|`NOT NULL`|创建时间戳|
||`updated_ts`|`INTEGER`|`NOT NULL`|更新时间戳|
|`menu_items`|`id`|`INTEGER`|`PRIMARY KEY`, `AUTOINCREMENT`|菜品唯一标识符|
||`menu_id`|`INTEGER`|`NOT NULL`, `FOREIGN KEY (menus.id)`, `INDEX`|所属菜单 ID|
||`name`|`TEXT`|`NOT NULL`|菜品名称|
||`description`|`TEXT`||菜品描述|
||`price`|`REAL`||菜品价格|
||`image_url`|`TEXT`||菜品图片 URL|
||`created_ts`|`INTEGER`|`NOT NULL`|创建时间戳|
||`updated_ts`|`INTEGER`|`NOT NULL`|更新时间戳|
|`orders`|`id`|`INTEGER`|`PRIMARY KEY`, `AUTOINCREMENT`|订单记录唯一标识符|
||`user_id`|`INTEGER`|`NOT NULL`, `FOREIGN KEY (users.id)`, `INDEX`|下单用户 ID|
||`menu_item_id`|`INTEGER`|`NOT NULL`, `FOREIGN KEY (menu_items.id)`|所点菜品 ID|
||`created_ts`|`INTEGER`|`NOT NULL`|下单时间戳|

此模式设计通过外键关联了用户、菜单和菜品，并通过索引优化了查询性能。`orders` 表主要用于记录操作历史，可用于未来的数据分析。

### 2.3 后端开发 (Go)

#### 2.3.1 数据访问层 (`/store`)

需要在 `/store` 目录下新增与 `menus` 和 `menu_items` 表对应的 CRUD (Create, Read, Update, Delete) 操作函数。例如：

- `CreateMenu(ctx context.Context, create *Menu) (*Menu, error)`
    
- `FindMenus(ctx context.Context, find *MenuFind) (*Menu, error)` (支持按 `visibility` 等条件过滤)
    
- `GetMenuByID(ctx context.Context, id int) (*Menu, error)`
    
- `CreateMenuItem(ctx context.Context, create *MenuItem) (*MenuItem, error)`
    
- `FindMenuItems(ctx context.Context, find *MenuItemFind) (*MenuItem, error)`
    
- `CreateOrder(ctx context.Context, create *Order) (*Order, error)`
    

#### 2.3.2 服务层 (`/server`)

将在 `/server` 目录下创建一个新的服务文件，例如 `menu_service.go`，用于封装所有与菜单相关的业务逻辑。

- **图片处理**：`memos` 已具备媒体集成能力 2。图片上传逻辑将复用这一能力。服务层将负责处理文件上传请求，将图片保存到配置的存储位置（本地文件系统或 S3 等对象存储），然后将访问 URL 或资源标识符存入 `menu_items.image_url` 字段。
    
- **下单逻辑**：`CreateOrder` 服务函数是实现核心交互功能的关键。当接收到下单请求时，它将执行以下操作：
    
    1. 在 `orders` 表中创建一条记录，以作审计。
        
    2. 调用现有的 `MemoService`，为发起请求的用户创建一个新的备忘录。备忘录的内容将根据用户故事中的格式动态生成。这种跨服务的调用体现了模块间的协同工作。
        

#### 2.3.3 API 层 (`/router/api/v1`)

为了将后端功能暴露给前端，需要在 `/router/api/v1` 目录中定义一组新的 RESTful API 端点。这些端点构成了前后端通信的契约。

**表 2：菜单模块 REST API 端点**

|方法 (Method)|路径 (Path)|描述|认证|
|---|---|---|---|
|`POST`|`/api/v1/menus`|创建一个新菜单|需要|
|`GET`|`/api/v1/menus`|获取所有公开菜单的列表|可选|
|`GET`|`/api/v1/menus/{id}`|获取单个菜单的详细信息及其菜品|可选|
|`PATCH`|`/api/v1/menus/{id}`|更新一个菜单的信息（仅限创建者）|需要|
|`DELETE`|`/api/v1/menus/{id}`|删除一个菜单（仅限创建者）|需要|
|`POST`|`/api/v1/menus/{id}/items`|向指定菜单添加一个新菜品（仅限创建者）|需要|
|`PATCH`|`/api/v1/items/{id}`|更新一个菜品的信息（仅限创建者）|需要|
|`DELETE`|`/api/v1/items/{id}`|删除一个菜品（仅限创建者）|需要|
|`POST`|`/api/v1/items/{id}/order`|为指定菜品下单（创建备忘录）|需要|

### 2.4 前端开发 (React/TypeScript)

#### 2.4.1 API 客户端

扩展现有的 API 客户端（通常是一个封装了 `fetch` 或 `axios` 的模块），添加调用上述新 API 端点的函数。

#### 2.4.2 新组件与视图

需要开发以下新的 React 组件和页面视图：

- `MenuListView.tsx`：一个新页面，用于以卡片或列表的形式展示所有公开菜单。
    
- `MenuDetailView.tsx`：一个新页面，用于展示单个菜单的详细信息及其包含的所有菜品。
    
- `MenuItemCard.tsx`：一个可复用的组件，用于展示单个菜品的信息，包括图片、名称、价格、描述以及一个“点餐”按钮。
    
- `MenuCreateForm.tsx`：一个表单组件，可能以模态框的形式出现，用于创建和编辑菜单及菜品，其中应包含一个文件上传控件用于上传菜品图片。
    

#### 2.4.3 路由与状态管理

- 在应用的前端路由器中添加新的路由规则，例如 `/menus` 指向 `MenuListView`，`/menus/:id` 指向 `MenuDetailView`。
    
- 利用现有的全局状态管理方案（如 Zustand, Redux 等）来管理菜单列表、当前查看的菜单详情等状态，以实现高效的数据共享和响应式更新。
    

## 第 3 节：Webhook 通知模块详细开发计划

本节将设计一个灵活、可扩展的通知系统，通过 Webhook 与企业微信和 Bark 等第三方服务集成。

### 3.1 架构设计：一个通用的通知服务

直接在核心业务逻辑中硬编码针对企业微信和 Bark 的通知代码，会造成系统的高度耦合和扩展困难。因此，我们将设计一个通用的、基于接口的通知服务。

**设计方案**：

1. 在 Go 中定义一个 `Notifier` 接口，该接口只包含一个方法：`Send(ctx context.Context, payload interface{}) error`。
    
2. 创建一个 `NotificationService`，它负责管理一个用户的所有已启用的通知器（Notifier）实例。
    
3. 当应用中发生需要通知的事件时（例如，“新备忘录已创建”），相关的服务会调用 `NotificationService`。
    
4. `NotificationService` 会遍历该用户的通知器列表，并依次调用每个通知器的 `Send` 方法。
    
5. 为每个支持的通知平台（企业微信、Bark）创建一个实现了 `Notifier` 接口的具体结构体，如 `WeComNotifier` 和 `BarkNotifier`。这些结构体将封装各自平台特定的数据格式化逻辑和 HTTP 请求发送逻辑。
    

这种设计模式（策略模式）具有极佳的可扩展性。未来若要支持新的通知平台（如 Slack、Discord），只需创建一个新的、实现了 `Notifier` 接口的结构体即可，无需修改任何现有业务逻辑。

### 3.2 后端开发 (Go)

#### 3.2.1 数据库模式

需要一张新表来存储用户配置的 Webhook 信息。

**表 3：Webhook 配置数据库模式**

|表名|字段名|数据类型|约束/索引|描述|
|---|---|---|---|---|
|`user_webhook_configs`|`id`|`INTEGER`|`PRIMARY KEY`, `AUTOINCREMENT`|配置唯一标识符|
||`user_id`|`INTEGER`|`NOT NULL`, `FOREIGN KEY (users.id)`, `INDEX`|所属用户 ID|
||`name`|`TEXT`|`NOT NULL`|配置名称 (用户自定义)|
||`type`|`TEXT`|`NOT NULL`|Webhook 类型 ('WECOM', 'BARK')|
||`url`|`TEXT`|`NOT NULL`|Webhook URL (可能包含敏感信息)|
||`enabled`|`BOOLEAN`|`NOT NULL`, `DEFAULT TRUE`|是否启用|
||`created_ts`|`INTEGER`|`NOT NULL`|创建时间戳|
||`updated_ts`|`INTEGER`|`NOT NULL`|更新时间戳|

这张表允许用户为自己的账户配置多个不同类型的通知渠道，并能独立启用或禁用它们。

#### 3.2.2 API 与服务层

- **管理 API**：在 `/api/v1/webhooks` 路径下创建一套标准的 CRUD API 端点，供前端页面管理 `user_webhook_configs` 表中的数据。
    
- **通知器实现**：
    
    - **企业微信 (`WeComNotifier`)**：该通知器的 `Send` 方法将根据企业微信群机器人的要求构建 JSON 负载（payload），然后向用户配置的 URL 发送 HTTP POST 请求。用户需要按照企业微信的指引，在群聊中创建一个“群机器人”来获取这个 Webhook URL 10。虽然提供的资料中未包含确切的 JSON 格式 12，但实现时应参考企业微信开发者官方文档，支持发送文本或 Markdown 格式的消息。
        
    - **Bark (`BarkNotifier`)**：Bark 的通知机制更为简单，通常是通过构造一个特定的 URL 并发送 GET 或 POST 请求来实现的 13。例如，URL 格式可能为 `https://api.day.app/{key}/{title}/{body}`。`BarkNotifier` 的 `Send` 方法将根据传入的 payload 构建此 URL 并发起请求。用户配置的 `url` 字段将存储 `https://api.day.app/{key}` 这部分。`bark-server` 项目本身也是用 Go 编写的，这为我们的实现提供了良好的参考和技术可行性验证 14。
        
- **事件触发**：
    
    - 作为初始实现，我们将修改现有的 `CreateMemo` 服务函数。在备忘录成功保存到数据库后，该函数将异步调用 `NotificationService`，为创建该备忘录的用户触发通知。
        
    - 这种事件驱动的模式具有强大的潜力。在后续的开发中，菜单模块的 `CreateOrder` 服务函数也可以触发同一个 `NotificationService`。这样就可以实现一个强大的联动功能：当有顾客下单时，菜单的创建者可以立即通过 Bark 收到一条推送通知，从而将两个新模块有机地连接起来。
        

### 3.3 前端开发 (React/TypeScript)

#### 3.3.1 新组件与视图

- 在用户的“设置”页面中，创建一个新的标签页或区域，命名为“通知”或“集成”。
    
- `WebhookConfigList.tsx`：一个用于展示用户当前已配置的所有 Webhook 列表的组件，每行包含名称、类型、状态，以及编辑和删除按钮。
    
- `WebhookEditForm.tsx`：一个用于添加或编辑 Webhook 配置的表单组件。表单应包含以下字段：一个用于自定义的名称输入框，一个用于选择类型（企业微信、Bark）的下拉菜单，以及一个用于粘贴 Webhook URL 的文本输入框。
    

## 第 4 节：分阶段实施路线图与质量保证

为了确保项目能够平稳、高效地推进，并交付高质量的功能，特制定以下分阶段的实施与测试计划。

### 4.1 实施分期

将整个开发过程分解为多个逻辑清晰、可独立测试的阶段，有助于管理复杂性并实现价值的增量交付。

- **第一阶段：后端基础建设**
    
    - 任务：实现两个模块的数据库模式变更（表 1 和表 3）。编写并提交数据库迁移脚本。在 `/store` 包中实现所有新表的底层 CRUD 函数。
        
    - 目标：完成数据持久化层，为上层业务逻辑提供数据操作接口。
        
- **第二阶段：菜单模块 - 后端**
    
    - 任务：构建菜单模块的服务层逻辑和 API 端点（如表 2 所定义）。实现图片上传与处理逻辑。
        
    - 目标：完成菜单模块的所有后端功能，并通过 API 测试工具（如 Postman）验证其正确性。
        
- **第三阶段：菜单模块 - 前端**
    
    - 任务：开发用于创建、浏览、查看和点餐的 React 组件与视图。将前端组件与第二阶段开发的 API 对接。
        
    - 目标：交付功能完整的菜单模块用户界面。
        
- **第四阶段：Webhook 模块 - 后端**
    
    - 任务：实现通用的 `NotificationService` 和 `Notifier` 接口。具体实现 `WeComNotifier` 和 `BarkNotifier`。开发用于管理 Webhook 配置的 API。将第一个事件触发点集成到 `CreateMemo` 服务中。
        
    - 目标：完成 Webhook 通知模块的后端核心功能。
        
- **第五阶段：Webhook 模块 - 前端**
    
    - 任务：在用户设置页面中构建用于管理 Webhook 配置的用户界面。
        
    - 目标：允许用户通过界面自主配置和管理他们的通知渠道。
        
- **第六阶段：集成与端到端测试**
    
    - 任务：将“下单成功”事件连接到通知服务。对所有新开发的用户流程进行全面的端到端测试。
        
    - 目标：确保两个模块协同工作正常，并修复所有在集成过程中发现的问题。
        

### 4.2 测试与验证策略

- **单元测试 (Go)**：所有在后端新增的服务函数、数据访问方法和工具函数都必须编写相应的单元测试，以确保其逻辑的正确性。
    
- **集成测试 (Go)**：对所有新增的 API 端点进行集成测试，验证请求处理、认证逻辑、数据校验和响应格式的正确性。
    
- **组件测试 (React)**：使用 Jest 和 React Testing Library 等框架，对核心的前端组件（如表单、卡片）进行隔离测试。
    
- **端到端 (E2E) 测试**：使用 Cypress 或 Playwright 等自动化测试框架，为以下关键用户流程创建 E2E 测试用例：
    
    1. 用户 A 成功创建一个包含菜品的公开菜单。
        
    2. 用户 B 浏览菜单列表，进入用户 A 创建的菜单详情页，并成功下单。
        
    3. 验证用户 B 的备忘录列表中出现了一条新的待办事项。
        
    4. 用户 C 配置一个 Bark Webhook，然后创建一条新的备忘录，验证其手机收到了 Bark 推送通知。
        

### 4.3 部署与配置

- **配置管理**：新的功能可能需要引入新的环境变量，特别是当菜品图片使用云存储（如 S3）时。需要在文档中明确说明这些新的配置项及其作用。
    
- **数据库迁移**：必须提供一个可靠的、非破坏性的数据库迁移脚本。该脚本负责在现有的 `memos` 实例上安全地应用新的数据表结构（表 1 和表 3），确保用户升级过程平滑，数据无损。
