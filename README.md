# Memos

<img align="right" height="96px" src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/logo-rounded.png" alt="Memos" />

An open-source, self-hosted note-taking service. Your thoughts, your data, your control — no tracking, no ads, no subscription fees.

[![Home](https://img.shields.io/badge/🏠-usememos.com-blue?style=flat-square)](https://usememos.com)
[![Live Demo](https://img.shields.io/badge/✨-Try%20Demo-orange?style=flat-square)](https://demo.usememos.com/)
[![Docs](https://img.shields.io/badge/📚-Documentation-green?style=flat-square)](https://usememos.com/docs)
[![Discord](https://img.shields.io/badge/💬-Discord-5865f2?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/tfPJa4UmAv)
[![Docker Pulls](https://img.shields.io/docker/pulls/neosmemo/memos?style=flat-square&logo=docker)](https://hub.docker.com/r/neosmemo/memos)

<img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/demo.png" alt="Memos Demo Screenshot" height="512" />

### 💎 Featured Sponsors

[**Warp** — The AI-powered terminal built for speed and collaboration](https://go.warp.dev/memos)

<a href="https://go.warp.dev/memos" target="_blank" rel="noopener">
  <img src="https://raw.githubusercontent.com/warpdotdev/brand-assets/main/Github/Sponsor/Warp-Github-LG-02.png" alt="Warp - The AI-powered terminal built for speed and collaboration" width="512" />
</a>

<p></p>

[**TestMu AI** - The world’s first full-stack Agentic AI Quality Engineering platform](https://www.testmu.ai/?utm_source=memos&utm_medium=sponsor)
  
<a href="https://www.testmu.ai/?utm_source=memos&utm_medium=sponsor" target="_blank" rel="noopener">
  <img src="https://usememos.com/sponsors/testmu.svg" alt="TestMu AI" height="36" />
</a>

<p></p>

[**SSD Nodes** - Affordable VPS hosting for self-hosters](https://ssdnodes.com/?utm_source=memos&utm_medium=sponsor)
  
<a href="https://ssdnodes.com/?utm_source=memos&utm_medium=sponsor" target="_blank" rel="noopener">
  <img src="https://usememos.com/sponsors/ssd-nodes.svg" alt="SSD Nodes" height="72" />
</a>

## Overview

Memos is a privacy-first, self-hosted knowledge base for personal notes, team wikis, and knowledge management. Built with Go and React, it runs as a single binary with minimal resource usage.

## Features

- **Privacy-First** — Self-hosted on your infrastructure with zero telemetry, no tracking, and no ads.
- **Markdown Native** — Full markdown support with plain text storage. Your data is always portable.
- **Lightweight** — Single Go binary with a React frontend. Low memory footprint, starts in seconds.
- **Easy to Deploy** — One-line Docker install. Supports SQLite, MySQL, and PostgreSQL.
- **Developer-Friendly** — Full REST and gRPC APIs for integration with existing workflows.
- **Clean Interface** — Minimal design with dark mode and mobile-responsive layout.

## Quick Start

### Docker (Recommended)

```bash
docker run -d \
  --name memos \
  -p 5230:5230 \
  -v ~/.memos:/var/opt/memos \
  neosmemo/memos:stable
```

Open `http://localhost:5230` and start writing!

### Try the Live Demo

Don't want to install yet? Try our [live demo](https://demo.usememos.com/) first!

### Other Installation Methods

- **Docker Compose** - Recommended for production deployments
- **Pre-built Binaries** - Available for Linux, macOS, and Windows
- **Kubernetes** - Helm charts and manifests available
- **Build from Source** - For development and customization

See our [installation guide](https://usememos.com/docs/deploy) for detailed instructions.

## Contributing

Contributions are welcome — bug reports, feature suggestions, pull requests, documentation, and translations.

- [Report bugs](https://github.com/usememos/memos/issues/new?template=bug_report.md)
- [Suggest features](https://github.com/usememos/memos/issues/new?template=feature_request.md)
- [Submit pull requests](https://github.com/usememos/memos/pulls)
- [Improve documentation](https://github.com/usememos/memos/tree/main/docs)
- [Help with translations](https://github.com/usememos/memos/tree/main/web/src/locales)

## Sponsors

Love Memos? [Sponsor us on GitHub](https://github.com/sponsors/usememos) to help keep the project growing!

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=usememos/memos&type=Date)](https://star-history.com/#usememos/memos&Date)

## License

Memos is open-source software licensed under the [MIT License](LICENSE).

## Privacy Policy

Memos is built with privacy as a core principle. As a self-hosted application, all your data stays on your infrastructure. There is no telemetry, no tracking, and no data collection. See our [Privacy Policy](https://usememos.com/privacy) for details.

---

**[Website](https://usememos.com)** • **[Documentation](https://usememos.com/docs)** • **[Demo](https://demo.usememos.com/)** • **[Discord](https://discord.gg/tfPJa4UmAv)** • **[X/Twitter](https://x.com/usememos)**

<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>
