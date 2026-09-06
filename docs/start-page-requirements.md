# Memos 起始页（Dashboard）需求文档

> 对标产品：柠檬起始页 / 青柠起始页
> 设计原则：完全复用 Memos 现有 Tailwind CSS v4 设计系统（OKLCH 色彩令牌、shadcn 组件、Setting 布局体系），保持体验一致性。

---

## 一、功能概述

在 Memos 前端新增一个可选的"起始页"视图，作为用户登录后的默认首页（可配置是否启用）。起始页提供信息聚合与快速导航能力，核心模块包括：全局搜索栏、快捷方式卡片、书签分组、壁纸设置、时钟/问候语、以及最近笔记速览。

所有模块均可独立开关、拖拽排序，用户偏好持久化到 UserSetting。

---

## 二、全局搜索栏

### 2.1 功能描述

页面顶部居中放置一个大尺寸搜索栏，视觉权重最高，支持多引擎搜索和站内内容搜索。

### 2.2 交互细节

- 默认态：圆角搜索框，placeholder 显示"搜索…"，宽度自适应（桌面端最大 `max-w-2xl`），高度 `h-12`，使用 `Input` 组件变体，`ring` 聚焦态。
- 输入态：左侧搜索图标切换为当前引擎图标，右侧出现清除按钮（X）。
- 提交逻辑：
  - 无前缀 → 使用默认搜索引擎（用户可配置）
  - `@google` / `@baidu` / `@bing`  → 切换引擎后搜索
  - `#` 前缀 → 站内搜索（复用现有 `QuickFindDialog` 的 Connect RPC 查询逻辑）
- 引擎列表可自定义，支持添加/删除/排序，存储在 UserSetting 中。
- 搜索建议下拉：站内笔记标题实时匹配（防抖 300ms），使用 `Popover` 组件渲染建议列表。

### 2.3 组件拆分

```
components/StartPage/
  SearchBar.tsx           -- 搜索栏主体
  SearchEngineSelector.tsx -- 引擎切换下拉（复用 Select 组件）
  SearchSuggestions.tsx   -- 站内建议列表（复用 Popover）
```

---

## 三、快捷方式卡片

### 3.1 功能描述

以网格卡片形式展示用户自定义的快捷入口（网站链接、Memos 内部页面、自定义动作）。

### 3.2 卡片规格

- 布局：CSS Grid，`grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10`，卡片正方形，使用 `SquareDiv` 组件。
- 单卡片尺寸：图标 + 名称（两行），图标 32×32，名称 `text-2xs text-muted-foreground` 单行截断。
- 卡片样式：`bg-card hover:bg-accent rounded-lg border border-border`，hover 时 `shadow-sm` 过渡。
- 支持拖拽排序（使用原生 drag-and-drop，不引入额外依赖）。

### 3.3 快捷方式类型

| 类型 | 说明 | 图标来源 |
|------|------|----------|
| 外部链接 | 用户添加的 URL | 自动抓取 favicon，失败则显示首字母 |
| 内部路由 | Memos 页面跳转（如 /explore、/calendar） | lucide-react 图标 |
| 分组标题 | 不可点击，仅做视觉分组 | 无 |

### 3.4 添加/编辑

- 点击 "+" 卡片打开 `Dialog`（`sm` 尺寸），表单字段：名称、URL、图标（URL 或 lucide 名称）。
- 右键卡片弹出 `DropdownMenu`：编辑、删除、移到其他分组。
- 分组通过"分隔卡片"实现视觉区分，分组名可编辑。

### 3.5 组件拆分

```
components/StartPage/
  ShortcutGrid.tsx        -- 网格容器 + 拖拽逻辑
  ShortcutCard.tsx        -- 单个快捷方式卡片
  ShortcutDialog.tsx      -- 添加/编辑弹窗
```

---

## 四、书签分组

### 4.1 功能描述

以可折叠的分组形式展示用户收藏的链接，支持多级分组。与快捷方式的区别：书签侧重"收藏管理"，快捷方式侧重"高频入口"。

### 4.2 展示形式

