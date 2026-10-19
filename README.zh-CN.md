> ✨ Featured sponsor: [CodeRabbit — 业界领先的 AI 代码审查](https://coderabbit.link/usememos)。

<h1 id="memos">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/brand/lockup-on-dark.svg" />
    <img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/brand/lockup.svg" alt="Memos" width="220" />
  </picture>
</h1>

<p>
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md"><strong>简体中文</strong></a>
</p>

### 随手就记，归你所有。

Memos 是一个安放每一个一闪而过的念头的地方。不用先想标题、不用选文件夹、不用决定放在哪：直接输入，这个念头就会留在你写下它的那一天。你的 memos 留在你决定的地方，只属于你，直到你选择把其中一条分享给家人和朋友。

[演示](https://demo.usememos.com) · [安装](#快速开始) · [文档](https://usememos.com/docs) · [Discord](https://discord.gg/tfPJa4UmAv)

[![Docker pulls](https://img.shields.io/docker/pulls/neosmemo/memos?style=flat-square&logo=docker)](https://hub.docker.com/r/neosmemo/memos)
[![Latest release](https://img.shields.io/github/v/release/usememos/memos?style=flat-square&label=Release)](https://github.com/usememos/memos/releases)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/previews/timeline-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/previews/timeline-light.png" />
  <img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/previews/timeline-light.png" alt="Memos 时间线：撰写器和最近 memos 的截图" />
</picture>

## 你会得到什么

- **一个安放每个一闪念头的地方。** Memos 不会先问你任何问题：不用想标题、不用选文件夹、不用决定放在哪。直接输入，念头在离开脑海之前就已经被留下。
- **一个可以回去的日子。** 每条 memo 都保留着写下它的那一天，任何一天都能被找回：滚动、日历、标签，或者搜索一个词。
- **一份属于你的记录。** 你的 memos 留在你决定的地方，不对任何人汇报，也可以随时以纯 Markdown 带走。
- **家人和朋友，由你选择。** 在你分享之前，一条 memo 只属于你。每个人写自己的 memos，只看你选择展示的内容。

## 快速开始

装好 Docker 后运行：

```bash
docker run -d \
  --name memos \
  -p 5230:5230 \
  -v ~/.memos:/var/opt/memos \
  neosmemo/memos:stable
```

打开 http://localhost:5230，创建第一个账户。Memos 保存的所有内容都在 `~/.memos` 里，备份这一个文件夹就够了。

其他运行方式（包括 Docker Compose、Kubernetes 和独立二进制文件）见[部署指南](https://usememos.com/docs/deploy)。

## 升级

发布版本使用 `YY.MM.N` 标签，候选版本为 `YY.MM.N-rc.K`，且不带 `v` 前缀。Docker 标签 `stable` 跟随稳定版，月份标签（如 `26.10`）跟随该月最新的稳定版，`canary` 跟随开发构建。如果从 v0.31.0 之前的版本升级，需要先运行一次 [v0.31.0](https://github.com/usememos/memos/releases/tag/v0.31.0)；另见[升级要求](store/migration/README.md)。

## Memos 周边

- [Web Clipper](https://usememos.com/web-clipper)（[Chrome](https://chromewebstore.google.com/detail/memos-web-clipper/nebaoebnljalfegiidibihhkebeiklbl) 和 [Firefox](https://addons.mozilla.org/en-US/firefox/addon/memos-web-clipper/) 扩展）可以把网页、选中的内容和图片存进你的 memos，保存为带来源链接的 Markdown。
- [Memogram](https://github.com/usememos/telegram-integration) 是一个 Telegram 机器人，把你的消息和图片存进 Memos。
- [API](https://usememos.com/docs/api/latest) 和 [MCP 服务器](https://usememos.com/docs/integrations/mcp) 把 Memos 连接到你的脚本和 AI 工具。

## 赞助者

<p>
  <a href="https://coderabbit.link/usememos" target="_blank" rel="noopener"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/coderabbit/white-typemark.svg" /><img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/coderabbit/orange-typemark.svg" alt="CodeRabbit" height="40" align="middle" /></picture></a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://www.testmuai.com/?utm_medium=sponsor&utm_source=memos" target="_blank" rel="noopener"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/testmuai/white.png" /><img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/testmuai/black.png" alt="TestMu AI" height="30" align="middle" /></picture></a>
</p>

通过 [GitHub Sponsors](https://github.com/sponsors/usememos) 赞助 Memos。

## 帮助与贡献

有问题，去[文档](https://usememos.com/docs)、[Discord](https://discord.gg/tfPJa4UmAv) 或 [GitHub Discussions](https://github.com/usememos/memos/discussions)；有 bug 或想法，去 [issue](https://github.com/usememos/memos/issues/new/choose)；代码改动从[贡献指南](https://usememos.com/docs/development/contributing)开始。

## Star History

<p>
  <a href="https://www.star-history.com/usememos/memos"><picture><source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=usememos/memos&type=rank&theme=dark" /><source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=usememos/memos&type=rank" /><img alt="Star History Rank" src="https://api.star-history.com/badge?repo=usememos/memos&type=rank" /></picture></a>
  <a href="https://www.star-history.com/usememos/memos"><picture><source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=usememos/memos&type=trending&theme=dark" /><source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=usememos/memos&type=trending" /><img alt="GitHub Trending Repository of the Day" src="https://api.star-history.com/badge?repo=usememos/memos&type=trending" /></picture></a>
</p>

## 许可证

Memos 是开源项目，采用 [MIT 许可证](LICENSE)。
