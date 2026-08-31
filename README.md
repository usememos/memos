> **Featured sponsor:** [CodeRabbit](https://coderabbit.link/usememos) — Cut code review time and bugs in half, instantly.

# Memos

<img src="./web/public/logo.webp" alt="" width="96" align="right">

**Fast enough for every thought. Private enough for all of them.**

Memos is an open-source, self-hosted home for short-form thinking. Daily notes, links, work logs, and snippets flow into a chronological Markdown timeline—on infrastructure you control, without the overhead of an all-in-one workspace.

**[Run with Docker](#quick-start)** · **[Try the live demo](https://demo.usememos.com/)** · [Read the docs](https://usememos.com/docs)

[![GitHub stars](https://img.shields.io/github/stars/usememos/memos?style=flat-square&logo=github&label=Stars)](https://github.com/usememos/memos)
[![Latest release](https://img.shields.io/github/v/release/usememos/memos?style=flat-square&label=Release)](https://github.com/usememos/memos/releases)
[![Docker pulls](https://img.shields.io/docker/pulls/neosmemo/memos?style=flat-square&logo=docker)](https://hub.docker.com/r/neosmemo/memos)
[![MIT license](https://img.shields.io/github/license/usememos/memos?style=flat-square)](LICENSE)

<img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/demo.png" alt="Memos Demo Screenshot" height="512" />

## Why Memos?

- **Capture quickly** — Write in Markdown, attach media, and save without choosing a title, folder, or template.
- **Organize lightly** — Revisit notes through the timeline, search, tags, and pins.
- **Share selectively** — Keep memos private or publish only what you choose.
- **Keep control** — Self-host Memos with [zero telemetry](https://usememos.com/features/data-ownership) and [MIT-licensed source](LICENSE).

[Explore all features →](https://usememos.com/features)

## Quick Start

Start a private Memos instance with one Docker command:

```bash
docker run -d \
  --name memos \
  --restart unless-stopped \
  -p 127.0.0.1:5230:5230 \
  -v ~/.memos:/var/opt/memos \
  neosmemo/memos:stable
```

Open [http://localhost:5230](http://localhost:5230) and start writing. See the [deployment guide](https://usememos.com/docs/deploy) for other installation options.

## Extend Memos

- **[Web Clipper](https://usememos.com/web-clipper)** — Save pages, selections, and images as source-linked Markdown. Available for [Chrome](https://chromewebstore.google.com/detail/memos-web-clipper/nebaoebnljalfegiidibihhkebeiklbl) and [Firefox](https://addons.mozilla.org/en-US/firefox/addon/memos-web-clipper/).
- **[API and webhooks](https://usememos.com/docs/api)** — Connect scripts, bots, and custom capture flows through REST, gRPC, and [webhooks](https://usememos.com/docs/integrations/webhooks).

## Get Help

Read the [documentation](https://usememos.com/docs), join [Discord](https://discord.gg/tfPJa4UmAv), or ask in [GitHub Discussions](https://github.com/usememos/memos/discussions). You can also [report a bug](https://github.com/usememos/memos/issues/new?template=bug_report.yml) or [suggest a feature](https://github.com/usememos/memos/issues/new?template=feature_request.yml).

Want to contribute? See the [contributing guide](https://usememos.com/docs/development/contributing).

## Sponsors

- [**CodeRabbit** — Cut code review time and bugs in half](https://coderabbit.link/usememos)
- [**SSD Nodes** — Affordable VPS hosting for self-hosters](https://ssdnodes.com/?utm_source=memos&utm_medium=sponsor)
- [**TestMu AI** — The world’s first full-stack Agentic AI Quality Engineering platform](https://www.testmuai.com/?utm_medium=sponsor&utm_source=memos)

Love Memos? [Sponsor the project on GitHub](https://github.com/sponsors/usememos).

## License

Memos is licensed under the [MIT License](LICENSE).