- 默认折叠态：分组标题行（`text-sm font-medium`），右侧显示书签数量 badge。
- 展开态：列表形式，每行一个书签（favicon + 名称 + URL 截断），hover 显示操作按钮。
- 分组可嵌套一层（最多两级），二级分组缩进显示。

### 4.3 数据来源

- 书签数据存储在 UserSetting（JSON 字段），结构：

```typescript
interface BookmarkGroup {
  id: string;
  name: string;
  collapsed: boolean;
  children?: BookmarkGroup[];
  items: BookmarkItem[];
}

interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  favicon?: string;
}
```

- 支持从浏览器书签导入（提供 JSON/HTML 导入入口）。
- 支持批量导入（粘贴 URL 列表，自动解析标题）。

### 4.4 操作

- 添加书签：Dialog 表单（标题、URL、选择分组）。
- 拖拽调整：书签可在分组间拖拽移动，分组可拖拽排序。
- 批量操作：长按进入多选模式，支持批量删除/移动。

### 4.5 组件拆分

```
components/StartPage/
  BookmarkPanel.tsx       -- 书签面板容器
  BookmarkGroup.tsx       -- 单个分组（可折叠）
  BookmarkItem.tsx        -- 单条书签
  BookmarkImportDialog.tsx -- 导入弹窗
```

---

## 五、壁纸设置

### 5.1 功能描述

允许用户设置起始页背景壁纸，支持纯色、渐变、图片三种模式。

### 5.2 壁纸类型

| 类型 | 说明 | 配置项 |
|------|------|--------|
| 纯色 | 从预设色板或自定义取色器选择 | 颜色值 |
| 渐变 | 预设渐变方案 + 自定义双色渐变 | 双色 + 角度 |
| 图片 | 本地上传 / URL / 每日一图 | 文件/URL/模糊度/遮罩透明度 |

### 5.3 预设方案

提供 12 个预设渐变方案（与 Memos 主题色系协调，使用 OKLCH 色彩空间的渐变），6 个纯色方案（对应 `--background`、`--accent`、`--muted` 等语义色的变体）。

### 5.4 图片壁纸处理

- 上传后生成缩略图（`200px` 宽），原图存为资源文件（复用 Memos 现有的资源上传 API `CreateResource`）。
- 图片渲染：`object-cover` 全屏铺满，叠加半透明遮罩（`bg-background/60`）确保前景内容可读。
- 模糊度：`backdrop-blur-sm` 到 `backdrop-blur-xl`，用户可调。
- "每日一图"：内置 10 张精选图片，按日期轮换（图片打包到前端 `public/wallpapers/`）。

### 5.5 设置入口

在起始页右上角提供壁纸快捷设置按钮（ImageIcon），点击弹出 `Sheet`（侧边抽屉），包含类型切换、预设选择、自定义配置。设置实时预览。

### 5.6 组件拆分

```
components/StartPage/
  WallpaperProvider.tsx    -- 壁纸上下文 + 渲染层
  WallpaperSettings.tsx    -- 设置面板（Sheet 内容）
  WallpaperPresets.tsx     -- 预设方案网格
  WallpaperUpload.tsx      -- 图片上传 + 裁剪
```

---

## 六、时钟与问候语

### 6.1 功能描述

搜索栏上方显示当前时间和个性化问候语。

### 6.2 展示

- 时间：`text-4xl font-light tracking-tight`，24 小时制，秒级刷新。
- 问候语：根据时段动态切换（"早上好" / "下午好" / "晚上好"），`text-muted-foreground`。
- 日期：`text-sm`，显示完整日期 + 星期 + 农历（可选）。
- 整体居中，位于搜索栏正上方，与搜索栏间距 `space-y-4`。

### 6.3 组件

```
components/StartPage/
  ClockGreeting.tsx       -- 时钟 + 问候语
```

---

## 七、最近笔记速览

### 7.1 功能描述

在起始页下方展示用户最近编辑的笔记摘要，方便快速回到工作状态。

### 7.2 展示形式

