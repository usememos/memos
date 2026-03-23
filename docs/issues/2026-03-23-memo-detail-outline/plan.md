## Task List

T1: Add heading extraction utility [S] — T2: Add slug IDs to Heading component [S] — T3: Create MemoOutline sidebar component [M] — T4: Integrate outline into MemoDetailSidebar [S]

### T1: Add heading extraction utility [S]

**Objective**: Provide a function to extract h1–h4 headings from markdown content with slugified IDs, reusing the existing MDAST parsing pattern from `markdown-manipulation.ts`.
**Files**: `web/src/utils/markdown-manipulation.ts`
**Implementation**: Add `HeadingItem` interface (text, level, slug) and `extractHeadings(markdown: string): HeadingItem[]` function. Use existing `fromMarkdown()` + `visit()` pattern. Visit `"heading"` nodes with depth 1–4, extract text from children, generate slug via `slugify()` helper (lowercase, replace non-alphanumeric with hyphens, deduplicate). Export both.
**Validation**: `cd web && pnpm lint` — no new errors

### T2: Add slug IDs to Heading component [S]

**Objective**: Generate deterministic `id` attributes on h1–h6 elements so outline links can scroll to them via `#hash`.
**Files**: `web/src/components/MemoContent/markdown/Heading.tsx`
**Implementation**: In `Heading` (~line 13), extract text from `children` using a `getTextContent(children)` helper that recursively extracts string content from React children. Generate slug with the same `slugify` logic. Apply `id={slug}` to the rendered `<Component>`.
**Validation**: `cd web && pnpm lint` — no new errors

### T3: Create MemoOutline sidebar component [M]

**Objective**: Create a modern, Claude/Linear-style outline component that renders h1–h4 headings as anchor links with indentation by level.
**Size**: M (new component file, modern styling)
**Files**:
- Create: `web/src/components/MemoDetailSidebar/MemoOutline.tsx`
**Implementation**:
1. Props: `{ headings: HeadingItem[] }` from `markdown-manipulation.ts`
2. Render a `<nav>` with vertical list of `<a href="#slug">` links
3. Styling per level: h1 no indent, h2 `pl-3`, h3 `pl-6`, h4 `pl-9`. Text size: h1 `text-[13px] font-medium`, h2–h4 `text-[13px] font-normal`. Color: `text-muted-foreground` with `hover:text-foreground` transition. Left border accent line (2px) along the nav. Smooth scroll on click via `scrollIntoView`.
4. Each link: `block py-1 truncate transition-colors` with level-based indentation
**Boundaries**: No scroll-spy / active state tracking. No mobile drawer integration.
**Dependencies**: T1
**Expected Outcome**: Component renders a clean, modern outline navigation.
**Validation**: `cd web && pnpm lint` — no new errors

### T4: Integrate outline into MemoDetailSidebar [S]

**Objective**: Add the outline section as the first section in `MemoDetailSidebar`, shown only when headings exist.
**Files**: `web/src/components/MemoDetailSidebar/MemoDetailSidebar.tsx`
**Implementation**: Import `extractHeadings` and `MemoOutline`. In `MemoDetailSidebar` (~line 48), compute `headings = useMemo(() => extractHeadings(memo.content), [memo.content])`. Before the Share section (~line 58), add conditional: `{headings.length > 0 && <SidebarSection label="Outline"><MemoOutline headings={headings} /></SidebarSection>}`.
**Validation**: `cd web && pnpm lint && pnpm build` — no errors

## Out-of-Scope Tasks

- Scroll-spy / active heading highlighting in the outline
- Mobile drawer outline support
- Outline in memo list view (compact mode)
- Changing existing heading visual styles in content area
