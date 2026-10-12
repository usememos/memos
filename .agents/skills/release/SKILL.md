---
name: release
description: >
  Own a Memos release end to end: pick the next CalVer tag, verify the candidate
  commit, draft release notes, push the tag, watch the Release workflow, recover
  from failures, verify published binaries and images, and publish the notes.
  Use when the user asks to cut, ship, promote, or check a Memos release or
  release candidate. Do not use for canary images or demo deploys.
metadata:
  owner: "boojack"
  version: "1.0.0"
  last-reviewed: "2026-10-02"
---

# Release

Pushing a tag is the only release action. `.github/workflows/release.yml` then runs the upgrade smoke test, builds binaries and
checksums, publishes the GitHub Release, and pushes `neosmemo/memos` and `ghcr.io/usememos/memos` images. Your job is everything
around that tag: choose it, gate it, explain it, watch it, and prove the result.

## Ground Rules

- Never release from the user's working tree. Tag a commit SHA that is on `origin/main`; uncommitted or unpushed local work is
  not part of the release. Do not stash, commit, push to main, or rebase for a release.
- A request to run this skill authorizes fetching, dispatching `release.yml` or `upgrade-smoke.yml` on main, rerunning failed
  jobs, and editing the notes of the release you created. Reading the skill authorizes nothing.
- Pushing the tag publishes to GitHub, Docker Hub, and GHCR. Before that push, show the plan and wait for an explicit go, unless
  the user's request already named the tag (or "next rc"/"next stable") and said to proceed without asking.
- Never delete, move, or force-push a pushed tag, and never delete a published release or image, without the user's explicit
  approval for that specific tag. The default recovery is the next tag number.
- Use lightweight tags (`git tag <tag> <sha>`), matching existing tags.

## 1. Establish State

```bash
git fetch origin --tags --prune
git rev-parse origin/main
bash scripts/release_version.sh previous-tag .   # last stable before HEAD; run in a checkout of the candidate
gh release list --limit 10
```

Record: candidate SHA (default `origin/main`), the last stable tag, any release candidates after it and the commits they point
to, and whether the working tree differs from the candidate (mention it; do not touch it).

## 2. Choose the Tag

Format is `YY.MM[.N][-rc.N]` (validated by `scripts/release_version.sh` and `internal/version`). `YY.MM` is the current UTC month.

- **New stable:** `YY.MM` if no stable tag exists for this month, else `YY.MM.<N+1>`.
- **New release candidate:** the next stable version plus `-rc.<N+1>`, counting existing candidates for that version.
- **Promote a candidate:** the candidate's base version, tagged on the candidate's commit. Promotion keeps the base version
  even if the month has changed. If main moved past the candidate, ask whether to promote the candidate commit or cut a new
  candidate from main.

Recommend a candidate first when the range since the last stable includes migrations (`store/migration/`), proto API changes,
auth or permission changes, or more than a few weeks of features. Patch releases with only fixes can go straight to stable.

## 3. Gate the Candidate

All must pass before you propose the tag:

1. The tag does not exist locally or on origin, and no release with that name exists.
2. The candidate SHA is reachable from `origin/main`.
3. CI is green. Push to main runs Backend Tests, Frontend Tests, and Proto Linter on every commit:
   `gh run list --commit <sha> --json name,status,conclusion`. Require each of those three to be `completed/success`. Wait for
   in-progress runs; a failure blocks the release.
4. For a stable tag that is not a promotion, do a dry run first: `gh workflow run release.yml --ref main`, confirm the run's
   `headSha` is the candidate, and wait for success. The dry run runs the upgrade smoke and every binary build without
   publishing, so a failing build costs no tag number. Skip it for candidates and promotions, which act as their own dry run.

## 4. Draft the Notes

Write notes for the range from the last stable tag to the candidate, following [release-notes.md](references/release-notes.md).
Read the commits, the merged PRs (`gh pr view`), and the diff for migrations, proto changes, configuration flags, and removed
behavior. Carry the `## Unreleased` entries of `proto/api/CHANGELOG.md` into the notes as breaking API changes. Save the
draft in a temporary directory outside the repo.

## 5. Propose, Then Tag

Show the user: tag, candidate SHA and subject, last stable tag, commit count, gate results, image tags that will move (from
`bash scripts/release_version.sh image-tags <tag>`), and the drafted notes. After an explicit go:

```bash
git tag <tag> <sha>
git push origin <tag>
```

## 6. Watch the Release Run

Find the run with `gh run list --workflow release.yml --event push --limit 5` and match `headBranch` to the tag. Watch it until it
completes. The jobs are upgrade-smoke, Extract Version, Build Frontend, six binary builds, Generate Checksums, Publish GitHub
Release, three image builds, and Publish Release Image Tags.

On failure, read the failed job's log (`gh run view <id> --log-failed`) and classify it:

- **Infrastructure** (runner loss, network timeout, registry rate limit or 5xx, action download failure): `gh run rerun <id>
  --failed`. Retry at most twice per run.
- **Defect** (test failure, compile error, smoke assertion, bad Dockerfile): stop. Do not rerun. Report the failing step,
  root cause, and the files involved. The fix lands on main through the normal workflow; after it is green, offer the next
  tag (next candidate number or next patch). The failed tag stays as is.
- **Partial publish** (GitHub Release published but images failed, or the reverse): report exactly which surfaces exist. Rerun
  only the failed jobs; they are idempotent for the same tag.

## 7. Verify the Published Release

Do not report success until each check passes:

1. `gh release view <tag> --json isPrerelease,isLatest,assets`: prerelease is true only for `-rc` tags, latest is true only for
   stable tags, and assets are exactly six archives (`linux_amd64`, `linux_arm64`, `linux_armv7`, `darwin_amd64`,
   `darwin_arm64`, `windows_amd64.zip`) plus `checksums.txt`.
2. Download `checksums.txt` and the archive for this machine into a temporary directory. Check it with `sha256sum -c` (or
   `shasum -a 256 -c`) against its line, then extract and run `./memos --version`, which must print the tag.
3. `docker buildx imagetools inspect neosmemo/memos:<tag>` and `ghcr.io/usememos/memos:<tag>`: both list `linux/amd64`,
   `linux/arm64`, and `linux/arm/v7`. For stable tags, `stable` and the series tag (when it differs from the tag) resolve to the
   same digest as `<tag>`.
4. If Docker can run locally, `./scripts/release_smoke_test.sh --candidate-image neosmemo/memos:<tag>` tests the published
   image. If Docker is unavailable, say so; do not skip it silently.

## 8. Publish the Notes

The workflow publishes GitHub-generated notes. Replace them with your draft, keeping the generated `## New Contributors` section
and `**Full Changelog**` line at the end: `gh release edit <tag> --notes-file <draft>`. Then read the release page back and check
that links resolve to the right PRs and commits.

## 9. Report

Give the release URL, tag, SHA, image tags and digest, verification results, any reruns and why, and anything not done. Out of
scope for this skill: announcements, website or docs updates, and the demo deploy (`demo-deploy.yml`, manual dispatch). List
them as follow-ups for the user rather than doing them. If `proto/api/CHANGELOG.md` has `## Unreleased` entries, list
renaming that heading to the tag as a follow-up too.
