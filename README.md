<div align="center">
  <p><b>Featured Sponsors</b></p>
  <table>
    <tr>
      <td align="center" width="50%">
        <a href="https://go.warp.dev/memos" target="_blank" rel="noopener">
          <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/warpdotdev/brand-assets/refs/heads/main/Logos/Warp-Wordmark-White.png" />
            <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/warpdotdev/brand-assets/refs/heads/main/Logos/Warp-Wordmark-Black.png" />
            <img alt="Warp" height="44" src="https://raw.githubusercontent.com/warpdotdev/brand-assets/refs/heads/main/Logos/Warp-Wordmark-Black.png" />
          </picture>
          <br/>
          <span>Warp is an agentic development environment.</span>
        </a>
      </td>
      <td align="center" width="50%">
        <a href="https://coderabbit.link/usememos" target="_blank" rel="noopener">
          <picture>
            <source media="(prefers-color-scheme: dark)" srcset="https://victorious-bubble-f69a016683.media.strapiapp.com/White_Typemark_79b9189d19.svg" />
            <source media="(prefers-color-scheme: light)" srcset="https://victorious-bubble-f69a016683.media.strapiapp.com/Orange_Typemark_43bf516c9d.svg" />
            <img alt="CodeRabbit" height="44" src="https://victorious-bubble-f69a016683.media.strapiapp.com/Orange_Typemark_43bf516c9d.svg" />
          </picture>
          <br/>
          <span>Cut code review time &amp; bugs in half, instantly.</span>
        </a>
      </td>
    </tr>
  </table>
</div>

# Memos

<img align="right" height="96px" src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/logo-rounded.png" alt="Memos" />

Open-source, self-hosted note-taking tool built for quick capture. Markdown-native, lightweight, and fully yours.

[![Home](https://img.shields.io/badge/🏠-usememos.com-blue?style=flat-square)](https://usememos.com)
[![Live Demo](https://img.shields.io/badge/✨-Try%20Demo-orange?style=flat-square)](https://demo.usememos.com/)
[![Docs](https://img.shields.io/badge/📚-Documentation-green?style=flat-square)](https://usememos.com/docs)
[![Discord](https://img.shields.io/badge/💬-Discord-5865f2?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/tfPJa4UmAv)
[![Docker Pulls](https://img.shields.io/docker/pulls/neosmemo/memos?style=flat-square&logo=docker)](https://hub.docker.com/r/neosmemo/memos)

<img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/demo.png" alt="Memos Demo Screenshot" height="512" />

### Sponsors

[**TestMu AI** - The world’s first full-stack Agentic AI Quality Engineering platform](https://www.testmuai.com/?utm_medium=sponsor&utm_source=memos)

<a href="https://www.testmuai.com/?utm_medium=sponsor&utm_source=memos" target="_blank" rel="noopener">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://usememos.com/sponsors/testmu-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://usememos.com/sponsors/testmu.svg" />
    <img src="https://usememos.com/sponsors/testmu.svg" alt="TestMu AI" height="36" />
  </picture>
</a>

<p></p>

[**SSD Nodes** - Affordable VPS hosting for self-hosters](https://ssdnodes.com/?utm_source=memos&utm_medium=sponsor)

<a href="https://ssdnodes.com/?utm_source=memos&utm_medium=sponsor" target="_blank" rel="noopener">
  <img src="https://usememos.com/sponsors/ssd-nodes.svg" alt="SSD Nodes" height="72" />
</a>

<p></p>

[**InstaPods** - Get your app online in seconds](https://instapods.com/?utm_source=memos&utm_medium=sponsor) • [Deploy Memos in 30 Seconds](https://instapods.com/apps/memos/?utm_source=memos&utm_medium=sponsor)

<a href="https://instapods.com/?utm_source=memos&utm_medium=sponsor" target="_blank" rel="noopener">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/usememos/dotcom/main/public/sponsors/instapods-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/usememos/dotcom/main/public/sponsors/instapods.svg" />
    <img src="https://raw.githubusercontent.com/usememos/dotcom/main/public/sponsors/instapods.svg" alt="InstaPods" height="72" />
  </picture>
</a>

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
- **Pre-built Binaries** - Available for Linux, macOS, and Windows
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
