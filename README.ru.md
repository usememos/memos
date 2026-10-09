> ✨ Featured sponsor: [CodeRabbit — Industry-leading AI code reviews](https://coderabbit.link/usememos).

# Memos

<p>
  <a href="README.md">English</a> ·
  <a href="README.ru.md"><strong>Русский</strong></a>
</p>

<img src="./web/public/logo.webp" alt="" width="96" align="right">

**Достаточно быстро для каждой мысли. Достаточно приватно для всех них.**

Memos — open-source, self-hosted дом для коротких мыслей. Ежедневные заметки, ссылки, work logs и сниппеты стекаются в хронологический Markdown timeline — на инфраструктуре под вашим контролем, без overhead all-in-one workspace.

**[Запуск с Docker](#быстрый-старт)** · **[Live demo](https://demo.usememos.com/)** · [Документация](https://usememos.com/docs)

[![GitHub stars](https://img.shields.io/github/stars/usememos/memos?style=flat-square&logo=github&label=Stars)](https://github.com/usememos/memos)
[![Latest release](https://img.shields.io/github/v/release/usememos/memos?style=flat-square&label=Release)](https://github.com/usememos/memos/releases)
[![Docker pulls](https://img.shields.io/docker/pulls/neosmemo/memos?style=flat-square&logo=docker)](https://hub.docker.com/r/neosmemo/memos)
[![MIT license](https://img.shields.io/github/license/usememos/memos?style=flat-square)](LICENSE)

<img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/demo.png" alt="Memos Demo Screenshot" height="512" />

## Почему Memos?

- **Быстрый захват** — пишите в Markdown, прикрепляйте media и сохраняйте без выбора title, folder или template.
- **Лёгкая организация** — возвращайтесь к заметкам через timeline, search, tags и pins.
- **Выборочный шаринг** — держите memos private или публикуйте только выбранное.
- **Контроль у вас** — self-host с [zero telemetry](https://usememos.com/features/data-ownership) и [MIT-лицензией](LICENSE).

[Все возможности →](https://usememos.com/features)

## Быстрый старт

Запуск Memos через Docker:

```bash
docker run -d \
  --name memos \
  -p 5230:5230 \
  -v ~/.memos:/var/opt/memos \
  neosmemo/memos:stable
```

Другие варианты установки — в [deployment guide](https://usememos.com/docs/deploy).

## Web Clipper

Сохраняйте страницы, выделения и изображения из браузера прямо в Memos как Markdown со ссылкой на источник. [Memos Web Clipper](https://usememos.com/web-clipper) для [Chrome](https://chromewebstore.google.com/detail/memos-web-clipper/nebaoebnljalfegiidibihhkebeiklbl) или [Firefox](https://addons.mozilla.org/en-US/firefox/addon/memos-web-clipper/).

## Sponsors

<p>
  <a href="https://coderabbit.link/usememos" target="_blank" rel="noopener"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/coderabbit/white-typemark.svg" /><img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/coderabbit/orange-typemark.svg" alt="CodeRabbit — Cut code review time and bugs in half" height="40" align="middle" /></picture></a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://ssdnodes.com/?utm_source=memos&utm_medium=sponsor" target="_blank" rel="noopener"><img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/ssd-nodes.svg" alt="SSD Nodes — Affordable VPS hosting for self-hosters" height="72" align="middle" /></a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://www.testmuai.com/?utm_medium=sponsor&utm_source=memos" target="_blank" rel="noopener"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/testmuai/white.png" /><img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/testmuai/black.png" alt="TestMu AI — The world’s first full-stack Agentic AI Quality Engineering platform" height="30" align="middle" /></picture></a>
</p>

Нравится Memos? [Станьте спонсором на GitHub](https://github.com/sponsors/usememos).

## Помощь

Читайте [docs](https://usememos.com/docs), заходите в [Discord](https://discord.gg/tfPJa4UmAv) или спрашивайте в [GitHub Discussions](https://github.com/usememos/memos/discussions). Нашли баг или есть идея? [Откройте issue](https://github.com/usememos/memos/issues/new/choose). Чтобы контрибьютить — [contributing guide](https://usememos.com/docs/development/contributing).

## Star History

<a href="https://www.star-history.com/?repos=usememos%2Fmemos&amp;type=date&amp;legend=top-left">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=usememos/memos&amp;type=date&amp;theme=dark&amp;legend=top-left" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=usememos/memos&amp;type=date&amp;legend=top-left" />
    <img alt="Memos star history chart" src="https://api.star-history.com/chart?repos=usememos/memos&amp;type=date&amp;legend=top-left" />
  </picture>
</a>
