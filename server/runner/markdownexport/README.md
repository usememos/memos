# Markdown Export

A background runner that mirrors all memos to a directory of markdown files on disk. One-way: store → filesystem. New memos become files, deleted/archived memos have their files pruned, unchanged memos are left untouched so mtimes stay stable for backups, indexers, and file watchers. A file's mtime therefore tracks when the export last wrote it, not when the memo was edited — the memo's edit time lives in the `updated` frontmatter field.

Disabled by default. The runner is wired into the server and silently does nothing until `MEMOS_MARKDOWN_EXPORT_DIR` is set.

## Configuration

One environment variable, no CLI flag or settings UI:

| Variable | Default | Effect |
|---|---|---|
| `MEMOS_MARKDOWN_EXPORT_DIR` | _(unset)_ | Writable path to mirror memos into. Unset = feature off. A relative path resolves under the instance data directory (`--data`); an absolute path is used as-is. |

Changes take effect on **server restart**.

## Schedule

The runner fires once on server startup and then every 24 hours.

## Layout

```text
<exportDir>/
└── <username>/
    └── <YYYY-MM-DD>/
        └── <uid>.md
```

- `<username>` is the memo creator's username, with non-`[A-Za-z0-9._-]` characters replaced by `_`. Memos whose creator can't be resolved go into `user-<id>/` so data is never silently dropped.
- `<YYYY-MM-DD>` is the memo's **creation** date, in UTC (see [Timezones](#timezones)). A memo's path never changes — edits rewrite the file in place, so backups and git stay quiet. The memo's `updated` time is recorded in the frontmatter; the file's mtime instead reflects when the export last wrote it.
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
attachments:
  - filename: "diagram.png"
    path: "assets/1716950400_3f9c_diagram.png"
  - filename: "report: final.pdf"
    path: "assets/1716950401_a17b_report.pdf"
---

The actual memo body, exactly as stored.
Multiple lines preserved.
```

Tags are sorted alphabetically so unchanged memos don't churn the file. The trailing newline is normalized so content always ends in `\n` exactly once.

The `tags` and `attachments` blocks are omitted entirely when a memo has none. Each `attachments` entry records the original `filename` and, when known, the stable `path` to where the bytes are stored. Entries are sorted by filename (then UID) for stability; duplicate filenames are kept since they are distinct files. Both values are double-quoted and escaped because, unlike tags, they are arbitrary user input. The attachment bytes themselves are **not** copied (see [What is _not_ exported](#what-is-not-exported)).

The `path` value depends on the storage backend:

| Storage | `path` |
|---|---|
| Local (default) | The file's path **relative to the instance data dir** (e.g. `assets/...`), so it stays valid wherever that dir is mounted. A file stored outside the data dir keeps its absolute path. |
| External link | The external URL. |
| S3 | The object **key** — not the presigned URL, which is refreshed periodically and would otherwise rewrite every memo file on each refresh. |
| Database (blob in DB) | Omitted — there is no path. |

## Timezones

Dates are formatted in **UTC** for determinism: the same memo always lands in the same folder regardless of the host's timezone or DST. The memos web UI renders dates in the viewer's local timezone, so a late-evening memo may appear in the export under the adjacent day. That is the price of a stable, reproducible layout.

## Prune behavior

After writing all current memos the runner walks the export directory and removes:
- Any `.md` file it did not write this run (orphans from deleted, archived, or relocated memos).
- Now-empty `<date>` and `<username>` directories.

**Any `.md` file the exporter did not write this run is treated as an orphan and deleted**, regardless of name — so dropping your own `README.md` or `notes.md` in the export tree won't survive the next run. Non-`.md` files (like `.gitignore` or `.git/`) are left alone.

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
- Attachment **bytes** (images, files) are not copied — only the memo's markdown body. Each attachment's *filename* and storage *path* are recorded in the `attachments` frontmatter block (see [File format](#file-format)), so you can correlate a memo with its files, but the files themselves still live wherever the instance stores them.
- Memo relations (comments / parent-child links) are not encoded in frontmatter; each memo, including replies, gets its own file under its author's date folder.
- User settings, instance settings, and other store data are out of scope.
