# Placeholder Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `Empty.tsx` with a reusable `<Placeholder>` component covering empty / loading / noResults / notFound states, each rendering a hand-curated ASCII bird from a pool-shaped data file with subtle CSS-only animation.

**Architecture:** Single component (`Placeholder/index.tsx`) reads from a co-located `ascii-pool.ts` data file via a `pickPiece(variant)` picker. Motion is CSS keyframes in `Placeholder.css`, gated by `prefers-reduced-motion`. Default messages live in a `messages.ts` seam ready for future i18n. Integration is narrow: only `Inboxes.tsx` is rewired in this PR; `Empty.tsx` is deleted.

**Tech Stack:** React 19 · TypeScript · Tailwind v4 (via `@tailwindcss/vite`) · Vitest + `@testing-library/react` + jsdom · Biome for lint/format · `cn` helper from `@/lib/utils` for class composition.

---

## File Structure

**Create:**
- `web/src/components/Placeholder/index.tsx` — public component (default export)
- `web/src/components/Placeholder/Placeholder.css` — keyframes + motion classes
- `web/src/components/Placeholder/ascii-pool.ts` — types, `ASCII_POOL` array, `pickPiece()`
- `web/src/components/Placeholder/messages.ts` — `DEFAULT_MESSAGES` map
- `web/src/components/Placeholder/CREDITS.md` — Joan Stark attribution
- `web/tests/placeholder-pool.test.ts` — picker + pool integrity tests
- `web/tests/placeholder-component.test.tsx` — component render tests

**Modify:**
- `web/src/pages/Inboxes.tsx` — replace `<Empty />` with `<Placeholder variant="empty" message={…} />`

**Delete:**
- `web/src/components/Empty.tsx`

---

## Task 0: Commit this plan

**Files:**
- Add: `docs/superpowers/plans/2026-05-12-placeholder-component.md`

- [ ] **Step 1: Commit the plan document on its own**

```bash
git add docs/superpowers/plans/2026-05-12-placeholder-component.md
git commit -m "docs: add Placeholder component implementation plan"
```

This keeps the planning artifact separate from feature commits.

---

## Task 1: Scaffold pool types and picker (TDD)

**Files:**
- Create: `web/src/components/Placeholder/ascii-pool.ts`
- Test: `web/tests/placeholder-pool.test.ts`

- [ ] **Step 1: Write the failing tests for `pickPiece` and pool shape**

Create `web/tests/placeholder-pool.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ASCII_POOL, pickPiece, type PlaceholderVariant } from "@/components/Placeholder/ascii-pool";

const VARIANTS: PlaceholderVariant[] = ["empty", "loading", "noResults", "notFound"];

describe("ASCII_POOL integrity", () => {
  it("contains at least one piece per variant", () => {
    for (const variant of VARIANTS) {
      const matches = ASCII_POOL.filter((p) => p.variant === variant);
      expect(matches.length, `variant=${variant}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("uses unique ids", () => {
    const ids = ASCII_POOL.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("preserves the jgs credit on every piece", () => {
    for (const piece of ASCII_POOL) {
      expect(piece.credit, `piece=${piece.id}`).toMatch(/jgs/);
    }
  });

  it("uses a known motion style on every piece", () => {
    for (const piece of ASCII_POOL) {
      expect(["bob", "flutter", "none"]).toContain(piece.motion);
    }
  });
});

