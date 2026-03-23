## Execution Log

### T1: Add blur_content field to proto messages

**Status**: Completed
**Files Changed**: `proto/api/v1/instance_service.proto`, `proto/store/instance_setting.proto`
**Validation**: `buf lint` — PASS
**Path Corrections**: None
**Deviations**: None

### T2: Regenerate proto code

**Status**: Completed
**Files Changed**: `proto/gen/` (Go + OpenAPI), `web/src/types/proto/` (TypeScript)
**Validation**: `grep blur_content` in generated files — PASS (field present in Go, TS, OpenAPI)
**Path Corrections**: None
**Deviations**: None

### T3: Thread blur_content through backend conversions

**Status**: Completed
**Files Changed**: `server/router/api/v1/instance_service.go`
**Validation**: `go build ./...` — PASS
**Path Corrections**: None
**Deviations**: None

### T4: Replace hardcoded NSFW check with tag metadata lookup

**Status**: Completed
**Files Changed**: `web/src/components/MemoView/MemoView.tsx`, `web/src/components/MemoView/MemoViewContext.tsx`, `web/src/components/MemoView/components/MemoBody.tsx`, `web/src/components/MemoPreview/MemoPreview.tsx`
**Validation**: `pnpm lint` — PASS
**Path Corrections**: i18n key update (T6) was pulled forward to unblock TypeScript type checking, since the i18n key type is statically checked.
**Deviations**: None

### T5: Add blur checkbox to TagsSection settings UI

**Status**: Completed
**Files Changed**: `web/src/components/Settings/TagsSection.tsx`
**Validation**: `pnpm lint` — PASS
**Path Corrections**: None
**Deviations**: None

### T6: Update English i18n keys

**Status**: Completed
**Files Changed**: `web/src/locales/en.json`
**Validation**: `grep -c "nsfw\|NSFW" en.json` — returns 0, PASS
**Path Corrections**: Executed during T4/T5 to unblock type checking. Added `setting.tags.blur-content` key (not in original plan but required by T5's new checkbox column).
**Deviations**: None

## Completion Declaration

**All tasks completed successfully.**

Summary of changes:
- Added `bool blur_content = 2` to both API and store proto TagMetadata messages
- Regenerated Go, TypeScript, and OpenAPI code
- Threaded `blur_content` through `convertInstanceTagsSettingFromStore()` and `convertInstanceTagsSettingToStore()`
- Replaced hardcoded `tag.toUpperCase() === "NSFW"` with `findTagMetadata(tag, tagsSetting)?.blurContent` lookup
- Renamed context fields: `nsfw` → `blurred`, `showNSFWContent` → `showBlurredContent`, `toggleNsfwVisibility` → `toggleBlurVisibility`
- Renamed `NsfwOverlay` → `BlurOverlay` component
- Expanded TagsSection local state to track `{ color, blur }` per tag and added a "Blur content" checkbox column
- Updated English i18n: renamed NSFW keys to "sensitive content", removed unused key, added `blur-content` setting key
