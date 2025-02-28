# Memos - Open Source, Self-hosted, Your Notes, Your Way

<img align="right" height="96px" src="https://www.usememos.com/logo-rounded.png" alt="Memos" />

An open-source, self-hosted note-taking solution designed for seamless deployment and multi-platform access. Experience effortless plain text writing with pain-free, complemented by robust Markdown syntax support for enhanced formatting.

<a href="https://www.usememos.com">Home Page</a> •
<a href="https://www.usememos.com/blog">Blogs</a> •
<a href="https://www.usememos.com/docs">Docs</a> •
<a href="https://demo.usememos.com/">Live Demo</a>

<p>
  <a href="https://hub.docker.com/r/neosmemo/memos"><img alt="Docker pull" src="https://img.shields.io/docker/pulls/neosmemo/memos.svg"/></a>
  <a href="https://hub.docker.com/r/neosmemo/memos"><img alt="Docker image size" src="https://img.shields.io/docker/image-size/neosmemo/memos?sort=semver"/></a>
  <a href="https://discord.gg/tfPJa4UmAv"><img alt="Discord" src="https://img.shields.io/badge/discord-chat-5865f2?logo=discord&logoColor=f5f5f5" /></a>
</p>

![demo](https://www.usememos.com/demo.png)

## Features

- **Privacy First** 🏡: Your data, your control. All runtime data is securely stored in your local database.
- **Create at Speed** ✍️: Write and save content as plain text for quick access, with Markdown support for fast formatting and easy sharing.
- **Lightweight but Powerful** ⚡: Built with Go and React.js, our app combines a compact architecture with powerful performance.
- **Customizable** 🧩: Personalize your experience by customizing the server name, icon, description, theme, and execution scripts.
- **Open Source** 🦦: Fully open source, with all code available on GitHub for transparency and collaboration.
- **Free to Use** 💸: Enjoy all features at no cost, no hidden fees, no subscriptions.

## Deploy with Docker in seconds

```bash
docker run -d --name memos -p 5230:5230 -v ~/.memos/:/var/opt/memos neosmemo/memos:stable
```

> [!NOTE]
> This command is only applicable for Unix/Linux systems. For Windows, please refer to the detailed [documentation](https://www.usememos.com/docs/install/container-install#docker-on-windows).
>
> The `~/.memos/` directory will be used as the data directory on your local machine, while `/var/opt/memos` is the directory of the volume in Docker and should not be modified.

Learn more about [other installation methods](https://www.usememos.com/docs/install).

> [!WARNING]
> Memos is still under active development, so you may encounter bugs or breaking changes as we improve.

## Contribution

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. We greatly appreciate any contributions you make. Thank you for being a part of our community! 🥰

Guide to [contribution](https://www.usememos.com/docs/contribute).

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=usememos/memos&type=Date)](https://star-history.com/#usememos/memos&Date)

## Other Projects

- [**Slash**](https://github.com/yourselfhosted/slash): An open source, self-hosted bookmarks and link sharing platform. Save and share your links very easily.
- [**Gomark**](https://github.com/usememos/gomark): A markdown parser written in Go for Memos. And its [WebAssembly version](https://github.com/usememos/gomark-wasm) is also available.
