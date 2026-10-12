# Release Notes

Model new notes on the v0.31.0 release (`gh release view v0.31.0`). Notes are written for people who run Memos, not for
contributors: describe what changed for them, not how the code changed.

## Range and Sources

- Stable releases cover everything since the previous stable tag, including changes already described in its candidates.
- Candidates cover everything since the previous stable tag too, so testers see the whole release taking shape.
- Read every commit in the range: `git log --no-merges <prev>..<sha>`. For squash-merged PRs, read the PR title, body, and
  linked issue. For direct commits, read the diff.
- Drop changes users cannot observe: refactors, tests, CI, lint, dependency bumps without user effect, and internal docs.

## Structure

Stable releases use these sections in this order. Omit an empty section rather than padding it.

1. **Summary paragraph** (no heading): two sentences. Name the most important additions, then the areas that improved
   overall. Use the release's tag as the version, e.g. "Memos 26.10 adds…".
2. `## Highlights`: new capabilities, ordered writing first, then finding and browsing, then ownership and data.
3. `## Fixes and polish`: grouped by area (Editor, Markdown, Interface and languages, …).
4. `## Administration and integrations`: security, deployment, configuration, API, MCP, CLI.
5. `## Upgrade notes`: anything an operator or API client must know or act on. Check the range for `store/migration/` changes,
   proto field or RPC removals and renames, changed defaults, new or removed flags and environment variables, permission
   changes, and removed features. Say what changes on upgrade and what the reader must do.
6. Keep GitHub's generated `## New Contributors` section and `**Full Changelog**` line unchanged at the end.

Candidates use a shorter form: the summary paragraph, `### What's new`, `### Improvements and fixes`, and upgrade notes when
any apply. Add one line asking testers to report regressions in issues.

## Bullets

- Highlights and grouped sections use `* **Area:** sentence. (links)`. Group related changes into one bullet per area instead
  of one bullet per PR.
- Write in present tense from the user's side: "Browse memos by month", not "Added calendar component".
- Link every bullet to its sources: `[#1234](https://github.com/usememos/memos/pull/1234)` for PRs, and a short descriptive label
  linking the full commit URL for direct commits.
- Use product names as they appear in the app (Spaces, Views, Quick Find). Never call memos posts or messages.
- Do not mention plans, subscriptions, payments, or vendors.
- Do not credit tools or agents that helped produce the release.
