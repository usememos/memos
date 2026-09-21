---
title: "UI component conventions"
status: draft
tags:
  - "ui"
---

## Rule
Applies to the kit components in `web/src/components/ui/` and to every consumer in `web/src/**/*.tsx`.

1. When styling a kit component, consumers MUST use its `variant`, `size`, or `shape` props.
2. Consumers MUST NOT pass `className` to a kit component to add colors, sizing, borders, or hover states.
3. WHEN a look that no prop provides recurs, contributors MUST add a variant to the kit component in `web/src/components/ui/`.
4. WHEN a kit component needs layout or positioning, such as margins or absolute placement, consumers MUST put those classes on a wrapper element.
5. WHEN an element is bespoke (data-driven background, glass or blur, a contextual one-off), contributors MUST use a raw HTML element with its own classes; it is not a kit component.
6. WHEN a raw `<button>` or `<a>` needs the `quiet` look, contributors MUST style it with `buttonVariants({ variant: "quiet" })`.
7. Raw controls MUST take their keyboard focus style from `FOCUS_VISIBLE_OUTLINE_CLASSES` in `web/src/components/ui/focus.ts`.
8. Consumers MUST use the exported variant types (`ButtonVariant`, `ButtonSize`, `BadgeVariant`, `BadgeShape`, `TabsVariant`) instead of re-deriving `VariantProps`.

## Rationale
`web/src/components/ui/` is the single source of styling truth for kit components. The kit is configured in `@web/components.json` (new-york style, zinc base, lucide icons, CSS variables). Its variants are `cva` definitions composed with `cn()`, as in `@web/src/components/ui/button.tsx`.

## Examples
`@web/src/components/MemoDetailSidebar/MemoOutline.tsx` and `@web/src/components/CalendarView/CalendarHeader.tsx` style raw buttons with `buttonVariants({ variant: "quiet" })` per Rule 6, instead of passing `className`.

## Enforcement
Not recorded in the source.

## Variant catalog
| Component | variant | size / shape | Notes |
| --- | --- | --- | --- |
| `Button` | default, destructive, outline, secondary, ghost, link, quiet | size: default, sm, lg, icon, icon-compact, icon-sm | Every variant carries `FOCUS_VISIBLE_OUTLINE_CLASSES`. `quiet`: 13px muted ink that darkens under a `bg-muted/60` hover wash; accent fill only for `aria-pressed`, `aria-current`, or `data-popup-open`; also used on raw `<button>`/`<a>` elements too (calendar controls, memo outline, card actions). `icon-compact` (`size-7`) is the 28px square matching `sm` height; `icon-sm` (`size-6`) is for dense icon buttons. Unsized `svg` children become `size-4`. |
| `Badge` | default, secondary, destructive, outline, warning | shape: default, pill (`rounded-full`) | `warning` and `shape` are local additions. |
| `Tabs` | — | variant: segmented, underline | Local, context-based `Tabs` / `TabsList` / `TabsTrigger`. `underline` relies on the consumer's own divider. |
| `Dialog` | — | size: sm, default, lg, xl, 2xl, full | Local `size` variants; no auto-focus on open. |
| `Select` | — | size: xs, sm, default | Local `size` prop on the trigger. |
| `DropdownMenu` | item: default, destructive | — | Local destructive item variant. |
