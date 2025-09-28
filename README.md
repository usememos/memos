# Memos

<img align="right" height="96px" src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/logo-rounded.png" alt="Memos" />

A modern, open-source, self-hosted knowledge management and note-taking platform designed for privacy-conscious users and organizations. Memos provides a lightweight yet powerful solution for capturing, organizing, and sharing thoughts with comprehensive Markdown support and cross-platform accessibility.

<div align="center">

[![Home Page](https://img.shields.io/badge/Home-www.usememos.com-blue)](https://www.usememos.com)
[![Documentation](https://img.shields.io/badge/Docs-Available-green)](https://www.usememos.com/docs)
[![Live Demo](https://img.shields.io/badge/Demo-Try%20Now-orange)](https://demo.usememos.com/)
[![Blog](https://img.shields.io/badge/Blog-Read%20More-lightblue)](https://www.usememos.com/blog)

[![Docker Pulls](https://img.shields.io/docker/pulls/neosmemo/memos.svg)](https://hub.docker.com/r/neosmemo/memos)
[![Docker Image Size](https://img.shields.io/docker/image-size/neosmemo/memos?sort=semver)](https://hub.docker.com/r/neosmemo/memos)
[![Discord](https://img.shields.io/badge/discord-chat-5865f2?logo=discord&logoColor=f5f5f5)](https://discord.gg/tfPJa4UmAv)

</div>

![Memos Application Screenshot](https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/demo.png)

<!-- Premium Sponsors -->
<!--
<div align="center">
  <p><em>Support Memos development and get your brand featured here</em></p>
  <a href="https://sponsor-website.com" target="_blank">
    <img src="https://sponsor-logo-url.com/logo.png" alt="Sponsor Name" height="60" style="margin: 10px;">
  </a>
</div>
-->

## Table of Contents

- [Table of Contents](#table-of-contents)
- [Overview](#overview)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Sponsors](#sponsors)
- [Contributing](#contributing)
- [Star History](#star-history)

## Overview

Memos is a lightweight, self-hosted alternative to cloud-based note-taking services. Built with privacy and performance in mind, it offers a comprehensive platform for personal knowledge management without compromising data ownership or security.

## Key Features

### Privacy & Security

- **Complete Data Ownership** — All data stored locally in your chosen database
- **Self-Hosted Architecture** — Full control over infrastructure and access policies
- **No External Dependencies** — Zero third-party services or cloud connections required

### Content Creation

- **Instant Save** — Streamlined plain text input with automatic persistence
- **Rich Markdown Support** — Full Markdown rendering with syntax highlighting
- **Media Integration** — Native support for images, links, and embedded content

### Performance & Technology

- **High-Performance Backend** — Built with Go for optimal resource utilization
- **Modern React Frontend** — Responsive, intuitive user interface
- **Lightweight Deployment** — Minimal system requirements, maximum efficiency
- **Cross-Platform** — Linux, macOS, Windows, and containerized environments

### Customization

- **Configurable Interface** — Custom branding, themes, and UI elements
- **API-First Design** — RESTful API for seamless third-party integrations
- **Multi-Database Support** — SQLite, PostgreSQL, and MySQL compatibility

### Cost-Effective

- **Open Source (MIT)** — Full source code availability with permissive licensing
- **Zero Subscription Fees** — No usage limits, premium tiers, or hidden costs
- **Community-Driven** — Transparent development with active community support

## Quick Start

Get Memos running in under 1 minutes with Docker:

```bash
docker run -d \
  --name memos \
  --restart unless-stopped \
  -p 5230:5230 \
  -v ~/.memos:/var/opt/memos \
  neosmemo/memos:stable
```

Access Memos at `http://localhost:5230` and complete the initial setup.

**Alternative methods**: For Docker Compose, binary installation, or building from source, see our [Installation Guide](https://www.usememos.com/docs/installation).

**Pro Tip**: The data directory stores all your notes, uploads, and settings. Include it in your backup strategy!

### 🔒 Database Encryption (for SQLite)

For enhanced security, Memos supports transparent, full-database encryption for SQLite using **SQLCipher**. This "Encryption at Rest" feature protects your database file even if your server's file system is compromised.

> [!IMPORTANT]
> This is **not** End-to-End Encryption (E2E). The Memos server holds the key in memory to process data. It protects the database file on the disk, not data from an attacker who has compromised the running application.

Enabling this feature is a two-step process: building a special version of Memos and providing a key at runtime.

#### Using Docker (Recommended)

1.  **Build the SQLCipher-enabled image:**
    ```bash
    docker build \
      --build-arg CGO_ENABLED=1 \
      --build-arg MEMOS_BUILD_TAGS="memos_sqlcipher libsqlite3 sqlite_omit_load_extension" \
      -t memos-sqlcipher \
      -f scripts/Dockerfile .
    ```

2.  **Run the container with the encryption key:**
    Provide your secret key via the `MEMOS_SQLITE_ENCRYPTION_KEY` environment variable.
    ```bash
    docker run -d \
      --name memos \
      -p 5230:5230 \
      -v ~/.memos:/var/opt/memos \
      -e MEMOS_SQLITE_ENCRYPTION_KEY="your-super-secret-key" \
      memos-sqlcipher
    ```

> [!WARNING]
> **Key Management is Your Responsibility.** If you lose your encryption key, your data is **permanently unrecoverable**. Back up your key in a secure location like a password manager.

For detailed instructions, including how to encrypt an existing database, please see our full documentation on **[Database Encryption](https://www.usememos.com/docs/advanced-settings/database-encryption)**.

## Sponsors

Memos is made possible by the generous support of our sponsors. Their contributions help ensure the project's continued development, maintenance, and growth.

<a href="https://github.com/yourselfhosted" target="_blank"><img src="https://avatars.githubusercontent.com/u/140182318?v=4" alt="yourselfhosted" height="60" /></a>
<a href="https://github.com/fixermark" target="_blank"><img src="https://avatars.githubusercontent.com/u/169982?v=4" alt="fixermark" height="60" /></a>
<a href="https://github.com/alik-agaev" target="_blank"><img src="https://avatars.githubusercontent.com/u/2662697?v=4" alt="alik-agaev" height="60" /></a>

<p><strong>Every contribution, no matter the size, makes a difference!</strong></p>

<a href="https://github.com/sponsors/usememos" target="_blank">
  <img src="https://img.shields.io/badge/Sponsor-❤️-red?style=for-the-badge" alt="Sponsor Memos">
</a>

## Contributing

Memos welcomes contributions from developers, designers, and users worldwide. We value quality, innovation, and community feedback.

**Ways to Contribute:**

- Code contributions (bug fixes, features, performance improvements)
- Documentation and user guides
- Testing and bug reporting
- Localization and translation
- Community support

**Get Started**: [Contributing Guide](https://github.com/usememos/memos/blob/main/CONTRIBUTING.md) • [Code of Conduct](https://github.com/usememos/memos/blob/main/CODE_OF_CONDUCT.md)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=usememos/memos&type=Date)](https://star-history.com/#usememos/memos&Date)
