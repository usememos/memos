> ✨ Featured sponsor: [CodeRabbit — Industry-leading AI code reviews](https://coderabbit.link/usememos).

<h1 id="memos">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/brand/lockup-on-dark.svg" />
    <img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/brand/lockup.svg" alt="Memos" width="220" />
  </picture>
</h1>

### Seconds to write. Yours to keep.

Memos is a place for every quick thought. No title, no folder, nothing to pick: type, and the thought is kept on the day you wrote it. Your memos stay where you decide, yours alone until you share one with family and friends.

[Demo](https://demo.usememos.com) · [Install](#quick-start) · [Docs](https://usememos.com/docs) · [Discord](https://discord.gg/tfPJa4UmAv)

[![Docker pulls](https://img.shields.io/docker/pulls/neosmemo/memos?style=flat-square&logo=docker)](https://hub.docker.com/r/neosmemo/memos)
[![Latest release](https://img.shields.io/github/v/release/usememos/memos?style=flat-square&label=Release)](https://github.com/usememos/memos/releases)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/previews/timeline-dark.png" />
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/previews/timeline-light.png" />
  <img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/previews/timeline-light.png" alt="The Memos timeline with a memo composer and recent memos" />
</picture>

## What you get

- **A place for every quick thought.** Memos asks nothing first: no title to invent, no folder to pick, no place to put it. Type, and the thought is kept before it goes.
- **A day you can return to.** Every memo keeps the day it was written, so any day can be found again: by scrolling, by calendar, by tag, or by word.
- **A record that is yours.** Your memos live where you decide, report to no one, and leave as plain Markdown whenever you like.
- **Family and friends, when you choose.** A memo is yours alone until you share it. Each person writes their own memos and sees only what you choose to show.

## Quick start

With Docker installed, run:

```bash
docker run -d \
  --name memos \
  -p 5230:5230 \
  -v ~/.memos:/var/opt/memos \
  neosmemo/memos:stable
```

Open http://localhost:5230 and create the first account. Everything Memos keeps is in `~/.memos`, so back up that one folder.

Other ways to run Memos, including Docker Compose, Kubernetes, and a plain binary, are in the [deployment guide](https://usememos.com/docs/deploy).

## Upgrading

Releases are tagged `YY.MM.N`, with release candidates as `YY.MM.N-rc.K` and no `v` prefix. The Docker tag `stable` follows stable releases, a month tag such as `26.10` follows the newest stable release of that month, and `canary` follows development builds. Coming from a release before v0.31.0, run [v0.31.0](https://github.com/usememos/memos/releases/tag/v0.31.0) once first; see the [upgrade requirements](store/migration/README.md).

## Around Memos

- [Web Clipper](https://usememos.com/web-clipper) for [Chrome](https://chromewebstore.google.com/detail/memos-web-clipper/nebaoebnljalfegiidibihhkebeiklbl) and [Firefox](https://addons.mozilla.org/en-US/firefox/addon/memos-web-clipper/) saves pages, selections, and images to your memos as Markdown with a link to the source.
- [Memogram](https://github.com/usememos/telegram-integration) is a Telegram bot that saves your messages and images to Memos.
- The [API](https://usememos.com/docs/api/latest) and [MCP server](https://usememos.com/docs/integrations/mcp) connect Memos to your own scripts and AI tools.

## Sponsors

<p>
  <a href="https://coderabbit.link/usememos" target="_blank" rel="noopener"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/coderabbit/white-typemark.svg" /><img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/coderabbit/orange-typemark.svg" alt="CodeRabbit" height="40" align="middle" /></picture></a>
  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
  <a href="https://www.testmuai.com/?utm_medium=sponsor&utm_source=memos" target="_blank" rel="noopener"><picture><source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/testmuai/white.png" /><img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/sponsors/testmuai/black.png" alt="TestMu AI" height="30" align="middle" /></picture></a>
</p>

Sponsor Memos through [GitHub Sponsors](https://github.com/sponsors/usememos).

## Help and contributing

Questions go to the [docs](https://usememos.com/docs), [Discord](https://discord.gg/tfPJa4UmAv), or [GitHub Discussions](https://github.com/usememos/memos/discussions). Bugs and ideas go to [issues](https://github.com/usememos/memos/issues/new/choose). Code changes start with the [contributing guide](https://usememos.com/docs/development/contributing).

## Star History

<p>
  <a href="https://www.star-history.com/usememos/memos"><picture><source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=usememos/memos&type=rank&theme=dark" /><source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=usememos/memos&type=rank" /><img alt="Star History Rank" src="https://api.star-history.com/badge?repo=usememos/memos&type=rank" /></picture></a>
  <a href="https://www.star-history.com/usememos/memos"><picture><source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/badge?repo=usememos/memos&type=trending&theme=dark" /><source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/badge?repo=usememos/memos&type=trending" /><img alt="GitHub Trending Repository of the Day" src="https://api.star-history.com/badge?repo=usememos/memos&type=trending" /></picture></a>
</p>

## License

Memos is open source under the [MIT License](LICENSE).
