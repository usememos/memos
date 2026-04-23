## Background & Context

The MemoDetail page (`web/src/pages/MemoDetail.tsx`) renders a memo's full content with a right sidebar (`MemoDetailSidebar`) on desktop. The sidebar currently shows share controls, timestamps, property badges (links, to-do, code), and tags. Memo content is rendered via `react-markdown` with custom heading components (h1–h6) in `MemoContent/markdown/Heading.tsx`. The page already has hash-based scroll-to-element infrastructure for comments (lines 39–43 of MemoDetail.tsx).

## Issue Statement

When viewing a memo with structured headings, there is no outline or table of contents in the MemoDetail sidebar, so readers cannot see the document structure at a glance or jump to specific sections. Heading elements rendered by the `Heading` component do not have `id` attributes, preventing any anchor-based navigation to them.

## Current State

- **`web/src/pages/MemoDetail.tsx`** (93 lines) — MemoDetail page. Hash-based `scrollIntoView` logic exists at lines 39–43 but only targets comment elements. The sidebar is rendered at lines 82–86 as `<MemoDetailSidebar>`.
- **`web/src/components/MemoDetailSidebar/MemoDetailSidebar.tsx`** (109 lines) — Desktop sidebar. Contains sections: Share (lines 58–65), Created-at (lines 67–76), Properties (lines 78–89), Tags (lines 91–102). Uses a reusable `SidebarSection` helper (lines 24–32). No outline section exists.
- **`web/src/components/MemoDetailSidebar/MemoDetailSidebarDrawer.tsx`** (36 lines) — Mobile drawer wrapper for the sidebar.
- **`web/src/components/MemoContent/markdown/Heading.tsx`** (30 lines) — Renders h1–h6 with Tailwind classes. Does not generate `id` attributes on heading elements.
- **`web/src/components/MemoContent/index.tsx`** (157 lines) — ReactMarkdown renderer. Maps h1–h6 to the `Heading` component (lines 72–101). No rehype-slug or equivalent plugin is installed.
- **`web/src/utils/markdown-manipulation.ts`** (143 lines) — Contains `fromMarkdown()` MDAST parsing with GFM extensions. Used for task extraction; no heading extraction exists.

## Non-Goals

- Redesigning the overall MemoDetail layout or sidebar structure beyond adding the outline section.
- Supporting outline for the mobile drawer — the outline section should appear in the desktop sidebar only for now.
- Adding active heading highlighting on scroll (scroll-spy behavior).
- Supporting outline in the memo list/timeline view (compact mode).
- Changing the existing heading visual styles in the content area.

## Open Questions

- Which heading levels to include in the outline? (default: h1–h4, matching user request)
- How to generate slug IDs — install `rehype-slug` or custom implementation? (default: lightweight custom slug generation in the Heading component to avoid a new dependency)
- Should the outline section be hidden when no headings exist? (default: yes, hide entirely like Properties/Tags sections)
- Should duplicate heading text produce unique slugs (e.g. `my-heading`, `my-heading-1`)? (default: yes, append numeric suffix for duplicates)

## Scope

**M** — Touches 3–4 files (Heading component, MemoDetailSidebar, possibly a new outline component, and a slug utility). Existing patterns (SidebarSection, hash scrolling) apply directly. No new subsystem or novel approach required.
