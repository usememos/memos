## Background & Context

Memos has a content-blur feature: when a memo's tag list contains the literal string `NSFW`
(case-insensitive), the memo body is rendered with a `blur-lg` CSS class and a click-to-reveal
overlay is shown. This was simplified in v0.26.x from a previous admin-configurable system
(which had an on/off toggle and a custom-tag-list) down to a single hardcoded tag name.

In the same release cycle, an `InstanceTagsSetting` system was introduced that lets admins attach
metadata (currently only `background_color`) to tag name patterns via a regex-keyed map. This
system has its own proto definitions, store layer, API service handlers, frontend context, utility
library, and settings UI — all independent of the blur feature.

A sponsor raised (orgs/usememos/discussions/5708) that the hardcoded tag name is inconvenient:
users who organised their content under a different tag (e.g. a non-English word, a project-
specific label, or simply a term they prefer) must re-tag all existing memos just to use the blur
feature. Community comments echo the same concern and additionally ask for the ability to disable
the blur globally.

## Issue Statement

The memo content-blur trigger is evaluated exclusively against the hardcoded string `"NSFW"`
(case-insensitive) in `MemoView.tsx`, with no connection to the `InstanceTagsSetting` system,
making it impossible for an administrator to designate any other tag name — or set of tag name
patterns — as a blur trigger, and preventing users from re-using existing tag taxonomies to
activate content blurring.

## Current State

**Blur detection — frontend**

| File | Lines | Behaviour |
|------|-------|-----------|
| `web/src/components/MemoView/MemoView.tsx` | 27–30 | `const nsfw = memoData.tags?.some((tag) => tag.toUpperCase() === "NSFW") ?? false;` — single hardcoded string comparison |
| `web/src/components/MemoView/MemoViewContext.tsx` | 16–19 | Context shape exposes `nsfw: boolean`, `showNSFWContent: boolean`, `toggleNsfwVisibility` |
| `web/src/components/MemoView/components/MemoBody.tsx` | 11–23, 37, 53 | Applies `blur-lg transition-all duration-200` when `nsfw && !showNSFWContent`; renders `NsfwOverlay` button using i18n key `memo.click-to-show-nsfw-content` |
| `web/src/components/MemoPreview/MemoPreview.tsx` | 24–27 | Stub context value: `nsfw: false`, `showNSFWContent: false` — blur never active in preview |

**Localisation strings that contain the "NSFW" term**

| File | Keys |
|------|------|
| `web/src/locales/en.json` (and ~30 other locale files) | `memo.click-to-hide-nsfw-content`, `memo.click-to-show-nsfw-content`, `settings.enable-blur-nsfw-content` |

Note: most non-English translations already use "sensitive content" rather than "NSFW" in these
keys; English is the outlier.

**Tag metadata system — proto**

| File | Lines | Content |
|------|-------|---------|
| `proto/api/v1/instance_service.proto` | 168–181 | `message TagMetadata { google.type.Color background_color = 1; }` nested inside `InstanceSetting`; `TagsSetting` is a `map<string, TagMetadata>` |
| `proto/store/instance_setting.proto` | 113–124 | `message InstanceTagMetadata { google.type.Color background_color = 1; }` inside `InstanceTagsSetting` |

**Tag metadata system — backend**

| File | Lines | Content |
|------|-------|---------|
| `store/instance_setting.go` | 166–192 | `GetInstanceTagsSetting()` retrieves and caches the tags map |
| `server/router/api/v1/instance_service.go` | 300–328 | `convertInstanceTagsSettingFromStore()` / `convertInstanceTagsSettingToStore()` convert between store and API representations, field-by-field |
| `server/router/api/v1/instance_service.go` | 387–409 | `validateInstanceTagsSetting()` validates each key as a regex pattern and the color value |

**Tag metadata system — frontend**

| File | Lines | Content |
|------|-------|---------|
| `web/src/lib/tag.ts` | 28–43 | `findTagMetadata(tag, tagsSetting)` — exact-match then regex-match lookup returning `TagMetadata \| undefined` |
| `web/src/components/MemoContent/Tag.tsx` | 23–38 | Calls `findTagMetadata()` to apply `background_color` to inline tag chips |
| `web/src/components/Settings/TagsSection.tsx` | 36–206 | Admin settings UI for managing the tag→metadata map; currently shows only a colour picker per tag |
| `web/src/contexts/InstanceContext.tsx` | 83–99 | `tagsSetting` selector and fetch during app initialisation |

## Non-Goals

- Redesigning or replacing the `InstanceTagsSetting` proto or store structure beyond adding one field.
- Providing a per-user (as opposed to per-instance) blur preference.
- Changing how background-color metadata is stored, validated, or rendered.
- Adding a global on/off toggle for blurring (separate from per-tag configuration).
- Modifying the blur visual effect (CSS class, animation, overlay button layout).
- Migrating or auto-converting any existing memos that were tagged with `NSFW`.
- Changing non-English locale strings that already use neutral terminology.

## Open Questions

1. Should the `blur_content` field in tag metadata be configurable per-tag only by admins, or also by individual users via user-level tag settings? (default: admin-only, matching the existing `InstanceTagsSetting` access model)

2. When a memo has multiple tags and more than one of them has `blur_content = true`, should the blur activate if _any_ matching tag has the flag set, or only if _all_ matching tags do? (default: any — OR semantics, consistent with the current single-tag check)

3. Should there be a migration that automatically sets `blur_content = true` for any existing `InstanceTagsSetting` entry whose key is `"NSFW"` (case-insensitive)? (default: no automatic migration; admins reconfigure manually)

4. What should the English-locale i18n key strings say, given that "NSFW" is to be avoided? (default: "Click to show sensitive content" / "Click to hide sensitive content")

## Scope

**M** — the change adds one `bool` field to two existing proto messages, threads it through two
existing conversion functions in the backend, replaces one hardcoded string comparison in
`MemoView.tsx` with a call to the already-present `findTagMetadata()` utility, adds a checkbox to
the existing `TagsSection.tsx` settings UI, and renames three i18n keys. All required patterns
(field addition, conversion, `findTagMetadata` lookup, settings UI checkbox) already exist in the
codebase.
