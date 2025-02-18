# Memos - Open Source, Self-hosted, Your Notes, Your Way

<img align="right" height="96px" src="https://www.usememos.com/logo-rounded.png" alt="Memos" />

An open-source, self-hosted note-taking solution designed for seamless deployment and multi-platform access. Experience effortless plain text writing with pain-free, complemented by robust Markdown syntax support for enhanced formatting.

<a href="https://www.usememos.com">Home Page</a> •
<a href="https://www.usememos.com/blog">Blogs</a> •
<a href="https://www.usememos.com/docs">Docs</a> •
<a href="https://demo.usememos.com/">Live Demo</a>

<p>
  <a href="https://hub.docker.com/r/neosmemo/memos"><img alt="Docker pull" src="https://img.shields.io/docker/pulls/neosmemo/memos.svg"/></a>
  <a href="https://discord.gg/tfPJa4UmAv"><img alt="Discord" src="https://img.shields.io/badge/discord-chat-5865f2?logo=discord&logoColor=f5f5f5" /></a>
</p>

![demo](https://www.usememos.com/demo.png)

## 📌 Table of Contents  

- [Releases](#releases)  
- [Main Features](#main-features)  
- [Deploy with Docker](#deploy-with-docker)  
- [Contribution](#contribution)  
- [Star History](#star-history)  
- [Other Projects](#other-projects)  

## Releases
### **v0.24.0**
- **Shortcuts for Filters**: Easily filter memos by tags, visibility, and timestamps.
- **Database/API Changes**: Back up data before upgrading.
- **Fixes**: Migration file issues, pin/unpin errors, calendar coloring.
- **New**: Farsi (Persian) localization, multi-word search.

### **v0.23.1**
- **Persistent Filters**: Save filters in URLs.
- **Localization**: Added French, German, Czech translations.
- **Fixes**: ARM build panics, S3 URL styles, checkbox behavior.
- **New**: Pull-to-refresh, improved hyperlink handling.

### **v0.23.0**
- **Global Default Visibility**: Set default memo visibility.
- **Disable Markdown Shortcuts**: Optional toggle.
- **Localization**: Added Georgian, Bahasa Indonesia, Portuguese (Portugal).
- **Fixes**: Calendar logic, RSS titles, dynamic theme application.
- **New**: Tag count in tree view, single-letter user IDs.

## Main Features

- **Privacy First** 🏠: Take control of your data. All runtime data is securely stored in your local database.
- **Create at Speed** ✍️: Save content as plain text for quick access, with Markdown support for fast formatting and easy sharing.
- **Lightweight but Powerful** 🤲: Built with Go, React.js, and a compact architecture, our application delivers powerful performance in a lightweight package.
- **Customizable** 🧩: Easily customize your server name, icon, description, system style, and execution scripts to make it uniquely yours.
- **Open Source** 🦦: Memos embraces the future of open source, with all code available on GitHub for transparency and collaboration.
- **Free to Use** 💸: Enjoy all features completely free, with no charges ever for any content.

## Deploy with Docker in seconds 🚀  

Run the following command to quickly deploy Memos using Docker:  

```bash
docker run -d --name memos -p 5230:5230 -v ~/.memos/:/var/opt/memos neosmemo/memos:stable
```

### What This Command Does:
- `-d` → Runs the container in detached mode (in the background).  
- `--name memos` → Names the container `memos`.  
- `-p 5230:5230` → Maps **port 5230** on your machine to **port 5230** in the container.  
- `-v ~/.memos/:/var/opt/memos` →  
  - `~/.memos/` is the **local directory** where your data will be stored.  
  - `/var/opt/memos` is the **Docker container’s storage path** (do not modify this).  


> [!NOTE]
> This command is only applicable for Unix/Linux systems. For Windows, please refer to the detailed [documentation](https://www.usememos.com/docs/install/container-install#docker-on-windows).
>
> The `~/.memos/` directory will be used as the data directory on your local machine, while `/var/opt/memos` is the directory of the volume in Docker and should not be modified.

Learn more about [other installation methods](https://www.usememos.com/docs/install).

## Contribution

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. We greatly appreciate any contributions you make. Thank you for being a part of our community! 🥰

Here's how to get started:
1. Fork the repository.
2. Set up your development environment.
3. Create a new branch and make your changes.
4. Submit a pull request with a detailed description of your changes.

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=usememos/memos&type=Date)](https://star-history.com/#usememos/memos&Date)

## Other Projects

- [**Slash**](https://github.com/yourselfhosted/slash): An open source, self-hosted bookmarks and link sharing platform. Save and share your links very easily.
- [**Gomark**](https://github.com/usememos/gomark): A markdown parser written in Go for Memos. And its [WebAssembly version](https://github.com/usememos/gomark-wasm) is also available.
