> ✨ Featured Sponsor: [CodeRabbit](https://coderabbit.link/usememos) — Cut code review time & bugs in half, instantly.

# Memos

<img align="right" height="96px" src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/logo-rounded.png" alt="Memos" />

Open-source, self-hosted note-taking tool built for quick capture. Markdown-native, lightweight, and fully yours.

[![Home](https://img.shields.io/badge/🏠-usememos.com-blue?style=flat-square)](https://usememos.com)
[![Live Demo](https://img.shields.io/badge/✨-Try%20Demo-orange?style=flat-square)](https://demo.usememos.com/)
[![Docs](https://img.shields.io/badge/📚-Documentation-green?style=flat-square)](https://usememos.com/docs)
[![Discord](https://img.shields.io/badge/💬-Discord-5865f2?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/tfPJa4UmAv)
[![Docker Pulls](https://img.shields.io/docker/pulls/neosmemo/memos?style=flat-square&logo=docker)](https://hub.docker.com/r/neosmemo/memos)

<img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/demo.png" alt="Memos Demo Screenshot" height="512" />

## Features

- **Instant Capture** — Timeline-first UI. Open, write, done — no folders to navigate.
- **Total Data Ownership** — Self-hosted on your infrastructure. Notes stored in Markdown, always portable. Zero telemetry.
- **Radical Simplicity** — Single Go binary, ~20MB Docker image. One command to deploy with SQLite, MySQL, or PostgreSQL.
- **Open & Extensible** — MIT-licensed with full REST and gRPC APIs for integration.

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

### Native Binary

```bash
curl -fsSL https://raw.githubusercontent.com/usememos/memos/main/scripts/install.sh | sh
```

### Try the Live Demo

Don't want to install yet? Try our [live demo](https://demo.usememos.com/) first!

### Other Installation Methods

- **Docker Compose** - Recommended for production deployments
- **Kubernetes** - Helm charts and manifests available
- **Build from Source** - For development and customization

See our [installation guide](https://usememos.com/docs/deploy) for detailed instructions.

## Contributing

Contributions are welcome — bug reports, feature suggestions, pull requests, documentation, and translations.

- [Report bugs](https://github.com/usememos/memos/issues/new?template=bug_report.md)
- [Suggest features](https://github.com/usememos/memos/issues/new?template=feature_request.md)
- [Submit pull requests](https://github.com/usememos/memos/pulls)
- [Improve documentation](https://github.com/usememos/dotcom)
- [Help with translations](https://github.com/usememos/memos/tree/main/web/src/locales)

## Sponsors
* [**CodeRabbit** - Cut code review time & bugs in half, instantly](https://coderabbit.link/usememos)
* [**SSD Nodes** - Affordable VPS hosting for self-hosters](https://ssdnodes.com/?utm_source=memos&utm_medium=sponsor)
* [**InstaPods** - Get your app online in seconds](https://instapods.com/?utm_source=memos&utm_medium=sponsor) • [Deploy Memos in 30 Seconds](https://instapods.com/apps/memos/?utm_source=memos&utm_medium=sponsor)

Love Memos? [Sponsor us on GitHub](https://github.com/sponsors/usememos) to help keep the project growing!

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=usememos/memos&type=Date)](https://star-history.com/#usememos/memos&Date)

## License

Memos is open-source software licensed under the [MIT License](LICENSE). See our [Privacy Policy](https://usememos.com/privacy) for details on data handling.

---

**[Website](https://usememos.com)** • **[Documentation](https://usememos.com/docs)** • **[Demo](https://demo.usememos.com/)** • **[Discord](https://discord.gg/tfPJa4UmAv)** • **[X/Twitter](https://x.com/usememos)**

<a href="https://vercel.com/oss">
  <img alt="Vercel OSS Program" src="https://vercel.com/oss/program-badge.svg" />
</a>
