<h1 align="center">✍️ Memos</h1>

<p align="center">An open source, self-hosted knowledge base that works with a SQLite db file.</p>

<p align="center">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/usememos/memos" />
  <img alt="Docker pull" src="https://img.shields.io/docker/pulls/neosmemo/memos.svg" />
  <img alt="Go report" src="https://goreportcard.com/badge/github.com/usememos/memos" />
</p>

<p align="center">
  <a href="https://memos.onrender.com/">Live Demo</a> •
  <a href="https://github.com/usememos/memos/discussions">Discussions</a>
</p>

![demo](https://raw.githubusercontent.com/usememos/memos/main/resources/demo.png)

## 🎯 Intentions

- ✍️ Write down the light-card memos very easily;
- 🏗️ Build the fragmented knowledge management tool for yourself;
- 📒 For noting your 📅 daily/weekly plans, 💡 fantastic ideas, 📕 reading thoughts...

## ✨ Features

- 🦄 Fully open source;
- 👍 Write in the plain textarea without any burden;
- 🤠 Great UI and never miss any detail;
- 🚀 Super quick self-hosted with `Docker` and `SQLite`;

## ⚓️ Deploy with Docker

```docker
docker run --name memos --publish 5230:5230 --volume ~/.memos/:/var/opt/memos -e mode=prod -e port=5230 neosmemo/memos:0.1.2
```

Memos should now be running at [http://localhost:5230](http://localhost:5230). If the `~/.memos/` does not have a `memos_prod.db` file, then `memos` will auto generate it.

## 🏗 Development

Memos is built with a curated tech stack. It is optimized for developer experience and is very easy to start working on the code:

1. It has no external dependency.
2. It requires zero config.
3. 1 command to start backend and 1 command to start frontend, both with live reload support.

### Tech Stack

<img alt="tech stack" src="https://raw.githubusercontent.com/usememos/memos/main/resources/tech-stack.png" width="360" />

### Prerequisites

- [Go](https://golang.org/doc/install) (1.16 or later)
- [Air](https://github.com/cosmtrek/air#installation) for backend live reload
- [yarn](https://yarnpkg.com/getting-started/install)

### Steps

1. pull source code

   ```bash
   git clone https://github.com/usememos/memos
   ```

2. start backend using air(with live reload)

   ```bash
   air -c scripts/.air.toml
   ```

3. start frontend dev server

   ```bash
   cd web && yarn && yarn dev
   ```

Memos should now be running at [http://localhost:3000](http://localhost:3000) and change either frontend or backend code would trigger live reload.

## 🌟 Star history

[![Star History Chart](https://api.star-history.com/svg?repos=usememos/memos&type=Date)](https://star-history.com/#usememos/memos&Date)

---

Just enjoy it.