- 横向滚动卡片列表，每张卡片显示：标题（首行内容截断）、更新时间（相对时间）、内容预览（前两行，`line-clamp-2`）。
- 卡片样式：`bg-card rounded-lg border border-border p-4`，hover 态同快捷方式卡片。
- 点击跳转到对应 memo 详情页。
- 默认显示 10 条，可按"最近更新" / "最近创建" 切换排序。

### 7.3 数据获取

复用现有 `useMemoList` hook，传入排序参数 `UPDATE_TIME_DESC` 或 `CREATE_TIME_DESC`，limit 10。

### 7.4 组件

```
components/StartPage/
  RecentMemos.tsx         -- 最近笔记速览
  RecentMemoCard.tsx      -- 单条笔记卡片
```

---

## 八、页面布局与路由

### 8.1 路由

新增路由常量 `START: "/start"`，在 `routes.ts` 中注册。起始页作为可选首页，用户可在设置中配置登录后是否跳转到起始页。

### 8.2 整体布局

```
┌──────────────────────────────────────────────────┐
│                   壁纸层（fixed）                  │
│  ┌──────────────────────────────────────────────┐ │
│  │              时钟与问候语                      │ │
│  │                                              │ │
│  │           ┌──────────────────┐               │ │
│  │           │    全局搜索栏     │               │ │
│  │           └──────────────────┘               │ │
│  │                                              │ │
│  │     ┌──────────────────────────────────┐     │ │
│  │     │         快捷方式卡片              │     │ │
│  │     └──────────────────────────────────┘     │ │
│  │                                              │ │
│  │  ┌─────────────────┐ ┌────────────────────┐  │ │
│  │  │   书签分组       │ │  最近笔记速览      │  │ │
│  │  │                 │ │                    │  │ │
│  │  └─────────────────┘ └────────────────────┘  │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

- 壁纸层使用 `fixed inset-0 -z-10`，内容层使用 `relative z-10`。
- 内容区最大宽度 `max-w-5xl`（与 MainLayout 一致），居中。
- 模块间距 `space-y-8`。
- 响应式：移动端隐藏壁纸模糊效果（性能优化），快捷方式卡片减少列数。

### 8.3 与现有布局的关系

起始页**不使用** `MainLayout`（避免 `max-w-5xl` 的居中约束和侧边栏干扰沉浸感），而是直接在 `RootLayout` 下渲染，但保留侧边栏的显示/隐藏切换。侧边栏在起始页默认为收起态。

---

## 九、数据模型与持久化

### 9.1 UserSetting 扩展

在现有 UserSetting 中新增 `start_page_config` 字段（JSON），结构：

```typescript
interface StartPageConfig {
  enabled: boolean;               // 是否启用起始页作为首页
  modules: ModuleConfig[];        // 模块列表（含排序和开关）
  searchEngines: SearchEngine[];  // 搜索引擎配置
  defaultEngine: string;          // 默认搜索引擎 ID
  shortcuts: ShortcutItem[];      // 快捷方式列表
  bookmarkGroups: BookmarkGroup[];// 书签分组
  wallpaper: WallpaperConfig;     // 壁纸配置
}

interface ModuleConfig {
  key: "search" | "shortcuts" | "bookmarks" | "clock" | "recentMemos";
  enabled: boolean;
  order: number;
}

interface WallpaperConfig {
  type: "solid" | "gradient" | "image";
  solidColor?: string;
  gradientColors?: [string, string];
  gradientAngle?: number;
  imageUrl?: string;
  imageResourceUid?: string;     // 关联 Memos 资源
  blurLevel?: number;            // 0-4 档
  overlayOpacity?: number;       // 0-100
  presetId?: string;             // 预设方案 ID
}

interface SearchEngine {
  id: string;
  name: string;
  icon?: string;
  urlTemplate: string;           // 如 "https://www.google.com/search?q={query}"
}

