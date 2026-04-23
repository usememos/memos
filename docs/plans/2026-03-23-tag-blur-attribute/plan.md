## Task List

T1: Add blur_content field to proto messages [S] — T2: Regenerate proto code [S] — T3: Thread blur_content through backend conversions [S] — T4: Replace hardcoded NSFW check with tag metadata lookup [M] — T5: Add blur checkbox to TagsSection settings UI [S] — T6: Update English i18n keys [S]

### T1: Add blur_content field to proto messages [S]

**Objective**: Add a `bool blur_content` field to both the API and store proto TagMetadata messages.
**Files**: `proto/api/v1/instance_service.proto`, `proto/store/instance_setting.proto`
**Implementation**:
- In `proto/api/v1/instance_service.proto` (~line 171), add `bool blur_content = 2;` to `message TagMetadata` after `background_color`
- In `proto/store/instance_setting.proto` (~line 115), add `bool blur_content = 2;` to `message InstanceTagMetadata` after `background_color`
**Validation**: `cd proto && buf lint` — no errors

### T2: Regenerate proto code [S]

**Objective**: Regenerate Go + TypeScript + OpenAPI from updated proto definitions.
**Files**: `proto/gen/` (generated), `web/src/types/proto/` (generated)
**Implementation**: Run `cd proto && buf generate`
**Dependencies**: T1
**Validation**: `grep -r "blur_content\|blurContent" proto/gen/ web/src/types/proto/ | head -10` — shows new field in generated Go and TS files

### T3: Thread blur_content through backend conversion functions [S]

**Objective**: Pass `blur_content` through the store↔API conversion functions so the field round-trips correctly.
**Files**: `server/router/api/v1/instance_service.go`
**Implementation**:
- In `convertInstanceTagsSettingFromStore()` (~line 306): add `BlurContent: metadata.GetBlurContent()` to the `InstanceSetting_TagMetadata` struct literal
- In `convertInstanceTagsSettingToStore()` (~line 321): add `BlurContent: metadata.GetBlurContent()` to the `InstanceTagMetadata` struct literal
**Dependencies**: T2
**Validation**: `cd /Users/steven/Projects/usememos/memos && go build ./...` — compiles without errors

### T4: Replace hardcoded NSFW check with tag metadata lookup [M]

**Objective**: Replace the hardcoded `tag.toUpperCase() === "NSFW"` check with a lookup against `InstanceTagsSetting` via the existing `findTagMetadata()` utility, so any tag with `blur_content: true` triggers the blur.
**Size**: M (3 files, moderate logic)
**Files**:
- Modify: `web/src/components/MemoView/MemoView.tsx`
- Modify: `web/src/components/MemoView/MemoViewContext.tsx`
- Modify: `web/src/components/MemoView/components/MemoBody.tsx`
- Modify: `web/src/components/MemoPreview/MemoPreview.tsx`
**Implementation**:
1. In `MemoView.tsx`:
   - Import `useInstance` from `@/contexts/InstanceContext` and `findTagMetadata` from `@/lib/tag`
   - Replace `const nsfw = memoData.tags?.some((tag) => tag.toUpperCase() === "NSFW") ?? false;` with a check that iterates `memoData.tags` and uses `findTagMetadata(tag, tagsSetting)?.blurContent` — OR semantics (any match triggers blur)
   - Rename state/variables: `showNSFWContent` → `showBlurredContent`, `nsfw` → `blurred`, `toggleNsfwVisibility` → `toggleBlurVisibility`
2. In `MemoViewContext.tsx`:
   - Rename interface fields: `nsfw` → `blurred`, `showNSFWContent` → `showBlurredContent`, `toggleNsfwVisibility` → `toggleBlurVisibility`
3. In `MemoBody.tsx`:
   - Update destructured context fields to use new names (`blurred`, `showBlurredContent`, `toggleBlurVisibility`)
   - Rename `NsfwOverlay` component to `BlurOverlay`
   - Change i18n key from `memo.click-to-show-nsfw-content` to `memo.click-to-show-sensitive-content`
4. In `MemoPreview.tsx`:
   - Update stub context to use new field names (`blurred`, `showBlurredContent`, `toggleBlurVisibility`)
**Boundaries**: Do NOT change blur CSS classes, animation, or overlay layout
**Dependencies**: T2
**Validation**: `cd web && pnpm lint` — no type or lint errors

### T5: Add blur checkbox to TagsSection settings UI [S]

**Objective**: Add a "Blur content" checkbox column to the tag settings table so admins can toggle `blur_content` per tag pattern.
**Files**: `web/src/components/Settings/TagsSection.tsx`
**Implementation**:
- Expand `localTags` state from `Record<string, string>` (hex only) to `Record<string, { color: string; blur: boolean }>` to track both fields
- Update `useEffect` sync, `originalHexMap` comparison, `handleColorChange`, `handleRemoveTag`, `handleAddTag` to work with the new shape
- Add a new `[newTagBlur, setNewTagBlur]` state for the add-tag row (default `false`)
- In `handleSave`, pass `blurContent` when creating `InstanceSetting_TagMetadata`
- Add a new column to `SettingTable` between "Background color" and "Actions": header `t("setting.tags.blur-content")`, renders a checkbox bound to `localTags[row.name].blur`
- Add the i18n key `setting.tags.blur-content` to `en.json` with value `"Blur content"`
**Dependencies**: T2
**Validation**: `cd web && pnpm lint` — no type or lint errors

### T6: Update English i18n keys [S]

**Objective**: Rename NSFW-specific i18n keys in `en.json` to use neutral "sensitive content" terminology.
**Files**: `web/src/locales/en.json`
**Implementation**:
- Change key `memo.click-to-show-nsfw-content` → `memo.click-to-show-sensitive-content` with value `"Click to show sensitive content"`
- Change key `memo.click-to-hide-nsfw-content` → `memo.click-to-hide-sensitive-content` with value `"Click to hide sensitive content"` (dead key but renamed for consistency)
- The key `settings.enable-blur-nsfw-content` is unused in code — remove it
**Dependencies**: T4 (key rename must match code references)
**Validation**: `grep -c "nsfw" web/src/locales/en.json` — returns `0`

## Out-of-Scope Tasks

- Updating non-English locale files (per non-goals: "Changing non-English locale strings that already use neutral terminology")
- Adding automatic migration for existing NSFW tag entries
- Per-user blur preferences
- Global on/off toggle for blurring
- Modifying blur visual effect (CSS, animation, overlay layout)
