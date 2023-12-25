一个以隐私为先、轻量级的笔记服务。轻松记录并分享你的伟大想法。

<a href="https://www.usememos.com">主页</a> •
<a href="https://www.usememos.com/blog">博客</a> •
<a href="https://www.usememos.com/docs">文档</a> •
<a href="https://demo.usememos.com/">在线演示</a>

<p>
  <a href="https://github.com/usememos/memos/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/usememos/memos?logo=github" /></a>
  <a href="https://hub.docker.com/r/neosmemo/memos"><img alt="Docker pull" src="https://img.shields.io/docker/pulls/neosmemo/memos.svg"/></a>
  <a href="https://hosted.weblate.org/engage/memos-i18n/"><img src="https://hosted.weblate.org/widget/memos-i18n/english/svg-badge.svg" alt="Translation status" /></a>
  <a href="https://discord.gg/tfPJa4UmAv"><img alt="Discord" src="https://img.shields.io/badge/discord-chat-5865f2?logo=discord&logoColor=f5f5f5" /></a>
</p>

![demo](https://www.usememos.com/demo.webp)

## 要点

- **永远开源免费**。我们提供开源方案，让你的创意无限发挥，今天、明天、永远都免费。
- **仅需数秒钟即可使用 Docker 进行自主托管**。 Docker 提供了灵活、可扩展和易于设置的功能，让你完全掌控你的数据和隐私。
- **支持纯文本和 Markdown 格式**。告别繁琐复杂的格式，拥抱极简主义。
- **轻松定制和分享你的笔记**。通过我们直观的分享功能，您可以轻松地与他人协作和分发您的笔记。
- **支持第三方服务的 RESTful API**。拥抱集成的力量，释放新的可能性，在我们的 RESTful API 支持下。

## 在几秒钟内通过 Docker 进行部署

```bash
docker run -d --name memos -p 5230:5230 -v ~/.memos/:/var/opt/memos ghcr.io/usememos/memos:latest
```

> `~/.memos/` 目录将用作您本地机器上的数据目录，而 `/var/opt/memos` 是 Docker 中的卷目录，不应进行修改。

了解更多[其他安装方法](https://www.usememos.com/docs/install)。

## 贡献

贡献是使开源社区成为一个令人惊奇的学习、启发和创造之地的原因。我们非常感谢您所做出的任何贡献。感谢您成为我们社区的一员！ 🥰

<a href="https://github.com/usememos/memos/graphs/contributors">
  <img src="https://contri-graphy.yourselfhosted.com/graph?repo=usememos/memos&format=svg" />
</a>

---

- [Moe Memos](https://memos.moe/) - iOS 和 Android 的第三方客户端
- [lmm214/memos-bber](https://github.com/lmm214/memos-bber) - Chrome 扩展程序
- [Rabithua/memos_wmp](https://github.com/Rabithua/memos_wmp) - 微信小程序
- [qazxcdswe123/telegramMemoBot](https://github.com/qazxcdswe123/telegramMemoBot) - Telegram 机器人
- [eallion/memos.top](https://github.com/eallion/memos.top) - 使用 Memos API 渲染出的静态页面
- [eindex/logseq-memos-sync](https://github.com/EINDEX/logseq-memos-sync) - Logseq 插件
- [quanru/obsidian-periodic-para](https://github.com/quanru/obsidian-periodic-para#daily-record) - Obsidian 插件
- [JakeLaoyu/memos-import-from-flomo](https://github.com/JakeLaoyu/memos-import-from-flomo) - 导入数据。支持从 flomo、微信读书导入
- [Quick Memo](https://www.icloud.com/shortcuts/1eaef307112843ed9f91d256f5ee7ad9) - 快捷方式（适用于 iOS、iPadOS 或 macOS）
- [Memos Raycast Extension](https://www.raycast.com/JakeYu/memos) - Raycast 扩展程序
- [Memos Desktop](https://github.com/xudaolong/memos-desktop) - MacOS 和 Windows 的第三方客户端
- [MemosGallery](https://github.com/BarryYangi/MemosGallery) - 通过 Memos API 渲染的静态相册

## 星级历史记录

[![Star History Chart](https://api.star-history.com/svg?repos=usememos/memos&type=Date)](https://star-history.com/#usememos/memos&Date)