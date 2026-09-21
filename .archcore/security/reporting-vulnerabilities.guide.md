---
title: "Reporting vulnerabilities"
status: draft
tags:
  - "security"
---

Reader: a user or researcher who found a suspected security vulnerability in Memos. Task: report it privately to the maintainers. Actor: the reporter.

## Prerequisites

- Memos is a `0.x` project. Security fixes ship only for the latest release; older releases receive no security updates and no backports.
- Production operators keep their instance on the latest release.
- The reporter has the details listed in steps 1 and 2.

## Steps

**Warning:** do not open a public GitHub issue, discussion, or pull request for a suspected vulnerability.

1. Write a report with a clear description, steps to reproduce, and the affected version or commit.
2. Add the deployment details that matter to reproduction and your assessment of impact.
3. Email the report to `dev@usememos.com`.

## Verification

- Maintainers review reports as time permits and fix valid issues in regular releases.
- A fix ships directly in a normal release, or with a brief note in the release notes and changelog.

## Common Issues

- **No advisory or CVE appears.** At the `0.x` stage, Memos runs no formal disclosure program, publishes no separate advisory for every issue, and requests no CVE IDs.
- **The issue affects only an older release.** Older releases get no security fixes; production instances belong on the latest release.
