# Memos

<img align="right" height="96px" src="https://www.usememos.com/logo-rounded.png" alt="Memos" />

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

![Memos Application Screenshot](https://www.usememos.com/demo.png)

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Quick Start](#quick-start)
- [Installation Methods](#installation-methods)
- [Development Setup](#development-setup)
- [Contributing](#contributing)
- [License](#license)

## Overview

Memos is a lightweight, self-hosted alternative to cloud-based note-taking services. Built with privacy and performance in mind, it offers a comprehensive platform for personal knowledge management without compromising data ownership or security.

## Key Features

### Data Privacy and Security

- **Complete Data Ownership**: All application data is stored locally in your chosen database
- **Self-Hosted Architecture**: Full control over your data infrastructure and access policies
- **No External Dependencies**: Runtime operations require no third-party services or cloud connections

### Content Creation and Management

- **Plain Text Efficiency**: Streamlined text input with immediate save functionality
- **Advanced Markdown Support**: Comprehensive Markdown rendering with syntax highlighting
- **Rich Media Integration**: Support for images, links, and embedded content

### Technical Excellence

- **High-Performance Backend**: Built with Go for optimal resource utilization and scalability
- **Modern Frontend**: React.js-based user interface with responsive design
- **Lightweight Deployment**: Minimal system requirements with efficient resource consumption
- **Cross-Platform Compatibility**: Supports Linux, macOS, Windows, and containerized environments

### Customization and Extensibility

- **Configurable Interface**: Customizable server branding, themes, and user interface elements
- **API-First Design**: RESTful API with comprehensive documentation for third-party integrations
- **Multi-Database Support**: Compatible with SQLite, PostgreSQL, and MySQL databases

### Cost-Effective Solution

- **Open Source License**: MIT licensed with full source code availability
- **Zero Licensing Costs**: No subscription fees, usage limits, or premium tiers
- **Community-Driven Development**: Active community contribution and transparent development process

## Quick Start

### Prerequisites

- Docker or Docker Compose installed on your system
- Minimum 512MB RAM and 1GB available disk space

### Docker Deployment

Deploy Memos in production mode using Docker:

```bash
# Create data directory
mkdir -p ~/.memos

# Run Memos container
docker run -d \
  --name memos \
  --restart unless-stopped \
  -p 5230:5230 \
  -v ~/.memos:/var/opt/memos \
  neosmemo/memos:stable
```

Access the application at `http://localhost:5230` and complete the initial setup process.

### Docker Compose Deployment

For advanced configurations, use Docker Compose:

```yaml
# docker-compose.yml
version: "3.8"
services:
  memos:
    image: neosmemo/memos:stable
    container_name: memos
    restart: unless-stopped
    ports:
      - "5230:5230"
    volumes:
      - ./data:/var/opt/memos
    environment:
      - MEMOS_MODE=prod
      - MEMOS_PORT=5230
```

Deploy with:

```bash
docker-compose up -d
```

> **Note**: The data directory (`~/.memos/` or `./data/`) stores all application data including the database, uploaded files, and configuration. Ensure this directory is included in your backup strategy.
>
> **Platform Compatibility**: The above commands are optimized for Unix-like systems (Linux, macOS). For Windows deployments, please refer to the [Windows-specific documentation](https://www.usememos.com/docs/install/container-install#docker-on-windows).

## Installation Methods

Memos supports multiple installation approaches to accommodate different deployment scenarios:

### Container Deployment

- **Docker Hub**: Official images available at `neosmemo/memos`
- **GitHub Container Registry**: Alternative registry with the same image versions
- **Kubernetes**: Helm charts and YAML manifests for cluster deployments

### Binary Installation

- **Pre-compiled Binaries**: Available for Linux, macOS, and Windows on the releases page

### Source Installation

- **Go Build**: Compile from source using Go 1.24 or later
- **Development Mode**: Local development setup with hot reloading

For detailed installation instructions, refer to the [comprehensive installation guide](https://www.usememos.com/docs/install).

## Development Setup

### Prerequisites

- Go 1.24 or later
- Node.js 22+ and pnpm
- Git for version control

### Backend Development

```bash
# Clone the repository
git clone https://github.com/usememos/memos.git
cd memos

# Install Go dependencies
go mod download

# Run the backend server
go run ./bin/memos/main.go --mode dev --port 8081
```

### Frontend Development

```bash
# Navigate to web directory
cd web

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The development servers will be available at:

- Backend API: `http://localhost:8081`
- Frontend: `http://localhost:3001`

## Contributing

Memos is an open-source project that welcomes contributions from developers, designers, and users worldwide. We maintain a collaborative and inclusive development environment that values quality, innovation, and community feedback.

### Ways to Contribute

- **Code Contributions**: Bug fixes, feature implementations, and performance improvements
- **Documentation**: API documentation, user guides, and technical specifications
- **Testing**: Quality assurance, test case development, and bug reporting
- **Localization**: Translation support for multiple languages and regions
- **Community Support**: Helping users on Discord, GitHub discussions, and forums

## License

Memos is released under the MIT License, providing maximum flexibility for both personal and commercial use. This license allows for:

- **Commercial Use**: Deploy Memos in commercial environments without licensing fees
- **Modification**: Adapt and customize the codebase for specific requirements
- **Distribution**: Share modified versions while maintaining license attribution
- **Private Use**: Use Memos internally without disclosure requirements

See the [LICENSE](./LICENSE) file for complete licensing terms.

## Project Status

> **Development Status**: Memos is actively maintained and under continuous development. While the core functionality is stable and production-ready, users should expect regular updates, feature additions, and potential breaking changes as the project evolves.
>
> **Version Compatibility**: We maintain backward compatibility for data storage and API interfaces where possible. Migration guides are provided for major version transitions.

## Support and Community

- **Documentation**: [Official Documentation](https://www.usememos.com/docs)
- **Community Chat**: [Discord Server](https://discord.gg/tfPJa4UmAv)
- **Issue Tracking**: [GitHub Issues](https://github.com/usememos/memos/issues)
- **Discussions**: [GitHub Discussions](https://github.com/usememos/memos/discussions)

[![Star History Chart](https://api.star-history.com/svg?repos=usememos/memos&type=Date)](https://star-history.com/#usememos/memos&Date)
