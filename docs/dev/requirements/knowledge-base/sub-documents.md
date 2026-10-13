# 子文档与 References 区块

主文档写长了以后，有一类内容是**跑不掉又放不下**的：和主线强相关、甚至是主线的附属，
但信息密度低，摊在正文里就是噪音。今天这类内容只有两个去处，两个都不对：

- **塞进评论**——评论是讨论，不是内容。长文塞进去既难写（评论编辑器是窄边栏）
  也难读（卡片式渲染），而且评论面板本身开关成本高。
- **单独建一篇文档**——它会进文件树，和真正的主线文档平起平坐，
  制造"这篇到底重不重要"的认知负担。

**子文档**就是这第三个去处。一句话定性：

> 子文档是主文档的一部分，不是独立文档，也不是评论。
> 它承载"属于这篇、但不该占正文篇幅"的内容。

这条定性不是修辞，下面每一个设计决定都从它推出来——尤其是
[§7 生命周期](#7-生命周期跟着父文档走)（跟着父文档归档/删除）和
[§3 不可共享](#33-一篇子文档只属于一个父文档)（不能被第二篇文档引用）。

---

## 1. 为什么是"子 memo"而不是别的

三条路都评估过：

| 方案 | 能编辑 | 不进文件树 | 可打印 | 判定 |
|---|---|---|---|---|
| **子 memo**（COMMENT 关系） | ✅ | ✅ `ExcludeComments` 已覆盖 | ✅ 复用 `/memos/{uid}/reader` | **采用** |
| 普通文档 + REFERENCE 关系 | ✅ | ❌ 要新造"隐藏文档"概念 | ✅ | 否 |
| 纯 md 附件 + 渲染页 | ❌ 附件是不可变字节 | ✅ | 靠浏览器 | 否 |

子 memo 几乎不新增概念：

- **不进文件树**：树构建、搜索、RSS、统计全程 `ExcludeComments: true`
  （[workspace_service.go:233](../../../../server/router/api/v1/workspace_service.go)、
  [memo_service.go:267](../../../../server/router/api/v1/memo_service.go) 等）。
- **详情页现成**：`/memos/{uid}`，[MemoDetail](../../../../web/src/pages/MemoDetail.tsx) 已经会显示 parent 面包屑。
- **打印现成**：`/memos/{uid}/reader`（[MemoReader](../../../../web/src/pages/MemoReader.tsx)），
  裸页 + 浏览器打印，本来就是全站的导出 PDF 入口。

"可编辑 + 可打印"两条硬需求因此是零成本拿到的。

---

## 2. 寻址：保留 folder_path `_sub/<父文档uid>`

这是全篇的地基，也是最不直觉的一条，所以先讲依据。

### 2.1 依据：空标题会被填成 uid，而 (workspace, folder_path, title) 是唯一的

```go
// store/memo.go:171
if create.Title == "" {
    create.Title = create.UID
}
```

```sql
-- store/migration/sqlite/LATEST.sql:49
CREATE UNIQUE INDEX idx_memo_workspace_folder_title ON memo (workspace_id, folder_path, title);
```

这解释了今天的评论为什么不撞车：**每条评论的 title 就是它自己的 uid**，天然唯一。

子文档不行——它必须有**真标题**，因为 References 区块要拿它当标签、memogit 要拿它当文件名。
一旦有了真标题，`folder_path = ""` 就意味着子文档和**库根下的主线文档**共用一个命名空间：
一篇叫"补充说明"的子文档会和根目录下同名文档冲突，报出来的还是一个让人摸不着头脑的
`duplicateMemoPathError`。

### 2.2 结论：`folder_path = "_sub/<父文档uid>"`

一次解决四件事：

1. **命名空间按父文档隔离**——同一父文档下不能有两篇同名子文档（这正是想要的约束），
   跨父文档同名互不干扰，也不会撞到任何主线文档。
2. **仍然不在树上显形**——树构建排除 comment，与 folder_path 无关。
3. **父文档改名/移动不影响它**——路径按 uid 锚定，不是按标题或位置。
4. **子文档自动获得三字段地址**（`workspace` + `folder_path` + `title`），
   这是 [§5 MCP](#5-mcp路径即绑定) 能做到"不加任何工具"的唯一原因。

`_sub` 是**保留前缀**：用户在 app 里不能创建以它开头的文件夹，
memogit 本地也不能手工新建同名目录。观感上与 memogit 已有的 `_attachments/` 一致。

### 2.3 判别方式：路径本身就是判别式，不加 payload 字段

```
评论   = COMMENT 关系 + folder_path 不以 "_sub/" 开头
子文档 = COMMENT 关系 + folder_path == "_sub/<父文档uid>"
```

**刻意不在 `MemoPayload` 里加标志位**。加了就有两个真相来源（路径一个、标志位一个），
它们迟早漂移；而路径是创建时就必须写对的东西，漂移不了。
代价是判别逻辑散落在前后端各处，靠一个共享的常量 + helper 收口。

### 2.4 必须修：子文档要落在父文档的知识库里

`CreateMemoComment` 把请求里的 Memo 原样转给 `CreateMemo`，而客户端不传 `workspace`，
于是走 [resolveWorkspaceForMemo](../../../../server/router/api/v1/workspace_service.go) 的
空分支 → **落到当前用户的默认知识库**，而不是父文档所在的知识库。

对评论来说这一直是个隐性问题（正文不可见，没人撞见）；对子文档来说是**硬伤**：
memogit 按知识库检出、ACL 按知识库判定，落错库的子文档会检出到错误的仓库里去。

所以子文档创建时**必须显式继承父文档的 `workspace_id`**。
（评论的同一问题不在本篇范围内，但修复点是同一处，实现时一并处理。）

---

## 3. 与评论的分野

### 3.1 两者都是子 memo，但面板互不串台

- **评论面板**（[DocCommentSidebar](../../../../web/src/components/DocComments/DocCommentSidebar.tsx)）
  过滤掉子文档。
- **References 区块**只列子文档，不列评论。
- 详情页的评论列表同样过滤。

判别式见 §2.3。

### 3.2 评论保留全部现有能力

子文档不取代评论。锚定高亮、mark 调色板、评论编辑与打印——
[Manual 8](../../../manual/08-document-comments.md) 描述的一切原样保留。
本篇只是把"长文"从评论里分流出去。

### 3.3 一篇子文档只属于一个父文档

不支持被第二篇文档引用。这是定性的直接推论：它是主文档的一部分，
不是一份可共享的资料。需要共享的内容，说明它本来就该是一篇主线文档。

---

## 4. References 区块与正文引用

### 4.1 区块位置与形态

在文档底部、**附件区块上方**，复用
[MetadataSection](../../../../web/src/components/MemoMetadata/MetadataSection.tsx)
的外壳，与附件区块同构。条目列出子文档标题 + 摘要信息。

**没有子文档时，这个区块整个不出现**——正文下方没有，大纲里也没有入口。
一个只剩标题的空区块对读者没有任何用处，只是噪音。

**新建与上传只在编辑态出现。** 往文档里加东西是一次编辑，所以这两个控件挂在
编辑器的元数据区（挨着附件编辑器），而不是预览里。预览里的 References 区块是纯只读的。

**条目在新标签页打开。** 子文档是"读主文档时顺手看一眼"的东西，不是替代主文档：
原地跳走会丢掉主文档的滚动位置，每看一条附属内容都要走回来。正文里的脚注引用
同理——普通点击是滚到区块条目（见 §4.3），真要打开时同样开新标签页。

大纲里的跳转入口与
`ATTACHMENTS_ANCHOR_ID`（[DocumentOutline.tsx](../../../../web/src/components/Notebook/DocumentOutline.tsx)）
同构，并和区块本身一样以"有没有子文档"为显示条件。

### 4.2 md 归属按入口决定，不按文件类型

> **你放进哪个区块，它就是什么。**

- 拖进正文 / 放进附件区块的 `.md` —— 还是附件（S3 字节，可下载）。
- 放进 References 区块的 `.md` —— 转成子文档。

**不在 [uploadService](../../../../web/src/components/MemoEditor/services/uploadService.ts) 里按扩展名分流**：
它是正文粘贴（[EditorContent.tsx:55](../../../../web/src/components/MemoEditor/components/EditorContent.tsx)）
和附件落盘（[memoService.ts:90](../../../../web/src/components/MemoEditor/services/memoService.ts)）
共用的路径，在那里加类型特例会让"往正文里拖一个 md"也变成子文档。

References 区块除了上传 md，也能**直接新建空白子文档**——把内容粘进去往往比先存成文件再上传更顺手。

**历史 md 附件不迁移。** 早先上传的 md 留在附件区块里，用户有需要自己下载重传。
因此 md 会长期合法地出现在两个区块里，两者的图标与副标题必须能一眼区分。

### 4.3 正文引用：存普通文档链接，渲染成脚注

子文档有真实 folder_path，于是正文里引用它就是一条**普通的库根相对链接**：

```markdown
[补充说明](/_sub/abc123/补充说明.md)
```

选它而不是 `#` 锚点，是因为**改名修链免费继承**：
`#` 锚点被 [classifyDocHref](../../../../web/src/components/MemoContent/DocumentLinkContext.tsx) 判为
`external`，完全不进 `ExtractLinks`/`RewriteLinks`，子文档一改名锚点就静默失效；
而普通文档链接已经被 P0 反向索引与 P4/P5 修链覆盖
（[cross-reference-repair-on-move-rename.md](../cross-reference-repair-on-move-rename.md)）。

**存的是链接，渲染的是脚注。** 前端识别出"这条链接指向本文档自己的子文档"时：

- 渲染成脚注样式的小标记，而不是普通蓝链；
- 点击**滚动到下方 References 区块的对应条目**，不跳走——
  子文档是本文的一部分，读者不该因为看一眼附属内容就丢掉阅读位置；
- Cmd/Ctrl + 点击仍然正常打开子文档详情页。

那条丑路径不需要用户手写：References 区块提供"插入引用到正文"。

---

## 5. MCP：路径即绑定

MCP 刻意只暴露 9 个工具，因为每个工具的 JSON schema 在整个会话里常驻上下文
（[catalog.go:22](../../../../server/router/mcp/catalog.go)）。
`CreateMemoComment` 不在其中，`relations` 对 agent 也不可写
（[mcp.md §3](../../../skill/references/mcp.md)）。

**规则：`memo_create_memo` 写到 `_sub/<父文档uid>/` 时，服务端识别该前缀，
自动建立 COMMENT 关系并继承父文档的知识库与可见性。**

于是：

- **不加任何 MCP 工具**，现有 `memo_create_memo` / `memo_update_memo` / `memo_get_memo` 原样可用；
- agent 不需要写 relation（它本来也写不了）；
- 寻址方式和其余工具完全一致（三字段），不引入第二套寻址心智。

配套两点：

- **发现路径**：`memo_get_memo(父文档)` 返回的 relations 已经包含 COMMENT 类型
  （[memo_service_converter.go:310](../../../../server/router/api/v1/memo_service_converter.go)），
  子文档就在其中；父文档正文里的引用也指向它们。两条都够用，
  **不需要新增列表接口**。约定写进 [`docs/skill/`](../../../skill/) 即可。
- **RAG 暂不覆盖**，见 §8。skill 文档里必须**明写**这一条，
  否则 agent 会把"搜不到"理解成"不存在"。

被否掉的替代方案：把 `MemoService_CreateMemoComment` 加进 curated 列表。
它多一个 KB 级 schema，而且它按 `memos/{uid}` 寻址、其余 8 个按三字段寻址，
两套并存 agent 容易用错。

---

## 6. memogit：照抄 `_attachments` 的成例

现状有一个硬缺口：`pull` 走
[ListAllMemos](../../../../internal/memogit/pull.go)，而列表接口排除 comment，
**子文档根本不会被检出**。

好在附件已经趟过同一条路——字节下到 `_attachments/<uid>/<文件名>`，
父文件尾部挂一个 `memogit-attachments` 的 HTML 注释清单
（[manifest.go](../../../../internal/memogit/manifest.go)），
由 `StripLocalID` 保证永不回传。子文档照抄这套：

- **本地布局**：`<父文档同级>/<父文档标题>.subdocs/<子文档标题>.md`。
  不直接镜像 `_sub/<uid>`——uid 目录对人和 agent 都不可读，
  而 memogit 本地树的全部价值就是可读。
- **不加 `memogit-subdocs` 清单。** 附件需要清单，是因为它的字节落在
  `_attachments/<uid>/` —— 一个 uid 寻址、离文档很远、猜不出来的位置，
  不写清单就真的没人读（[agent-attachment-reading.md §2](../collaboration/agent-attachment-reading.md)
  记录过这个教训）。子文档不同：它的文件夹就叫 `<父文档标题>.subdocs`、
  就挨着父文档文件，而且父文档正文里的脚注引用已经把它们点了一遍。
  再加一份清单是同一事实的第三份副本。
- **push**：`.subdocs/` 目录下的新文件按 `_sub/<父文档uid>` 创建，
  服务端用 §5 的同一条规则绑父——**两个通道一套语义**。
- **pull**：增量同步按 `updated_ts` 选文档，所以**子文档的写入会顺带
  推进父文档的 `updated_ts`**（见 §6.1）。父文档因此一定会进入本次增量结果，
  它的子文档随之带回。
- **列表带子文档**：`ListMemos` 的 `include_sub_docs` 让每一页顺带返回本页文档的
  子文档（`sub_docs`），过滤条件只选父文档，子文档跟着父文档走。memogit 的
  clone / pull / push / status 都用它，一次列表拿全，不再按父文档逐篇调
  `ListMemoComments`——那样请求数随知识库篇数线性增长，大库明显变慢。
  响应里的 `sub_docs_included` 告诉客户端服务器是否认得这个字段；旧服务器上
  memogit 退回逐篇查询，不会把"没返回子文档"误读成"子文档被删了"。

### 6.1 子文档的写入推进父文档的 updated_ts

这条既是机制也是语义：子文档是主文档的一部分，它变了，主文档**确实**变了，
文件树的新鲜度着色也该这么显示。

它同时是增量镜像正确性的前提：父文档没动、只改了子文档的情况下，
如果父文档的 `updated_ts` 不动，这次改动对之后的每一次同步都是不可见的，
本地副本会永远停在旧内容上且不报任何错。

创建、编辑、删除子文档三条路径都推进；**评论不推进**——
评论是关于文档的讨论，不是它的内容，也没有任何东西把评论镜像成文件。
推进时跳过重新索引（父文档的标题与正文都没变，不该重新嵌入）。

父文档标题变化时，本地 `.subdocs/` 目录跟着重命名；
子文档自身的服务端 folder_path 不变（按 uid 锚定），所以这纯粹是本地呈现问题。

### 6.2 `.subdocs` 是绑定，不是位置（2026-10-06 补）

起因：一次 push 把两篇**已有的**普通文档 `mv` 进 `X.subdocs/`。push 把它当普通
移动，原样把 `Campaigns/X.subdocs` 发给服务器，服务器真建了一个叫这个名字的文件夹；
而这个文件夹拉回本地正好映射到同一个路径，status 一直显示已同步，只有网页上看得出
没挂上。补上的规则：

- **`.subdocs` 结尾的文件夹名保留给系统。** 服务器拒绝在这种路径下新建 / 移入文档、
  新建 / 改名 / 移动文件夹（不分大小写）。已有的这类文件夹可以改名移走。
- **已有文档可以就地挂成子文档。** UpdateMemo 把普通文档的 folder_path 改成
  `_sub/<父uid>` 时，原地补上 COMMENT 关系，可见性跟随父文档；uid、版本历史、
  评论都保留。原来服务端"普通文档转子文档只能新建再删除"的做法作废——同一篇文档
  换个归属，不该换身份。条件：同一知识库、自己没有子文档、不是评论。子文档**移出**仍然拒绝。
- **memogit push 对 `.subdocs/` 里的文件，一律按"绑定到旁边那篇文档"处理：**
  - 父文档按"旁边的文件（含本次 push 新建 / 挪动的）→ 服务器上映射到该位置的文档"
    的顺序找；找不到就跳过并 `!` 提示，**绝不**降级成普通文档；
  - 看服务器上它实际挂在哪：没挂（新挪进来的，或旧版 memogit 推进真文件夹的）就
    就地挂上；已挂但文件名变了就改标题；只是父文档改名带着文件夹走，就不动服务器；
  - 子文档挪出、换父文档、`.subdocs/` 里再套文件夹、放非 `.md` 文件，跳过并 `!`
    说明，不中断整次 push。
- **clone 也要取子文档。** 原来只有 pull 的全量对账会取，新检出要等第一次 pull
  才看得到子文档。

---

## 7. 生命周期：跟着父文档走

**级联关系不能被破坏。** 子文档没有独立生命周期。

| 父文档动作 | 子文档 | 现状 |
|---|---|---|
| 删除 | 一并删除 | ✅ 已实现（[memo_service.go:1000](../../../../server/router/api/v1/memo_service.go) 删评论的同一条路径） |
| 归档 | 一并归档 | ❌ **要补**——`cascadeCommentVisibility` 只级联可见性，不级联 `row_status` |
| 改可见性 | 一并改 | ✅ 已实现（[memo_service.go:818](../../../../server/router/api/v1/memo_service.go)） |
| 移动 / 改名 | 不受影响 | ✅ folder_path 按父 uid 锚定 |

归档的级联要和可见性级联走同一个位置、同一套写法
（`SkipReindex` 的考量同样适用：归档不改变标题与正文）。

### 7.1 P1 引用守卫的两个坑

归档与删除都会先跑
`findExternalLinkReferences`（[memo_service.go:687](../../../../server/router/api/v1/memo_service.go)、
:966），"还有别的文档链过来就拒绝"。子文档会从两个方向踩到它：

1. **删/归档子文档时**——父文档正文里那条引用会把它挡下来。
2. **删/归档父文档时**——如果子文档正文里链回了父文档，同样被挡下。

两种情况都应当**放行**：父与子之间的相互引用是**文档内部的引用**，
不是"别的文档还依赖着我"。实现上把对方的 memo ID 加进该守卫已有的排除集合即可
（它本来就接受一个 `excluded` 参数）。

守卫对**外部**引用的拦截不受影响：别的主线文档链到这篇子文档时照样拒绝——
不过按 §3.3，那种引用本来就不该存在。

### 7.2 agent 不能删，能改

MCP 整体没有删除工具，这是刻意的。子文档同样不给 agent 删除能力——
**能大幅修改就不需要删除**。`state` 归档仍然可用，那是可撤销的。

---

## 8. 暂不做 / 明确不做

- **RAG 不索引子文档**（保持 [rag_service.go](../../../../server/router/api/v1/rag_service.go)
  两处 `ExcludeComments: true` 不动）。理由不是技术，是**定位未知**：
  这个功能要用起来一段时间，才知道子文档到底更像"正文的一部分"（该索引）
  还是"附属噪音"（不该索引）。先不索引是可逆的方向，
  索引了再撤会留下一堆已经被检索出来的东西改变用户预期。
  **上线后观察，到时按真实用法回头改本节。**
- **跨文档共享子文档**——见 §3.3，不做。
- **历史 md 附件迁移**——见 §4.2，不做。
- **子文档再套子文档**——不做。评论关系本来就是一层深
  （`cascadeCommentVisibility` 的注释明确依赖这一点），子文档沿用。
