# Placeholder Component Design

## Context

The web frontend currently renders empty states with a single `Empty.tsx` component that displays a lucide `BirdIcon`. It is used in exactly one place (`web/src/pages/Inboxes.tsx`) and offers no support for other state varieties — loading, no-search-results, or 404 pages — each of which is currently handled inconsistently or not at all.

The goal is to replace `Empty.tsx` with a single reusable `<Placeholder>` component that renders a hand-curated ASCII bird illustration plus a short muted message, supports four distinct variants, and ships with the architectural seam needed to grow a randomized pool of ASCII pieces per variant in future work.

The visual register is "cozy and minimal": muted colors, monospace throughout, gentle motion that respects `prefers-reduced-motion`. The ASCII art itself is drawn from Joan Stark's (jgs) classic ASCII bird collection (https://github.com/oldcompcz/jgs), preserving the `jgs` signature and date as a visible credit beneath each piece.

## Goals

- Provide a single `<Placeholder variant="…">` component covering empty, loading, no-results, and 404 states.
- Render real, recognizable ASCII bird art (not freehand sketches), preserving Joan Stark's attribution.
- Apply subtle CSS-only animation (bob for perched birds, flutter for in-flight birds, fade-in on the message).
- Respect `prefers-reduced-motion` — no animation when the user opts out.
- Provide a pool-shaped data file so future PRs can drop in additional ASCII pieces per variant without component changes.
- Replace the existing `Empty.tsx` in `Inboxes.tsx` as the proof of integration.

## Non-Goals

- Adding additional ASCII pieces beyond the four initial picks (one per variant). The pool architecture supports growth, but seeding more pieces is a follow-up.
- Wiring the component into search results, the 404 route, or Suspense fallbacks. Each is a candidate; each is a separate PR.
- Translating the default messages. The file structure leaves a seam for `i18next`, but the initial PR ships plain strings.
- Adding a JS animation library (Framer Motion, react-spring, etc.). Three keyframe animations do not justify a new dependency.
- Visual regression testing infrastructure.

## Recommended Approach

Build a single `<Placeholder>` component with a `variant` prop that selects a randomized ASCII piece from a co-located pool data file. Animation is CSS-only, with motion presets keyed off each piece's `motion` field. Accessibility uses `aria-hidden` on the decorative ASCII and a semantic `<p>` for the message.

This approach has the best balance of present-day simplicity and future extensibility: the initial pool contains one piece per variant, so the component is deterministic today, but the picker function and pool shape impose no constraints on how many pieces are added later.

## Architecture

### Public Component

**Path:** `web/src/components/Placeholder/index.tsx`

```tsx
import { useMemo } from "react";
import clsx from "clsx";
import { pickPiece, MotionStyle, PlaceholderVariant } from "./ascii-pool";
import { DEFAULT_MESSAGES } from "./messages";
import "./Placeholder.css";

interface PlaceholderProps {
  variant: PlaceholderVariant;
  message?: string;
  children?: React.ReactNode;
  className?: string;
}

const MOTION_CLASS: Record<MotionStyle, string> = {
  bob: "placeholder-motion-bob",
  flutter: "placeholder-motion-flutter",
  none: "",
};

export function Placeholder({ variant, message, children, className }: PlaceholderProps) {
  const piece = useMemo(() => pickPiece(variant), [variant]);
  const resolvedMessage = message ?? DEFAULT_MESSAGES[variant];
  const isLoading = variant === "loading";

  return (
    <div
      role={isLoading ? "status" : undefined}
      aria-live={isLoading ? "polite" : undefined}
      className={clsx("flex flex-col items-center justify-center max-w-md mx-auto px-4 py-8", className)}
    >
      <pre
        aria-hidden="true"
        className={clsx(
          "font-mono text-xs sm:text-sm leading-tight text-muted-foreground whitespace-pre",
          MOTION_CLASS[piece.motion],
        )}
      >
        {piece.ascii}
      </pre>
      <p className="mt-3 font-mono text-sm text-muted-foreground placeholder-fade-in">
        {resolvedMessage}
      </p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">{piece.credit}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
```

The `useMemo` keyed on `variant` ensures the piece is stable for the mount but re-rolls if the variant prop changes (rare in practice). Re-mounting re-rolls naturally.

### ASCII Pool

**Path:** `web/src/components/Placeholder/ascii-pool.ts`

```ts
export type PlaceholderVariant = "empty" | "loading" | "noResults" | "notFound";
export type MotionStyle = "bob" | "flutter" | "none";

export interface AsciiPiece {
  id: string;
  variant: PlaceholderVariant;
  ascii: string;
  credit: string;
  motion: MotionStyle;
}

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

export function pickPiece(variant: PlaceholderVariant): AsciiPiece {
  const matches = ASCII_POOL.filter(p => p.variant === variant);
  return matches[Math.floor(Math.random() * matches.length)];
}
```