interface ShortcutItem {
  id: string;
  name: string;
  url: string;
  icon?: string;
  type: "external" | "internal";
  groupId?: string;              // 所属分组
}
```

### 9.2 API

复用现有用户设置 API 模式：

- 读取：`GetUserSetting` 扩展返回 `start_page_config`
- 更新：`UpdateUserSetting` 接收部分更新的 `start_page_config`

---

## 十、设置页集成

在现有设置页 `settingSections.ts` 中新增一个 section：

```typescript
{
  key: "start-page",
  scope: "basic",
  labelKey: "setting.start-page",
  icon: LayoutDashboardIcon,
  component: StartPageSettings,
}
```

`StartPageSettings` 组件使用现有 `SettingSection` / `SettingList` / `SettingListItem` 布局体系，提供：

- 启用/禁用起始页开关
- 模块排序（拖拽列表）
- 模块独立开关
- 壁纸预设选择
- 搜索引擎管理

---

## 十一、国际化

所有新增文案使用 i18n key，在 `web/src/locales/` 下各语言文件中添加：

```json
{
  "start-page": {
    "title": "起始页",
    "search-placeholder": "搜索…",
    "greeting-morning": "早上好",
    "greeting-afternoon": "下午好",
    "greeting-evening": "晚上好",
    "shortcuts-add": "添加快捷方式",
    "bookmarks-title": "书签",
    "bookmarks-import": "导入书签",
    "recent-memos": "最近笔记",
    "wallpaper": "壁纸设置",
    "wallpaper-solid": "纯色",
    "wallpaper-gradient": "渐变",
    "wallpaper-image": "图片",
    "wallpaper-daily": "每日一图",
    "settings-title": "起始页设置",
    "settings-enabled": "启用起始页",
    "settings-modules": "模块管理",
    "settings-engines": "搜索引擎"
  }
}
```

---

## 十二、文件结构总览

```
web/src/
  pages/
    StartPage.tsx                    -- 起始页主容器
  components/StartPage/
    SearchBar.tsx
    SearchEngineSelector.tsx
    SearchSuggestions.tsx
    ShortcutGrid.tsx
    ShortcutCard.tsx
    ShortcutDialog.tsx
    BookmarkPanel.tsx
    BookmarkGroup.tsx
    BookmarkItem.tsx
    BookmarkImportDialog.tsx
    WallpaperProvider.tsx
    WallpaperSettings.tsx
    WallpaperPresets.tsx
    WallpaperUpload.tsx
    ClockGreeting.tsx
    RecentMemos.tsx
    RecentMemoCard.tsx
    ModuleDragSort.tsx              -- 模块拖拽排序容器
  components/Settings/
    StartPageSettings.tsx            -- 设置页中的起始页配置
```

---

## 十三、开发阶段建议

| 阶段 | 内容 | 预估工作量 |
|------|------|-----------|
| P0 | 路由注册 + 页面骨架 + 时钟问候语 + 搜索栏（单引擎） | 1-2 天 |
| P1 | 快捷方式卡片（增删改 + 分组） | 2 天 |
| P2 | 书签分组（增删改 + 折叠 + 导入） | 2-3 天 |
| P3 | 壁纸设置（预设 + 上传 + 实时预览） | 2 天 |
| P4 | 最近笔记速览 + 模块拖拽排序 + 设置页集成 | 1-2 天 |
| P5 | 多搜索引擎 + 搜索建议 + 国际化 + 响应式打磨 | 2 天 |

总计约 10-13 天。建议按阶段逐步交付，每阶段完成后进行视觉走查。

---

## 十四、技术约束

- **不引入新依赖**：拖拽排序使用原生 HTML Drag and Drop API，不引入 dnd-kit 等库。
- **复用现有组件**：所有 UI 原语使用 `components/ui/` 下的 shadcn 组件，不新建基础组件。
- **色彩令牌**：所有颜色使用语义化令牌（`bg-card`、`text-muted-foreground` 等），不硬编码颜色值。壁纸遮罩层除外。
- **响应式**：遵循现有断点（sm/md/lg），移动端优先保证搜索栏和快捷方式的可用性。
- **无障碍**：搜索栏支持键盘导航（上下箭头选择建议，Enter 提交），所有交互元素有 `aria-label`。
