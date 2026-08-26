> ✨ Featured Sponsor: [CodeRabbit](https://coderabbit.link/usememos) — Cut code review time & bugs in half, instantly.

# Memos

<p>
  <a href="README.md">English</a> ·
  <a href="README.ru.md"><strong>Русский</strong></a>
</p>

<img align="right" height="96px" src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/logo-rounded.png" alt="Memos" />

Memos — open-source, self-hosted приложение для заметок с быстрым захватом идей. Markdown-native, лёгкое, данные остаются под вашим контролем.

[![Home](https://img.shields.io/badge/🏠-usememos.com-blue?style=flat-square)](https://usememos.com)
[![Live Demo](https://img.shields.io/badge/✨-Try%20Demo-orange?style=flat-square)](https://demo.usememos.com/)
[![Docs](https://img.shields.io/badge/📚-Documentation-green?style=flat-square)](https://usememos.com/docs)
[![Discord](https://img.shields.io/badge/💬-Discord-5865f2?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/tfPJa4UmAv)
[![Docker Pulls](https://img.shields.io/docker/pulls/neosmemo/memos?style=flat-square&logo=docker)](https://hub.docker.com/r/neosmemo/memos)

<img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/demo.png" alt="Memos Demo Screenshot" height="512" />

## Возможности

- **Быстрый захват** — timeline-first интерфейс: открыл, написал, пошёл дальше.
- **Свои данные** — self-host на вашей инфраструктуре, без telemetry.
- **Deploy anywhere** — один Go binary или Docker; SQLite, MySQL или PostgreSQL.
- **Интеграции** — REST и gRPC API; MIT-лицензия, можно адаптировать под себя.

## Быстрый старт

Хотите сначала посмотреть? Откройте [live demo](https://demo.usememos.com/).

### Docker (Recommended)

```bash
docker run -d \
  --name memos \
  -p 5230:5230 \
  -v ~/.memos:/var/opt/memos \
  neosmemo/memos:stable
```

Откройте `http://localhost:5230` и начинайте писать.

### Native Binary

Native macOS binaries требуют macOS 13 Ventura или новее.

```bash
curl -fsSL https://raw.githubusercontent.com/usememos/memos/main/scripts/install.sh | sh
```

### Другие способы установки

- **Docker Compose** — рекомендуется для production.
- **Kubernetes** — Helm charts и manifests.
- **Build from source** — для разработки и кастомизации.

Подробнее: [deployment guide](https://usememos.com/docs/deploy).

## Web Clipper

Сохраняйте страницы, выделенный текст и изображения в ваш Memos instance через официальный [Memos Web Clipper](https://github.com/usememos/web-clipper). Расширение для [Chrome](https://chromewebstore.google.com/detail/memos-web-clipper/nebaoebnljalfegiidibihhkebeiklbl) и [Firefox](https://addons.mozilla.org/en-US/firefox/addon/memos-web-clipper/): просмотр клипа, visibility и Markdown format перед сохранением.

## Contributing

Приветствуются bug reports, feature suggestions, PRs, документация и переводы.

- [Report bugs](https://github.com/usememos/memos/issues/new?template=bug_report.md)
- [Suggest features](https://github.com/usememos/memos/issues/new?template=feature_request.md)
- [Submit pull requests](https://github.com/usememos/memos/pulls)
- [Improve documentation](https://github.com/usememos/dotcom)
- [Help with translations](https://github.com/usememos/memos/tree/main/web/src/locales)

## Sponsors

- [**CodeRabbit** — Cut code review time and bugs in half](https://coderabbit.link/usememos)
- [**SSD Nodes** — Affordable VPS hosting for self-hosters](https://ssdnodes.com/?utm_source=memos&utm_medium=sponsor)
- [**TestMu AI** — The world’s first full-stack Agentic AI Quality Engineering platform](https://www.testmuai.com/?utm_medium=sponsor&utm_source=memos)

Нравится Memos? [Sponsor us on GitHub](https://github.com/sponsors/usememos)!

## License

Memos — open-source под [MIT License](LICENSE). См. [Privacy Policy](https://usememos.com/privacy).

---

[Website](https://usememos.com) • [Documentation](https://usememos.com/docs) • [Demo](https://demo.usememos.com/) • [Discord](https://discord.gg/tfPJa4UmAv) • [X/Twitter](https://x.com/usememos)