> Each `ascii` value is a template literal; backslashes and backticks are escaped per JS rules. The art shown here is verbatim from the brainstorm sign-off; implementation must preserve every space.

The `ascii` field of each entry holds the verbatim ASCII string. The four initial pieces are the ones validated during brainstorming:

- **empty** — Joan Stark's "early-bird" parrot with crest, perched on a branch
- **loading** — Joan Stark's compact hummingbird (mid-flight, fluttering)
- **noResults** — Joan Stark's wide-eyed two-feathered owl
- **notFound** — Joan Stark's flying-away bird with motion trails

Each piece's `ascii` is committed as a template literal preserving exact whitespace; the file is the source of truth and is small enough (~5–10 lines of art per piece) to keep inline rather than splitting into per-piece files.

### Default Messages

**Path:** `web/src/components/Placeholder/messages.ts`

```ts
export const DEFAULT_MESSAGES: Record<PlaceholderVariant, string> = {
  empty: "No memos yet",
  loading: "Loading…",
  noResults: "Nothing matches that search",
  notFound: "This page flew the coop",
};
```

Plain strings for the initial PR. A future i18n pass swaps these for `t("placeholder.empty")` etc. without touching the component.

### Animation

CSS keyframes live in a small co-located stylesheet (`Placeholder.css`) imported by `index.tsx`, scoped via a `.placeholder-…` class prefix to avoid leakage. The codebase uses Tailwind v4 plus plain CSS imports elsewhere; this matches the existing pattern.

```css
@media (prefers-reduced-motion: no-preference) {
  .placeholder-motion-bob     { animation: placeholder-bob 3.4s ease-in-out infinite; }
  .placeholder-motion-flutter { animation: placeholder-flutter 0.7s ease-in-out infinite; }
  .placeholder-fade-in        { animation: placeholder-fade 1s ease-out 0.3s both; opacity: 0; }
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

The reduced-motion guard wraps all three rules. When the user prefers reduced motion, the bird is static and the message appears without fading.

### Accessibility

- ASCII `<pre>` carries `aria-hidden="true"`; screen readers do not announce it character-by-character.
- The message is a semantic `<p>`. It is the accessible name of the placeholder for assistive tech.
- For `variant="loading"` only, the wrapper has `role="status"` and `aria-live="polite"` so the loading message is announced when the placeholder appears.
- The credit line (`jgs · 4/97`) is visible-but-small below the message. It is not aria-hidden because it is intentionally part of the visual presentation.
- The component itself is not focusable. Anything passed as `children` (e.g. a "Go home" button on 404) participates normally in tab order.
- Color contrast relies on the existing `text-muted-foreground` token, which already meets WCAG AA in the project's theme.

### File Layout

```
web/src/components/Placeholder/
  index.tsx              # the <Placeholder> component (public export)
  Placeholder.css        # keyframes + .placeholder-motion-* classes
  ascii-pool.ts          # AsciiPiece type, ASCII_POOL array, pickPiece()
  messages.ts            # DEFAULT_MESSAGES map (i18n-ready seam)
  CREDITS.md             # Joan Stark attribution + link to oldcompcz/jgs
```

### Integration

- **Delete:** `web/src/components/Empty.tsx`.
- **Modify:** `web/src/pages/Inboxes.tsx` — replace the `<Empty />` import and usage with `<Placeholder variant="empty" />`.

Other potential call sites (search results page, router 404 catch-all, Suspense fallbacks) are explicitly out of scope for this PR. They are noted in the PR description as follow-up opportunities.

### Credits

**Path:** `web/src/components/Placeholder/CREDITS.md`

A short Markdown file pointing to https://github.com/oldcompcz/jgs and acknowledging Joan Stark's work. This survives even if the per-piece `credit` field is ever cleaned up by a refactor.

## Testing

A small Vitest suite covers:

- Each variant renders without throwing.
- The chosen `<pre>` content contains text from the matching pool entry.
- `aria-hidden="true"` on the `<pre>`.
- `role="status"` only present when `variant="loading"`.
- A custom `message` prop overrides the default.
- The credit text is present in the DOM.

No visual regression testing is added.

## Open Questions

None. All design decisions were validated during the brainstorming session — animation register (cozy), bird selections (jgs collection), naming (`Placeholder`, no "bird" in the name), text treatment (plain muted monospace), and integration scope (replace `Empty.tsx`, do not wire other sites yet).

## References

- Joan Stark's ASCII Art Gallery (jgs collection): https://github.com/oldcompcz/jgs
- Existing component being replaced: `web/src/components/Empty.tsx`
- Existing call site: `web/src/pages/Inboxes.tsx`
- Visual brainstorm artifacts: `.superpowers/brainstorm/1991-1778593581/content/` (mascot-approach, animation-vibe, bird-shapes-v2, jgs-bird-set, text-treatment-c)
