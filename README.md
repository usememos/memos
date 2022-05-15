<h1 align="center">✍️ Memos</h1>

<p align="center">An open source, quickly self-hosted alternative to flomo</p>

<p align="center">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/justmemos/memos" />
  <img alt="Docker pull" src="https://img.shields.io/docker/pulls/neosmemo/memos.svg" />
  <img alt="Go report" src="https://goreportcard.com/badge/github.com/justmemos/memos" />
</p>

<p align="center">
  <a href="https://memos.onrender.com/">Live Demo</a> •
  <a href="https://github.com/justmemos/memos/discussions">Discussions</a>
</p>

![demo](https://raw.githubusercontent.com/justmemos/memos/main/resources/demo.png)

## 🎯 Intentions

- ✍️ Write down the light-card memos very easily;
- 🏗️ Build the fragmented knowledge management tool for yourself;
- 📒 For noting your 📅 daily/weekly plans, 💡 fantastic ideas, 📕 reading thoughts...

## ✨ Features

- 🦄 Fully open source;
- 🤠 Great UI and never miss any detail;
- 🚀 Super quick self-hosted with `Docker` and `SQLite`;

## ⚓️ Deploy with Docker

```docker
docker run --name memos --publish 8080:8080 --volume /path/to/your/data/:/var/opt/memos -e mode=prod neosmemo/memos:dev
```

If the `/path/to/your/data` doesn't have a `memos_prod.db` file, then `memos` will auto-generate it and the default username is `dear_musk` with password `secret`.

## 🏗 Development

Memos is built with a curated tech stack. It is optimized for developer experience and is very easy to start working on the code:

1. It has no external dependency.
2. It requires zero config.
3. 1 command to start backend and 1 command to start frontend, both with live reload support.

### Tech Stack

<img alt="tech stack" src="https://raw.githubusercontent.com/justmemos/memos/main/resources/tech-stack.png" width="320" />

### Prerequisites

- [Go](https://golang.org/doc/install) (1.16 or later)
- [Air](https://github.com/cosmtrek/air#installation) for backend live reload
- [yarn](https://yarnpkg.com/getting-started/install)

### Steps

1. pull source code

   ```bash
   git clone https://github.com/justmemos/memos
   ```

2. start backend using air(with live reload)

   ```bash
   air -c scripts/.air.toml
   ```

3. start frontend dev server

   ```bash
   cd frontend && yarn && yarn dev
   ```

Memos should now be running at https://localhost:3000 and change either frontend or backend code would trigger live reload.

## 🌟 Star history

[![Star History Chart](https://api.star-history.com/svg?repos=justmemos/memos&type=Date)](https://star-history.com/#justmemos/memos&Date)

---

Just enjoy it.
