<h1 align="center">✍️ Memos</h1>

<p align="center">
  <a href="https://memos.onrender.com/">Live Demo</a> •
  <a href="https://github.com/justmemos/memos/discussions">Discussions</a>
</p>

<p align="center">
  <img alt="GitHub stars" src="https://img.shields.io/github/stars/justmemos/memos" />
  <img alt="GitHub forks" src="https://img.shields.io/github/forks/justmemos/memos" />
  <img alt="GitHub Watchers" src="https://img.shields.io/github/watchers/justmemos/memos" />
</p>

Memos is an open source, self-hosted alternative to [flomo](https://flomoapp.com/). Built with `Go` and `React`.

Making sure that you are in charge of your data and more customizations.

## 🎯 Intentions

- ✍️ For noting 📅 daily/weekly plans, 💡 fantastic ideas, 📕 reading thoughts...
- 📒 Write down the lightweight card memos easily;
- 🏗️ Build your own fragmented knowledge management tools;

## ✨ Features

- 🦄 Fully open source;
- 😋 Beautiful and detailed visual styles;
- 📑 Experience excellent interaction logic;
- ⚡️ Quick privatization deployment;

## ⚓️ Deploy Guide with Docker

1. download the [initialized db file](https://github.com/justmemos/memos/raw/main/resources/memos_release.db):

2. pull and run docker image:

   ```docker
   docker run --name memos --publish 8080:8080 --volume ~/path/to/your/data/:/var/opt/memos -e mode=release -e data=/var/opt/memos neosmemo/memos:dev
   ```

The default user account is `guest` with password `secret`.

## 🌟 Star history

[![Star History Chart](https://api.star-history.com/svg?repos=justmemos/memos&type=Date)](https://star-history.com/#justmemos/memos&Date)

---

Just enjoy it.
