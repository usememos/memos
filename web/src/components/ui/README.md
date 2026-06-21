# UI Kit (`components/ui`)

shadcn/ui primitives ("new-york" style, zinc base, lucide icons, CSS variables).
This folder is the **single source of styling truth**. Read this before adding a
component or reaching for `className` on a kit component.

## The one rule: use props, not `className`

Consumers style kit components through **`variant` / `size` / `shape` props only**
— do **not** pass `className` to add colors, sizing, borders, or hover states.

- Need a look that no prop provides, but it recurs? **Add a variant here.**
- Need layout/positioning (margins, absolute)? Put it on a **wrapper** element.
- The element is genuinely bespoke (data-driven background, glass/blur, a
  contextual one-off)? Don't fight the kit — use a **raw HTML element** with its
  own classes. It is not a kit component.

Color comes from the semantic OKLCH tokens documented in
[`../../themes/COLOR_GUIDE.md`](../../themes/COLOR_GUIDE.md) (`--primary`,
`--muted-foreground`, `--success`, `--warning`, …). Never hardcode `gray-500` /
`amber-50` palette classes.

## Variant catalog

| Component | variant | size / shape | Notes |
| --- | --- | --- | --- |
| **Button** | default · destructive · outline · secondary · ghost · link | size: default · sm · lg · icon · **icon-sm** | `icon-sm` (`size-6`) is local — for dense/compact icon buttons. Auto-sizes unsized `svg` children to `size-4`. |
| **Badge** | default · secondary · destructive · outline · **warning** | shape: default · **pill** | `warning` + `shape` are local additions. `pill` = `rounded-full`. |
| **Tabs** | — | variant: **segmented** · **underline** | Local component (not upstream shadcn). Context-based `Tabs`/`TabsList`/`TabsTrigger`, no Radix. `underline` relies on the consumer's own divider. |
| **Dialog** | — | size: sm · default · lg · xl · 2xl · full | Local `size` variants + auto-focus prevention on open. |
| **Select** | — | size: xs · sm · default | Local `size` prop on the trigger. |
| **DropdownMenu** | item: default · destructive | — | Local destructive item variant + a sub-menu hover-delay hook. |

Each cva component also exports its variant types, e.g. `ButtonVariant`,
`ButtonSize`, `BadgeVariant`, `BadgeShape`, `TabsVariant` — use these instead of
re-deriving `VariantProps`.

## Layering (z-index tiers)

Defined once as Tailwind tokens in `themes/default.css` (`--z-index-*`) and used
by the primitives — do not hardcode `z-[60]`-style literals:

| Utility | Value | Used by |
| --- | --- | --- |
| `z-overlay` | 50 | Dialog / Sheet overlay + content |
| `z-dropdown` | 60 | Select / DropdownMenu / Popover content |
| `z-tooltip` | 70 | Tooltip content + arrow |

A dropdown inside a dialog needs `z-dropdown` (already the default) so it renders
above the overlay; a tooltip sits above everything.
