# memogit.conf.yaml 按文件夹检出 — 技术方案

## 背景

下游仓库用 `memogit.conf.yaml` 列出要拉的知识库，`memogit sync` 把它们 clone 或 pull 到同一个检出根（默认 `kb/`），
每个库占一个子目录：`kb/Career/`、`kb/SideProjects/`。

有的仓库只需要某个库里的一两个目录，比如 `SideProjects` 里只要 `CMOP`。现有的 sparse checkout
（[design/20260903-memogit-sparse-checkout-subdir.md](20260903-memogit-sparse-checkout-subdir.md)）做不到，
`memogit sync` 碰到 conf 里的 `sparse` 会直接报错。原因在于 sparse 把内容放在检出根本身（`Dir = "."`）：

- push 会扫描整个内容目录。sparse 库的内容目录就是检出根，所以会扫到兄弟库的文件。
- 这些文件的 ID 不在它的记录里，会被当成新文档推进 sparse 库，相当于把别的库整个复制一份过去。

另外，现有 sparse 只能映射一个文件夹，而且本地路径要么去掉前缀，要么保留，两种布局并存，不适合放进 conf。

## 目标

```yaml
knowledge_bases:
  - name: SideProjects
    folders:
      - CMOP
      - Infra/Deploy
```

检出后得到 `kb/SideProjects/CMOP/...` 和 `kb/SideProjects/Infra/Deploy/...`，只有这些目录，本地路径和服务器的 `folder_path` 完全一致。

## 一、决策

### 1. 新开一个 `folders` 字段，不复用 `sparse`

`WorkspaceConfig` 新增 `Folders []string`（[config.go](../../../internal/memogit/config.go)）。和 `Sparse` 的区别：

| | `Sparse`（老） | `Folders`（新） |
|---|---|---|
| 内容目录 | 检出根本身（`Dir = "."`） | 库自己的子目录（`Dir = 库名`），和全量检出一样 |
| 文件夹数量 | 一个 | 一个或多个 |
| 本地路径 | 默认去掉前缀，`--sparse-subdir` 时保留 | 永远和服务器 `folder_path` 一致 |
| 能否和别的库共用检出根 | 不能 | 能 |
| 入口 | `memogit clone --sparse-checkout --dir` | `memogit.conf.yaml` |

`Dir` 不变，所以 state 文件名、`memogit remove`、agent 简报入口点这些按 `Dir` 工作的逻辑全都不用改。
路径不加前缀也不去前缀，`LocalRelPath` 和 `ServerFolderPath` 也都不用改。

conf 里的 `sparse` 仍然报错，错误信息改成指向 `folders`。

### 2. 范围判断只改 `inScope` 一处

`inScope`（[naming.go](../../../internal/memogit/naming.go)）在设了 `Folders` 时，只要服务器 `folder_path` 等于其中某一个、
或在其中某一个下面，就算在范围内。clone、pull 的增量和全量对账、push 的 `liveMemos`、status 都通过 `inScopeMemos` 过滤，
所以改这一处就全部生效。`inScopeMemos` 原来写的是 `ws.Sparse != "" && !ws.inScope(...)`，改成只看 `inScope`。

服务器的 CEL 过滤器没有 `folder_path` 字段，过滤只能在客户端做，每次对账仍然会列出整库文档。这个限制和老 sparse 一样。

### 3. 文件夹名只做规整，不做文件名清洗

`NormalizeFolders` 做的事：去掉两端斜杠和空白；去重；如果某个文件夹已经被列表里的另一个覆盖（比如 `CMOP` 和 `CMOP/Notes`），就去掉被覆盖的那个；最后排序。

不走 `sanitizeFolderPath`。那个函数是给落盘文件名用的，会改写特殊字符，改写后就可能和服务器上的名字对不上。

以下写法直接报错，不悄悄跳过：空名、`.` 或 `..` 段、以 `.` 开头的隐藏段（本来就不会被检出）、子文档保留目录 `_sub`。
子文档的服务器路径是 `_sub/<父 uid>`，不在任何文件夹前缀下。它跟着父文档走（`listInScope`），不用单独列。

文件夹名区分大小写，和服务器上的 `folder_path` 逐字比较。clone 时如果某个文件夹一篇文档都没匹配到，打印一行 `!` 警告，防止名字写错还不知道。

### 4. conf 是唯一的权威，每次 sync 都覆盖