describe("pickPiece", () => {
  it("returns a piece matching the requested variant", () => {
    for (const variant of VARIANTS) {
      const piece = pickPiece(variant);
      expect(piece.variant).toBe(variant);
    }
  });

  it("returns a non-empty ascii string", () => {
    const piece = pickPiece("empty");
    expect(piece.ascii.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd web && pnpm test placeholder-pool
```

Expected: FAIL — module `@/components/Placeholder/ascii-pool` not found.

- [ ] **Step 3: Implement `ascii-pool.ts` with types, an empty pool, and the picker**

Create `web/src/components/Placeholder/ascii-pool.ts`:

```ts
export type PlaceholderVariant = "empty" | "loading" | "noResults" | "notFound";

export type MotionStyle = "bob" | "flutter" | "none";

export interface AsciiPiece {
  /** Stable identifier — used as React key and for debugging. */
  id: string;
  /** Which placeholder state this piece is shown for. */
  variant: PlaceholderVariant;
  /** ASCII art preserved verbatim — must keep every space. */
  ascii: string;
  /** Attribution shown beneath the bird, e.g. "jgs · 4/97". */
  credit: string;
  /** Motion hint applied to the <pre>. */
  motion: MotionStyle;
}

export const ASCII_POOL: AsciiPiece[] = [];

export function pickPiece(variant: PlaceholderVariant): AsciiPiece {
  const matches = ASCII_POOL.filter((p) => p.variant === variant);
  if (matches.length === 0) {
    throw new Error(`No ASCII piece registered for variant "${variant}"`);
  }
  return matches[Math.floor(Math.random() * matches.length)];
}
```

- [ ] **Step 4: Run the tests and verify they still fail (pool is empty)**

```bash
cd web && pnpm test placeholder-pool
```

Expected: FAIL — "contains at least one piece per variant" expectations not met (because `ASCII_POOL` is `[]`).

This is the expected red — pool gets seeded in the next task.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Placeholder/ascii-pool.ts web/tests/placeholder-pool.test.ts
git commit -m "feat(placeholder): scaffold ASCII pool types and picker"
```

---

## Task 2: Seed the four ASCII pieces

**Files:**
- Modify: `web/src/components/Placeholder/ascii-pool.ts`

- [ ] **Step 1: Replace the empty `ASCII_POOL` array with the four seed entries**

In `web/src/components/Placeholder/ascii-pool.ts`, replace `export const ASCII_POOL: AsciiPiece[] = [];` with the four entries below. Preserve every space and newline in the `ascii` strings exactly — they are template literals with escaped backslashes/backticks per JS rules.

```ts
export const ASCII_POOL: AsciiPiece[] = [
  {
    id: "jgs-crested-parrot",
    variant: "empty",
    credit: "jgs · 4/97",
    motion: "bob",
    ascii: `       .---.
      /   6_6
      \\_  (__\\
      //   \\\\
     ((     ))
=====""===""=====
        |||
         |`,
  },
  {
    id: "jgs-hummingbird-sm",
    variant: "loading",
    credit: "jgs · 7/98",
    motion: "flutter",
    ascii: `           ,   _
          { \\/\`o;====-
     .----'-/\`-/
      \`'-..-| /
            /\\/\\
            \`--\``,
  },
  {
    id: "jgs-wide-eyed-owl",
    variant: "noResults",
    credit: "jgs · 2/01",
    motion: "bob",
    ascii: `      __       __
      \\ \`-'"'-\` /
      / \\_   _/ \\
      |  d\\_/b  |
     .'\\   V   /'.
    /   '-...-'   \\
    | /         \\ |
    \\/\\         /\\/
    ==(||)---(||)==`,
  },
  {
    id: "jgs-bird-flown-away",
    variant: "notFound",
    credit: "jgs · 7/96",
    motion: "flutter",
    ascii: `                      ___
                  _,-' ______
                .'  .-'  ____7
               /   /   ___7
             _|   /  ___7
           >(')\\ | ___7
             \\\\/     \\_______
             '        _======>
             \`'----\\\\\``,
  },
];
```

- [ ] **Step 2: Run the pool tests and verify they pass**

```bash
cd web && pnpm test placeholder-pool
```

Expected: PASS for all six assertions.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Placeholder/ascii-pool.ts
git commit -m "feat(placeholder): seed pool with four jgs ASCII bird pieces"
```

---

## Task 3: Default messages

**Files:**
- Create: `web/src/components/Placeholder/messages.ts`

- [ ] **Step 1: Add a tiny test for the messages map**

Append to `web/tests/placeholder-pool.test.ts`:

```ts
import { DEFAULT_MESSAGES } from "@/components/Placeholder/messages";

describe("DEFAULT_MESSAGES", () => {
  it("provides a non-empty message for every variant", () => {
    for (const variant of VARIANTS) {
      expect(DEFAULT_MESSAGES[variant], `variant=${variant}`).toBeTruthy();
      expect(DEFAULT_MESSAGES[variant].trim().length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd web && pnpm test placeholder-pool
```

Expected: FAIL — module `@/components/Placeholder/messages` not found.

- [ ] **Step 3: Create `messages.ts`**

```ts
import type { PlaceholderVariant } from "./ascii-pool";

/**
 * Default copy shown beneath the ASCII art when no `message` prop is supplied.
 *
 * Future i18n: swap these strings for `t("placeholder.<variant>")` lookups via
 * `react-i18next` without touching the component.
 */
export const DEFAULT_MESSAGES: Record<PlaceholderVariant, string> = {
  empty: "No memos yet",
  loading: "Loading…",
  noResults: "Nothing matches that search",
  notFound: "This page flew the coop",
};
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
cd web && pnpm test placeholder-pool
```

Expected: PASS — all variants have a non-empty default message.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Placeholder/messages.ts web/tests/placeholder-pool.test.ts
git commit -m "feat(placeholder): add DEFAULT_MESSAGES map"
```

---

## Task 4: Animation keyframes

**Files:**
- Create: `web/src/components/Placeholder/Placeholder.css`

- [ ] **Step 1: Create the stylesheet**

```css
/*
 * Animations for <Placeholder>.
 *
 * All keyframes are wrapped in a prefers-reduced-motion guard so users who
 * opt out of motion see a static bird and an instantly-visible message.
 */

@media (prefers-reduced-motion: no-preference) {
  .placeholder-motion-bob {
    animation: placeholder-bob 3.4s ease-in-out infinite;
  }

  .placeholder-motion-flutter {
    animation: placeholder-flutter 0.7s ease-in-out infinite;
  }

  .placeholder-fade-in {
    animation: placeholder-fade 1s ease-out 0.3s both;
    opacity: 0;
  }
}

@keyframes placeholder-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}

@keyframes placeholder-flutter {
  0%, 100% { transform: translate(0, 0); }
  50%      { transform: translate(2px, -1px); }
}

@keyframes placeholder-fade {
  to { opacity: 1; }
}
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/Placeholder/Placeholder.css
git commit -m "feat(placeholder): add motion keyframes with reduced-motion guard"
```

---

## Task 5: Placeholder component (TDD)

**Files:**
- Create: `web/src/components/Placeholder/index.tsx`
- Test: `web/tests/placeholder-component.test.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `web/tests/placeholder-component.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Placeholder from "@/components/Placeholder";
import { DEFAULT_MESSAGES } from "@/components/Placeholder/messages";

describe("<Placeholder>", () => {
  it("renders the default message for variant=empty", () => {
    render(<Placeholder variant="empty" />);
    expect(screen.getByText(DEFAULT_MESSAGES.empty)).toBeInTheDocument();
  });

  it("renders the default message for variant=loading", () => {
    render(<Placeholder variant="loading" />);
    expect(screen.getByText(DEFAULT_MESSAGES.loading)).toBeInTheDocument();
  });

  it("renders the default message for variant=noResults", () => {
    render(<Placeholder variant="noResults" />);
    expect(screen.getByText(DEFAULT_MESSAGES.noResults)).toBeInTheDocument();
  });

  it("renders the default message for variant=notFound", () => {
    render(<Placeholder variant="notFound" />);
    expect(screen.getByText(DEFAULT_MESSAGES.notFound)).toBeInTheDocument();
  });

  it("overrides the default message when `message` prop is passed", () => {
    render(<Placeholder variant="empty" message="Custom copy goes here" />);
    expect(screen.getByText("Custom copy goes here")).toBeInTheDocument();
    expect(screen.queryByText(DEFAULT_MESSAGES.empty)).not.toBeInTheDocument();
  });

  it("renders the ASCII art inside a <pre> with aria-hidden", () => {
    const { container } = render(<Placeholder variant="empty" />);
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre).toHaveAttribute("aria-hidden", "true");
    expect(pre!.textContent!.length).toBeGreaterThan(0);
  });

  it("renders a jgs credit string", () => {
    render(<Placeholder variant="empty" />);
    expect(screen.getByText(/jgs/)).toBeInTheDocument();
  });

  it('applies role="status" and aria-live="polite" ONLY when variant=loading', () => {
    const { rerender, container } = render(<Placeholder variant="empty" />);
    expect(container.querySelector('[role="status"]')).toBeNull();

    rerender(<Placeholder variant="loading" />);
    const live = container.querySelector('[role="status"]');
    expect(live).not.toBeNull();
    expect(live).toHaveAttribute("aria-live", "polite");
  });

  it("renders children below the message when provided", () => {
    render(
      <Placeholder variant="notFound">
        <button type="button">Go home</button>
      </Placeholder>,
    );
    expect(screen.getByRole("button", { name: "Go home" })).toBeInTheDocument();
  });

  it("merges a custom className onto the outer wrapper", () => {
    const { container } = render(<Placeholder variant="empty" className="custom-test-class" />);
    expect(container.firstChild).toHaveClass("custom-test-class");
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd web && pnpm test placeholder-component
```

Expected: FAIL — module `@/components/Placeholder` not found.

- [ ] **Step 3: Implement `index.tsx`**

Create `web/src/components/Placeholder/index.tsx`:

```tsx
import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { pickPiece, type MotionStyle, type PlaceholderVariant } from "./ascii-pool";
import { DEFAULT_MESSAGES } from "./messages";
import "./Placeholder.css";

interface PlaceholderProps {
  variant: PlaceholderVariant;
  message?: string;
  children?: ReactNode;
  className?: string;
}

const MOTION_CLASS: Record<MotionStyle, string> = {
  bob: "placeholder-motion-bob",
  flutter: "placeholder-motion-flutter",
  none: "",
};

const Placeholder = ({ variant, message, children, className }: PlaceholderProps) => {
  // Stable for the lifetime of this mount; re-rolls only if `variant` changes
  // (which is rare in practice — most callers pass a constant).
  const piece = useMemo(() => pickPiece(variant), [variant]);
  const resolvedMessage = message ?? DEFAULT_MESSAGES[variant];
  const isLoading = variant === "loading";

  return (
    <div
      role={isLoading ? "status" : undefined}
      aria-live={isLoading ? "polite" : undefined}
      className={cn("flex flex-col items-center justify-center max-w-md mx-auto px-4 py-8", className)}
    >
      <pre
        aria-hidden="true"
        className={cn(
          "font-mono text-xs sm:text-sm leading-tight text-muted-foreground whitespace-pre m-0",
          MOTION_CLASS[piece.motion],
        )}
      >
        {piece.ascii}
      </pre>
      <p className="mt-3 font-mono text-sm text-muted-foreground placeholder-fade-in">
        {resolvedMessage}
      </p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground/60 placeholder-fade-in">
        {piece.credit}
      </p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
};

export default Placeholder;
```

- [ ] **Step 4: Run the tests and verify they pass**

```bash
cd web && pnpm test placeholder-component
```

Expected: PASS — all ten assertions green.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Placeholder/index.tsx web/tests/placeholder-component.test.tsx
git commit -m "feat(placeholder): implement <Placeholder> with variant-driven ASCII pool"
```

---

## Task 6: Attribution credits

**Files:**
- Create: `web/src/components/Placeholder/CREDITS.md`

- [ ] **Step 1: Create `CREDITS.md`**

```markdown
# ASCII Art Credits

The ASCII bird illustrations rendered by `<Placeholder>` are from **Joan Stark's**
classic ASCII art collection. Each piece is signed with her `jgs` tag and the
month/year it was published.

- Source archive: https://github.com/oldcompcz/jgs (Joan Stark's ASCII Art Gallery)
- Original site (preserved via WebArchive): https://web.archive.org/web/20091028013825/http://www.geocities.com/SoHo/7373/
- Wikipedia: https://en.wikipedia.org/wiki/Joan_Stark

Joan Stark distributed her art freely on Usenet and the early web. We retain
the `jgs` signature visible beneath each piece in the UI so attribution travels
with the art wherever it is shown.

If you add new ASCII pieces to `ascii-pool.ts`:

- Prefer well-attributed art from established collections.
- Keep the original artist signature in the `credit` field (e.g. `"jgs · 4/97"`).
- If using a different artist, link the source in this file.
```

- [ ] **Step 2: Commit**

```bash
git add web/src/components/Placeholder/CREDITS.md
git commit -m "docs(placeholder): credit Joan Stark for ASCII bird art"
```

---

## Task 7: Wire into `Inboxes.tsx` and delete `Empty.tsx`

**Files:**
- Modify: `web/src/pages/Inboxes.tsx`
- Delete: `web/src/components/Empty.tsx`

- [ ] **Step 1: Read the current empty-state block in `Inboxes.tsx`**

Open `web/src/pages/Inboxes.tsx`. The relevant block is at lines 99–105:

```tsx
{notifications.length === 0 ? (
  <div className="w-full py-16 flex flex-col justify-center items-center">
    <Empty />
    <p className="mt-4 text-sm text-muted-foreground">
      {filter === "unread" ? t("inbox.no-unread") : filter === "archived" ? t("inbox.no-archived") : t("message.no-data")}
    </p>
  </div>
) : (
```

The outer `<div className="w-full py-16 flex flex-col justify-center items-center">` and the inner `<p>` both become redundant — `<Placeholder>` handles its own centering and message.

- [ ] **Step 2: Swap the import**

In `web/src/pages/Inboxes.tsx`, replace the import line:

```tsx
import Empty from "@/components/Empty";
```

with:

```tsx
import Placeholder from "@/components/Placeholder";
```

- [ ] **Step 3: Replace the empty-state JSX**

Replace lines 99–105 (the existing empty-state block above) with:

```tsx
{notifications.length === 0 ? (
  <Placeholder
    variant="empty"
    message={
      filter === "unread"
        ? t("inbox.no-unread")
        : filter === "archived"
          ? t("inbox.no-archived")
          : t("message.no-data")
    }
  />
) : (
```

(Only the truthy branch of the ternary changes; leave the `: (` start of the falsy branch and everything below it untouched.)

- [ ] **Step 4: Delete `Empty.tsx`**

```bash
git rm web/src/components/Empty.tsx
```

- [ ] **Step 5: Verify nothing else imports `Empty`**

```bash
cd /Users/steven/Projects/usememos/memos && grep -rn 'from "@/components/Empty"\|from "./Empty"\|from "../Empty"' web/src 2>/dev/null
```

Expected: no output. If anything matches, update that file to use `<Placeholder variant="empty" />` before continuing.

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/Inboxes.tsx web/src/components/Empty.tsx
git commit -m "feat(inboxes): use <Placeholder variant=empty> in place of <Empty>"
```

---

## Task 8: Verification — lint, types, tests, build, dev preview

**Files:** none modified (verification only)

- [ ] **Step 1: Run the lint + typecheck**

```bash
cd web && pnpm lint
```

Expected: exits 0. If Biome flags anything (formatting, sort-order, unused imports), run `pnpm lint:fix` and re-run `pnpm lint`. Commit the fix separately if any changes are required:

```bash
git add -p web/src web/tests
git commit -m "chore(placeholder): biome auto-fixes"
```

- [ ] **Step 2: Run the full test suite**

```bash
cd web && pnpm test
```

Expected: all suites green, including `placeholder-pool` (8 assertions) and `placeholder-component` (10 assertions). Existing tests must still pass.

- [ ] **Step 3: Run the production build**

```bash
cd web && pnpm build
```

Expected: exits 0. Confirms TypeScript still compiles end-to-end and the new CSS import is picked up by Vite.

- [ ] **Step 4: Manual visual check — start the dev server**

```bash
cd web && pnpm dev
```

In a browser, navigate to the running URL (Vite prints it). Sign in with any test account, open the **Inbox** page, and confirm:

1. When inbox is empty, the crested-parrot ASCII bird is visible.
2. It bobs gently every ~3.4 seconds.
3. The message text (one of "no unread", "no archived", or "no data") appears below with a soft fade-in.
4. The small `jgs · 4/97` credit is visible below the message.
5. No console errors or warnings.

Stop the dev server with `Ctrl+C`.

- [ ] **Step 5: (Optional) Reduced-motion check**

Open browser DevTools → command menu → "Emulate CSS prefers-reduced-motion: reduce". Reload the inbox empty state. The bird should be **static** and the message should appear instantly (no fade).

- [ ] **Step 6: No-op commit point**

If steps 1–4 all passed and no further changes were needed, there is nothing to commit. Proceed to the next task.

---

## Task 9: Document the work in the PR body

**Files:** none modified

- [ ] **Step 1: Draft a PR description**

When opening the PR, use a body like:

```markdown
## Summary

- Adds a new `<Placeholder variant="empty | loading | noResults | notFound">` component that renders a hand-curated ASCII bird from a pool-shaped data file, with subtle CSS-only motion that respects `prefers-reduced-motion`.
- Replaces the single-purpose `Empty.tsx` (used in `Inboxes.tsx`) with `<Placeholder variant="empty">`.
- ASCII art is from Joan Stark's (jgs) classic collection — attribution is preserved on every piece and in a co-located `CREDITS.md`.

## Out of scope (follow-up opportunities)

- Wire `<Placeholder variant="noResults">` into the memo search results page.
- Wire `<Placeholder variant="notFound">` into the router 404 catch-all.
- Wire `<Placeholder variant="loading">` into Suspense fallbacks.
- Seed additional ASCII pieces per variant — the pool architecture supports it; just append entries to `ASCII_POOL`.

## Test plan

- [ ] `pnpm lint` clean
- [ ] `pnpm test` green (incl. new `placeholder-pool` and `placeholder-component` suites)
- [ ] `pnpm build` succeeds
- [ ] Inbox empty state shows the ASCII parrot, bobs, and renders the filter-specific message
- [ ] `prefers-reduced-motion: reduce` produces a static bird and an instantly-visible message
```

- [ ] **Step 2: Open the PR** (skip if user prefers to do this themselves)

This step is left as a manual handoff — do not push or open the PR unless the user has explicitly authorized it.

---

## Self-Review Notes

This plan covers the spec's nine sections as follows:

| Spec section | Implemented by |
|---|---|
| Public Component | Task 5 |
| ASCII Pool | Tasks 1, 2 |
| Default Messages | Task 3 |
| Animation | Task 4 (CSS) + Task 5 (component wires classes) |
| Accessibility | Task 5 (test assertions + impl) |
| File Layout | Tasks 1–6 (all five files created) |
| Integration | Task 7 (Inboxes rewire + Empty delete) |
| Credits | Task 6 |
| Testing | Tasks 1, 3, 5 (pool tests + component tests) |

No spec section is unimplemented. No "TBD" / "TODO" / vague-handwave language is used in any step. Types, method signatures, and class names referenced across tasks match:

- `PlaceholderVariant`, `MotionStyle`, `AsciiPiece`, `ASCII_POOL`, `pickPiece` — consistent across Tasks 1, 2, 3, 5
- `DEFAULT_MESSAGES` — defined in Task 3, consumed in Task 5
- `placeholder-motion-bob`, `placeholder-motion-flutter`, `placeholder-fade-in` — defined in Task 4 CSS, consumed in Task 5 component
- `cn` from `@/lib/utils` — matches existing codebase convention (verified in pre-plan exploration)
- `Placeholder` is a default export — matches the convention used by `Empty.tsx` and most other `web/src/components/*.tsx` files
