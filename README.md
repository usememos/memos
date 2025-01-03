# Memos Dark - Open Source, Self-hosted, Your Notes, Your Way

<img align="right" height="96px" src="https://memos.654.ee/file/users/101/avatar" alt="Memos" />

*只保留深色模式的memos*    
*Keep only the dark mode memos*    

An open-source, self-hosted note-taking solution designed for seamless deployment and multi-platform access. Experience effortless plain text writing with pain-free, complemented by robust Markdown syntax support for enhanced formatting.

<a href="https://www.usememos.com">Home Page</a> •
<a href="https://www.usememos.com/blog">Blogs</a> •
<a href="https://www.usememos.com/docs">Docs</a> •
<a href="https://memos.654.ee/">Live Demo</a>

<!-- <p>
  <a href="https://hub.docker.com/r/neosmemo/memos"><img alt="Docker pull" src="https://img.shields.io/docker/pulls/neosmemo/memos.svg"/></a>
  <a href="https://discord.gg/tfPJa4UmAv"><img alt="Discord" src="https://img.shields.io/badge/discord-chat-5865f2?logo=discord&logoColor=f5f5f5" /></a>
</p> -->

<!-- ![demo](https://www.usememos.com/demo.png) -->

## Main Features

- **Privacy First** 🏠: Take control of your data. All runtime data is securely stored in your local database.
- **Create at Speed** ✍️: Save content as plain text for quick access, with Markdown support for fast formatting and easy sharing.
- **Lightweight but Powerful** 🤲: Built with Go, React.js, and a compact architecture, our application delivers powerful performance in a lightweight package.
- **Customizable** 🧩: Easily customize your server name, icon, description, system style, and execution scripts to make it uniquely yours.
- **Open Source** 🦦: Memos embraces the future of open source, with all code available on GitHub for transparency and collaboration.
- **Free to Use** 💸: Enjoy all features completely free, with no charges ever for any content.

## Deploy with Docker in seconds

```
# docker-compose.yml
version: '3.8'

services:
  memos:
    # image: neosmemo/memos:latest
    image: ctkghost/memos-dark:latest
    container_name: memos
    restart: always
    ports:
      - "5230:5230"
    volumes:
      - ~/memos/:/var/opt/memos
    command: --mode prod --port 5230
```

```bash
docker run -d --name memos -p 5230:5230 -v ~/.memos/:/var/opt/memos ctkghost/memos-dark:stable
```

> [!NOTE]
> This command is only applicable for Unix/Linux systems. For Windows, please refer to the detailed [documentation](https://www.usememos.com/docs/install/container-install#docker-on-windows).
>
> The `~/.memos/` directory will be used as the data directory on your local machine, while `/var/opt/memos` is the directory of the volume in Docker and should not be modified.

Learn more about [other installation methods](https://www.usememos.com/docs/install).

## Contribution

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. We greatly appreciate any contributions you make. Thank you for being a part of our community! 🥰

## Sponsorship

If you find Memos helpful, please consider sponsoring us. Your support will help us to continue developing and maintaining the project.

❤️ Thanks to the following sponsors and backers: **[yourselfhosted](https://github.com/yourselfhosted)**, **[Burning_Wipf](https://github.com/KUKARAF)**, _[...see more](https://github.com/sponsors/usememos)_.

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=CtkGHoSt/memos-dark&type=Date)](https://star-history.com/#CtkGHoSt/memos-dark&Date)


## Other Projects

- [**Slash**](https://github.com/yourselfhosted/slash): An open source, self-hosted bookmarks and link sharing platform. Save and share your links very easily.
- [**Gomark**](https://github.com/usememos/gomark): A markdown parser written in Go for Memos. And its [WebAssembly version](https://github.com/usememos/gomark-wasm) is also available.
