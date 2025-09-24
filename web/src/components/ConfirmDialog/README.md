# ConfirmDialog - Accessible Confirmation Dialog

## Overview

`ConfirmDialog` standardizes confirmation flows across the app. It replaces ad‑hoc `window.confirm` usage with an accessible, themeable dialog that supports asynchronous operations and optional Markdown descriptions.

## Key Features

### 1. Accessibility & UX
- Uses shared `Dialog` primitives (focus trap, ARIA roles)
- Blocks dismissal while async confirm is pending
- Clear separation of title (action) vs description (context)

### 2. Markdown Support
- Optional `descriptionMarkdown` renders localized Markdown
- Sanitized via `DOMPurify` after `marked` parsing

### 3. Async-Aware
- Accepts sync or async `onConfirm`
- Auto-closes on resolve; remains open on error for retry / toast

### 4. Internationalization Ready
- All labels / text provided by caller through i18n hook
- Supports interpolation for dynamic context

### 5. Minimal Surface, Easy Extension
- Lightweight API (few required props)
- Style hook via `.container` class (SCSS module)

## Architecture

```
ConfirmDialog
├── State: loading (tracks pending confirm action)
├── Markdown pipeline: marked → DOMPurify → safe HTML (if descriptionMarkdown)
├── Dialog primitives: Header (title + description), Footer (buttons)
└── External control: parent owns open state via onOpenChange
```

## Usage

### Basic
```tsx
import { useTranslate } from "@/utils/i18n";
import ConfirmDialog from "@/components/ConfirmDialog";

const t = useTranslate();

<ConfirmDialog
	open={open}
	onOpenChange={setOpen}
	title={t("memo.delete-confirm")}
	description={t("memo.delete-confirm-description")}
	confirmLabel={t("common.delete")}
	cancelLabel={t("common.cancel")}
	onConfirm={handleDelete}
	confirmVariant="destructive"
/>;
```

### With Markdown Description & Interpolation
```tsx
<ConfirmDialog
	open={open}
	onOpenChange={setOpen}
	title={t("setting.shortcut.delete-confirm")}
	descriptionMarkdown={t("setting.shortcut.delete-confirm-markdown", { title: shortcut.title })}
	confirmLabel={t("common.delete")}
	cancelLabel={t("common.cancel")}
	onConfirm={deleteShortcut}
	confirmVariant="destructive"
/>;
```

## Props

| Prop | Type | Required | Acceptable Values |
|------|------|----------|------------------|
| `open` | `boolean` | Yes | `true` (visible) / `false` (hidden) |
| `onOpenChange` | `(open: boolean) => void` | Yes | Callback receiving next state; should update parent state |
| `title` | `React.ReactNode` | Yes | Short localized action summary (text / node) |
| `description` | `React.ReactNode` | No | Plain content; ignored if `descriptionMarkdown` provided |
| `descriptionMarkdown` | `string` | No | Localized Markdown string (sanitized) |
| `confirmLabel` | `string` | Yes | Non-empty localized action text (1–2 words) |
| `cancelLabel` | `string` | Yes | Localized cancel label |
| `onConfirm` | `() => void \| Promise<void>` | Yes | Sync or async handler; resolve = close, reject = stay open |
| `confirmVariant` | `"default" \| "destructive"` | No | Defaults to `"default"`; use `"destructive"` for irreversible actions |

## Benefits vs Previous Implementation

### Before (window.confirm / ad‑hoc dialogs)
- Blocking native prompt, inconsistent styling
- No async progress handling
- No Markdown / rich formatting
- Hard to localize consistently

### After (ConfirmDialog)
- Unified styling + accessibility semantics
- Async-safe with loading state shielding
- Markdown or plain description flexibility
- i18n-first via externalized labels

## Technical Implementation Details

### Async Handling
```tsx
const handleConfirm = async () => {
	setLoading(true);
	try {
		await onConfirm(); // resolve -> close
		onOpenChange(false);
	} catch (e) {
		console.error(e); // remain open for retry
	} finally {
		setLoading(false);
	}
};
```

### Markdown Sanitization
```tsx
const descriptionHtml = descriptionMarkdown
	? DOMPurify.sanitize(String(marked.parse(descriptionMarkdown)))
	: null;
```

### Close Guard
```tsx
<Dialog open={open} onOpenChange={(next) => !loading && onOpenChange(next)} />
```

## Browser / Environment Support
- Works anywhere the existing `Dialog` primitives work (modern browsers)
- Requires DOM for Markdown + sanitization (not SSR executed unless guarded)
- No ResizeObserver / layout dependencies

## Performance Considerations
1. Markdown parse + sanitize runs only when `descriptionMarkdown` changes
2. Minimal renders: loading state toggles once per confirm attempt
3. No portal churn—relies on underlying dialog infra

## Future Enhancements
1. Severity icon / header accent
2. Auto-focus destructive button toggle
3. Secondary action (e.g. "Archive" vs "Delete")
4. Built-in retry / error slot
5. Optional checkbox confirmation ("I understand the consequences")
6. Motion/animation tokens integration

## Styling
The `ConfirmDialog.module.scss` file provides a `.container` hook. It currently only hosts a harmless custom property so the stylesheet is non-empty. Add real layout or variant tokens there instead of inline styles.

## Internationalization
All visible strings must come from the translation system. Use `useTranslate()` and pass localized values into props. Separate keys for title/description.

## Error Handling
Errors thrown in `onConfirm` are caught and logged. The dialog stays open so the caller can surface a toast or inline message and allow retry. (Consider routing serious errors to a higher-level handler.)

---

If you extend this component, update this README to keep usage discoverable.
