# Markup: first release

Status: Implemented in 26.11.1

Date: 2026-11-15

Related: [MemoEditor](../../web/src/components/MemoEditor/README.md),
[Canvas product definition](https://github.com/usememos/canvas/blob/main/docs/product-definition.md),
[Canvas checkpoint contract](https://github.com/usememos/canvas/blob/main/docs/recovery-checkpoints.md).

## Decision and scope

Markup lets someone sketch an idea or mark a detail in an image, then attach the result to a memo. The first release completes
these actions and keeps the interface small. Use **Markup** (Chinese: **标注**) with Lucide's **Palette** icon. Canvas remains the
library name; the editable PNG format and existing resource names do not change.

Memos draft recovery is deferred. Do not add IndexedDB persistence, recovery notices, Continue markup, or a draft-management UI.
An unfinished markup must not disable the containing memo's save. Canvas 26.11.3 retains its checkpoint capability for a future
integration, but this release does not expose a Memos markup draft.

Keep one primary action and let the current context carry its meaning. Do not add a permanent More, Download or Discard menu,
status rows, or routine success copy.

## Critical user journeys

### Sketch and add

The editor's insert menu offers Palette + Markup. It opens a blank drawing. **Add** exports an editable `.canvas.png` into the
current memo's pending attachments. The memo's existing Save uploads it. Adding explanatory text is optional.

### Annotate an image

An ordinary local or instance-hosted image offers Palette + Markup. Saved image previews offer it when the current user can edit
the memo. External images, motion-photo/video groups, standalone attachment-library editing, and replacing inline image references
are outside this release.

Load the original file, never the thumbnail. Prevent duplicate opens, abort a dismissed load, and ignore late responses. A failed import keeps the source available and must not produce an apparently editable blank sheet. Fetching an existing attachment in the viewer shows a centered spinner before its canvas mounts; preparing a background image uses the existing primary action's spinner. Viewer fetch failures close the loading surface and show an error toast. Background preparation failures disable drawing and submission, with an error toast and a labeled retry icon whose tooltip explains the failure.

Insert the image as a locked background, then call `setScene(getScene())` to establish a clean baseline and clear its insertion
undo step. `markSaved()` alone would leave Undo able to remove the background. Fit the image and start with red ink from the
existing palette. Keep the library's 1440 px import cap and opaque-image JPEG policy; this is not full-resolution image editing.

The first annotation is a new editable PNG immediately after its source. Keep the original's bytes, identity and position. The PNG
embeds its background, so subsequent edits do not require the source to remain available.

Inside an editor, **Add** joins the pending files. From a saved image preview, **Save copy** uploads and binds the annotation to
that memo. Read current membership before binding or retrying, retain other attachments, and stop if the source has disappeared.
Do not open a separate composer or save unrelated edits.

### Edit and save

Existing editable PNGs offer **Edit markup**. In the editor, **Save** updates the pending drawing; an owned saved attachment queues a
replacement for the outer memo save. A file the user cannot replace remains intact and the result becomes a copy. In a saved
markup viewer, **Save** replaces the owned attachment and updates the memo; **Save copy** retains an attachment the user cannot
replace. Existing permission and upload APIs remain authoritative.

## Actions and exceptions

| Context | Primary action |
| --- | --- |
| New sketch or first annotation in the editor | Add |
| Edit a pending drawing or queue an owned attachment replacement | Save |
| Edit an owned drawing directly from its viewer | Save |
| Direct image annotation or a direct edit requiring a new attachment | Save copy |

Use the same short translated labels on loading buttons. Do not repeat the destination in the visible text. Existing attachment
New/Edited treatment identifies pending work in the composer. Export, adding a file to the editor, and server acceptance remain
separate implementation states; normal states add no copy to the canvas.

Freeze the engine with `setReadOnly(true)` before export/submission. Block repeated submissions, scene replacement and editing
until the result is known. Acknowledge with `markSaved()` only after the host accepts, while still frozen. On failure retain the
scene and resume editing; after an acknowledged upload with a failed bind/timestamp, keep that revision frozen and retry only the
remaining operation. Surface partial failure with an exception icon/tooltip and the existing error toast. No overall Saved claim
until every required request is acknowledged.

Close unchanged work directly. Close changed work through a discard confirmation, with **Keep drawing** and **Discard**. This is
the only ordinary discard action; it appears when the user is about to lose unsaved changes. Do not close during a server write.
This release retains unsuccessful work in memory while the sheet is open; it does not claim recovery after reload or closure.

## Shared viewing and editing surface

Viewing and editing are modes of one Markup surface. Keep the same dialog, paper, canvas instance and control sizes when switching modes. Entering edit must preserve the visible content, pan and zoom; saving or closing unchanged edits returns to the same view. Discard restores the accepted scene and may fit it again. Do not mount a second dialog or measure a new canvas while the previous dialog is closing.

The top row is the same in both modes: a quiet X at the left and the current action at the right. The viewing action is Palette + **Edit** when permitted; editing replaces it with **Add**, **Save** or **Save copy**. Use no bordered container around these actions and no visible mode heading. The accessible dialog name remains Markup; icon labels and tooltips explain secondary actions. Viewing exposes no editing controls or save status.

Canvas navigation is separate from closing or saving. Display the current zoom as a rounded percentage (for example **100%**) on a ghost button that opens an upward action menu. Place it at the bottom left on desktop and above the bottom tools bar on phones, accounting for the safe area. Keep the same position in viewing and editing, including the space above the phone's tools bar when that bar is absent. Its idle state has no fill or bordered container. The percentage stays synchronized with menu actions, wheel/trackpad zoom, touch pinches, initial fitting and background-image preparation; changing zoom never makes the drawing dirty.

The menu contains **Zoom in**, **Zoom out**, a separator, **Zoom to fit** and **Reset zoom** (100%). Use Plus, Minus, ScanSearch and RotateCcw icons, respectively. The percentage replaces the standalone Fit button; names appear only in the menu and accessible label. Keep the same menu and actions in viewing and editing. Use the package's md Menu, retain focus in the dialog and let Escape dismiss the menu before affecting the drawing. Suspend canvas input while the menu is open so clicking the paper dismisses it without drawing or panning. Do not add selection zoom or a minimap in this first release. This follows Excalidraw's [zoom-to-fit magnifier and area icon](https://github.com/excalidraw/excalidraw/blob/master/packages/excalidraw/components/icons.tsx) and tldraw's [separate canvas navigation region](https://tldraw.dev/sdk-features/ui-components).

Editing adds the existing bordered tools bar at the top center on desktop and at the bottom on phones. Available phone Undo/Redo controls follow X as plain ghost icons; they have no separate container and unavailable history actions are omitted. Desktop history and image insertion stay in the editing tools bar. Do not add controls or permanent status text to make the two modes match.

Keep focus inside the dialog across mode changes: entering edit focuses the canvas; returning to view focuses Edit, or the canvas when Edit is unavailable. After a phone history action, focus returns to the canvas rather than a removed control. Close follows the existing unchanged/discard behavior.

## Retry and concurrency

Keep acknowledged uploads in memory. A copy whose bind failed is bound again without another upload. A replacement whose timestamp
update failed retries the memo update. If memo text saved before a replacement failed, keep the replacement pending and say which
part needs retry. Re-read membership for list-changing retries so another tab's attachment is retained. API calls are not an atomic
cross-resource transaction and an unacknowledged response does not provide an exactly-once guarantee.

## Ownership and verification

Canvas owns drawing, text input, scene serialization, locked backgrounds and editable PNG export. Memos owns the shell, strings,
permissions, placement and save orchestration. Pin `@usememos/canvas@26.11.3`; no backend schema or release workflow changes.

Extend neighboring drawing, viewer, image-preview, attachment-placement and memo-save tests. The browser suite exercises actual
Canvas image preparation, annotation/export, original preservation and 360px controls. Cover viewing an existing drawing, entering edit, retaining visible content and viewport, returning without changes, discarding changes, saving, repeated mode changes and keyboard focus on desktop and phones. Check the zoom percentage's identical lower-left position in both modes, clearance above the phone tools bar, live zoom updates and all four menu actions in both modes, including keyboard dismissal and zoom without scene changes. It uses an isolated Vite server and cache;
Playwright is a development dependency only.

From `web/`, run `pnpm lint`, `pnpm test`, `pnpm build`, and `pnpm test:drawings` (`pnpm exec playwright install chromium` once).
Browser emulation does not establish real-device pen, keyboard or mobile suspension behavior.

## Deferred recovery

A later Memos integration can use Canvas `getCheckpoint()`, `restoreCheckpoint()` and `onCheckpoint`. It needs a separate product
decision for discovering unfinished work, retaining companion text/files and upload progress, account/session identity, conflicts,
storage failures and cleanup. Do not reintroduce that UI as part of this first release.