`SyncRepo` 对已检出的库，先用 conf 里的 `folders` 覆盖 `config.yaml` 里记录的范围（`applyFolders`，[reposync.go](../../../internal/memogit/reposync.go)），
有变化就打印一行并保存，然后再 pull。

改范围不需要重新 clone。pull 每次都会拿全量列表对账（`reconcileFullListing`），所以：

- **加文件夹**：服务器上有、本地没记录的文档会被补拉下来。
- **减文件夹**：超出范围的文档在本地删除，有未推送修改的文件保留并给出提示。
- **整个去掉 `folders`**：变回全量检出。

用老 sparse 检出的库（`ws.Sparse != ""`）不受 conf 管理，`applyFolders` 跳过它们。

### 5. push 拒绝在范围外新建或移动文档

这是顺手修掉的一个已有 bug。push 原来完全不检查范围：

- 在 `kb/SideProjects/Other/x.md` 新建文件，push 会在服务器的 `Other/` 下建出文档。
- 下次 pull 对账时，这篇文档不在范围内，本地文件就被删掉了。对用户来说就是"文件推上去之后消失了"。

老的 `--sparse-subdir` 模式现在也有这个问题。

修法是 `outOfScope`：先按 push 本来的推导算出文件要落到的服务器文件夹（`deriveMemoFromPath` 加上 `ServerFolderPath`），
不在范围内就打一行 `!` 跳过，说明原因：

- **新建**：提示把文件放进范围内的目录，或者把文件夹加进 conf。
- **移动**：提示把文件移回原路径，或者去网页上移动。移出范围在服务器上是一次合法的移动，但本地马上就会看不到这篇文档，所以交给能看清结果的网页去做。被跳过的移动仍然占着这篇文档的身份，不会被当成删除而归档。

全量检出和去前缀的老 sparse 模式在逻辑上不可能越出范围，行为不变。

### 6. pull 的删除提示要区分原因

带范围的检出里，文档从列表里消失，可能只是被移出了范围，或者范围变窄了，文档本身还在服务器上。
这时如果提示"服务器上已删除"，会让人去找一次根本没发生的删除。
所以有范围时，提示改成"已删除/归档，或者已不在本检出的文件夹范围内"（`goneReason`）。

### 7. 让 agent 知道只检出了一部分

SessionStart 的知识库清单里，带 `folders` 的库会加一句"只检出了 CMOP、Infra/Deploy，其余目录不在本地"。
`memogit workspaces` 也会显示范围。agent 需要知道这一点，有两个原因：

- 链接到其他目录的文档，在本地是死链。
- 新文档只能建在这些目录里。

## 二、被否决的选项

**让 conf 的 `sparse` 生效，改成落在库自己的子目录。** 这样一来，`sparse` 在 conf 里和在 `clone --sparse-checkout` 里就是两种布局，
同一个字段名两种语义；而且它只能写一个文件夹。不如新开一个字段，语义一目了然。

**服务端给 CEL 加 `folder_path` 过滤。** 能省流量，但要改服务端 filter schema，属于另一个子域，
而且省掉的只是元数据列表，不影响正确性。以后真成了瓶颈再单独做。

**范围变化时要求重新 clone。** 没有必要：全量对账本来就能处理加减。重新 clone 反而会丢掉本地 git 历史，还会碰掉没推送的修改。

## 三、验收判据

单元测试在 [folders_test.go](../../../internal/memogit/folders_test.go)。其中起了一个假的 Connect 服务端，覆盖到 clone、pull、push 的真实调用链：

- `TestNormalizeFolders`：规整、去重、去覆盖，以及非法写法报错。
- `TestFoldersScopeAndPaths`：`inScope`、`outOfScope`、路径恒等映射。老 sparse 去前缀模式不受影响，`--sparse-subdir` 模式一起被修好。
- `TestSyncRepoFoldersScope`：首次 sync 只检出列出的目录，并且放在 `kb/SideProjects/` 下。之后换文件夹、去掉 `folders`，本地文件都跟着变。
- `TestPushRefusesFilesOutsideFolders`：范围外的新建、移动，以及放在库根的文件都被跳过，范围内的新建照常执行，被跳过的移动不会被归档。
- `TestCloneWarnsAboutFoldersMatchingNothing`、`TestSyncRepoRejectsSparsePointingAtFolders`。

上线后还要手工验证一次：在真实服务器上用 `folders` 跑完整的 sync → 改文件 → push → pull 循环。
