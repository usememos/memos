<p align="center"><a href="https://usememos.com"><img height="64px" src="https://raw.githubusercontent.com/usememos/memos/main/resources/logo-full.webp" alt="✍️ memos" /></a></p>

<p align="center">An open-source, self-hosted memo hub for knowledge management and collaboration.</p>

<p align="center">
  <a href="https://github.com/usememos/memos/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/usememos/memos" /></a>
  <a href="https://hub.docker.com/r/neosmemo/memos"><img alt="Docker pull" src="https://img.shields.io/docker/pulls/neosmemo/memos.svg" /></a>
  <img alt="Go report" src="https://goreportcard.com/badge/github.com/usememos/memos" />
</p>

<p align="center">
  <a href="https://demo.usememos.com/">Live Demo</a> •
  <a href="https://t.me/+-_tNF1k70UU4ZTc9">Discuss in Telegram 👾</a>
</p>

![demo](https://raw.githubusercontent.com/usememos/memos/main/resources/demo.webp)

## Features

- 🦄 Open source and forever free;
- 🚀 Support for self-hosting with `Docker` in seconds;
- 📜 Plain textarea first and support some useful markdown syntax;
- 👥 Collaborate and share with your teammates;
- 🧑‍💻 RESTful API for self-service.

## Deploy with Docker in seconds

### Docker Run

```docker
docker run -d --name memos -p 5230:5230 -v ~/.memos/:/var/opt/memos neosmemo/memos:latest
```

Memos should be running at [http://localhost:5230](http://localhost:5230). If the `~/.memos/` does not have a `memos_prod.db` file, then memos will auto generate it.

### Docker Compose

See more in the example [`docker-compose.yaml`](./docker-compose.yaml) file.

If you want to upgrade the version of memos, use the following command.

```sh
docker-compose down && docker image rm neosmemo/memos:latest && docker-compose up -d
```

## Contribute

Contributions are what make the open source community such an amazing place to be learn, inspire, and create. Any contributions you make are greatly appreciated. 🥰

Gets more information in [development guide](https://github.com/usememos/memos/tree/main/docs/development.md).

## Community Products

- [Moe Memos](https://memos.moe/) - Third party client for iOS and Android
- [lmm214/memos-bber](https://github.com/lmm214/memos-bber) - Memos 的 Chrome 扩展
- [Rabithua/memos_wmp](https://github.com/Rabithua/memos_wmp) - 微信小程序版

## Star history

[![Star History Chart](https://api.star-history.com/svg?repos=usememos/memos&type=Date)](https://star-history.com/#usememos/memos&Date)
