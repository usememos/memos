# UI Kit (`components/ui`)

Base UI primitives with local styling, Lucide icons, and semantic CSS variables.
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
| **Button** | default · destructive · outline · secondary · ghost · link · **quiet** | size: default · sm · lg · icon · **icon-compact** · **icon-sm** | Default buttons use 14px text; `sm` uses 13px text with a 6px icon gap. Outline, secondary, ghost, and quiet controls show their pressed/open state. Every variant carries the kit's ring-free keyboard focus (`FOCUS_VISIBLE_OUTLINE_CLASSES` from `ui/focus.ts`; raw controls import the same constant). `quiet` is local: 13px muted ink that darkens under a `bg-muted/60` hover wash, and the accent fill only for `aria-pressed`, `aria-current` or `data-popup-open`. Use it via `buttonVariants({ variant: "quiet" })` on raw `<button>`/`<a>` elements too (calendar controls, memo outline, card actions). `icon-compact` (`size-7`) is the 28px square matching `sm`'s height; `icon-sm` (`size-6`) is for dense icon buttons. Auto-sizes unsized `svg` children to `size-4`. |
| **Badge** | default · **neutral** · secondary · destructive · outline · **warning** | shape: default · **pill** | `neutral` is for ordinary metadata/status; retain semantic warning/destructive colors. Badges use 12px/16px text with a 20px minimum height. `pill` = `rounded-full`. |
| **Tabs** | segmented · underline | size: default · **sm** | Base UI handles roving focus, arrows, Home/End, disabled tabs, and RTL. Arrow focus activates tabs by default (`TabsList activateOnFocus={false}` opts out). `sm` is 28px/13px, default is 32px/14px. The list owns segmented padding/background; underline relies on the consumer's divider. |
| **Dialog** | — | size: sm · default · lg · xl · 2xl · full | `backdrop="subtle"` is for tool dialogs such as search; default keeps the stronger scrim. Content uses the popover surface, 12px radius, a 28px close target, and reduced-motion-aware transitions. Base UI manages focus. |
| **Select** | — | size: xs · sm · default | Default is 32px/14px, `sm` is 28px/13px, `xs` is 24px/12px. Open state, focus, and invalid styling match other form fields. |
| **DropdownMenu** | item: default · destructive | size: default · sm | Shared floating surface and motion; compact menus retain 28px rows. Base UI manages submenus. |

Each cva component also exports its variant types, e.g. `ButtonVariant`,
`ButtonSize`, `BadgeVariant`, `BadgeShape`, `TabsVariant`, `TabsSize` — use these instead of
re-deriving `VariantProps`.

## Control states

- Fields use `FIELD_FOCUS_CLASSES` from `focus.ts`: a visible keyboard outline, focused border, and semantic `aria-invalid` / Base UI `data-invalid` styling. Invalid color remains visible on hover and focus. Resting fields have no shadow; disabled fields have a muted surface.
- Checkbox, radio, and switch outlines sit 2px outside their small visual bounds. Give controls a label/row target rather than shrinking the clickable area to the glyph.
- Switch: 32×20px track, 16px thumb, 2px visual inset, 12px logical travel in either text direction.
- Buttons and fields keep typography appropriate to their role; mobile text inputs retain 16px text. Avoid substituting smaller text through per-screen overrides.
- Sheet transitions take 200ms. Dialog/sheet, tabs, buttons, and controls respect reduced motion.

## Layering (z-index tiers)

Defined once as Tailwind tokens in `themes/default.css` (`--z-index-*`) and used
by the primitives — do not hardcode `z-[60]`-style literals:

| Utility | Value | Used by |
| --- | --- | --- |
| `z-overlay` | 50 | Dialog / Sheet overlay + content |
| `z-dropdown` | 60 | Select / DropdownMenu / Popover content |
| `z-tooltip` | 70 | Tooltip content |

A dropdown inside a dialog needs `z-dropdown` (already the default) so it renders
above the overlay; a tooltip sits above everything.
