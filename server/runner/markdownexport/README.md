# Markdown Export

A background runner that mirrors all memos to a directory of markdown files on disk. One-way: store → filesystem. New memos become files, deleted/archived memos have their files pruned, unchanged memos are left untouched so mtimes stay stable for backups, indexers, and file watchers.

Disabled by default. The runner is wired into the server and silently does nothing until `MEMOS_MARKDOWN_EXPORT_DIR` is set.

## Configuration

One environment variable, no CLI flag or settings UI:

| Variable | Default | Effect |
|---|---|---|
| `MEMOS_MARKDOWN_EXPORT_DIR` | _(unset)_ | Writable path to mirror memos into. Unset = feature off. A relative path resolves under the instance data directory (`--data`); an absolute path is used as-is. |

Changes take effect on **server restart**.

## Schedule

The runner fires once on server startup and then every 24 hours. It is intentionally not user-triggerable — to force a fresh export, restart the server.

## Layout

```
<exportDir>/
└── <username>/
    └── <YYYY-MM-DD>/
        └── <uid>.md
```

- `<username>` is the memo creator's username, with non-`[A-Za-z0-9._-]` characters replaced by `_`. Memos whose creator can't be resolved go into `user-<id>/` so data is never silently dropped.
- `<YYYY-MM-DD>` is the memo's **creation** date, in UTC (see [Timezones](#timezones)). A memo's path never changes — edits rewrite the file in place, so backups and git stay quiet. The current `updated` time is still available in the frontmatter and as the file's mtime.
- `<uid>.md` keeps every memo mapped to exactly one file, so deletes prune cleanly even when many memos share a date.

## File format

Each file is YAML frontmatter followed by the memo's raw markdown content:

```markdown
---
uid: memo-abc123
created: 2026-05-12T18:34:00Z
updated: 2026-05-30T09:12:55Z
visibility: PRIVATE
pinned: false
tags:
  - reading
  - work
---

The actual memo body, exactly as stored.
Multiple lines preserved.
```

Tags are sorted alphabetically so unchanged memos don't churn the file. The trailing newline is normalized so content always ends in `\n` exactly once.

## Timezones

Dates are formatted in **UTC** for determinism: the same memo always lands in the same folder regardless of the host's timezone or DST. The memos web UI renders dates in the viewer's local timezone, so a late-evening memo may appear in the export under the adjacent day. That is the price of a stable, reproducible layout.

## Prune behavior

After writing all current memos the runner walks the export directory and removes:
- Any `.md` file it did not write this run (orphans from deleted, archived, or relocated memos).
- Now-empty `<date>` and `<username>` directories.

Non-`.md` files are left alone — drop a `README.md` or `.gitignore` in the export dir and it survives.

## Example

```bash
mkdir -p /var/memos-data /var/memos-export
MEMOS_MARKDOWN_EXPORT_DIR=/var/memos-export \
  memos --data /var/memos-data --port 5230
```

```text
/var/memos-export/
├── alice/
│   ├── 2026-05-12/memo-abc123.md
│   └── 2026-05-30/memo-def456.md
└── bob/
    └── 2026-05-30/memo-ghi789.md
```

## What is _not_ exported

- Archived memos and their files are pruned on the next run.
- Attachments (images, files) are not copied — only the memo's markdown body.
- Memo relations (comments / parent-child links) are not encoded in frontmatter; each memo, including replies, gets its own file under its author's date folder.
- User settings, instance settings, and other store data are out of scope.
