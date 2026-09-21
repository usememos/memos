---
title: "Color and layering conventions"
status: draft
tags:
  - "ui"
---

## Rule
Applies to color and stacking classes in `web/src/**/*.tsx`, `web/src/**/*.ts`, and `web/src/**/*.css`. Tokens are defined in `web/src/themes/default.css` and overridden per theme in `web/src/themes/*.css`.

1. For any color, contributors MUST use an existing semantic color token instead of a custom color.
2. Contributors MUST NOT hardcode color values such as `#333333`; use the token, for example `var(--foreground)`.
3. Contributors MUST NOT use Tailwind palette color classes (`<color>-<shade>`, such as `gray-500`, `amber-50`, or any `green-*` shade).
4. For feedback states, contributors MUST NOT add manual `dark:` overrides.
5. WHEN a background token has a `-foreground` partner, contributors MUST set text to that partner, for example `--primary` with `--primary-foreground`.
6. Contributors MUST NOT combine a background token with a foreground token from another pair, for example `--primary` with `--foreground`.
7. Contributors MUST choose tokens by meaning: primary for main actions, secondary for supporting actions, destructive for dangerous or delete actions, muted for less important content.
8. Contributors MUST NOT use destructive tokens for positive actions.
9. Contributors MUST NOT use primary tokens for secondary elements.
10. For modal scrims, contributors MUST use `--overlay` with an alpha utility: `bg-overlay/50` for dialogs and sheets, `bg-overlay/20` for focus mode.
11. For tinted feedback treatments such as badges and panels, contributors MUST pair the token with opacity modifiers, for example `border-warning/30 bg-warning/10 text-warning`.
12. Every color pair MUST meet WCAG contrast requirements.
13. Color MUST NOT be the only means of conveying information.
14. For stacking, contributors MUST use the `z-overlay`, `z-dropdown`, and `z-tooltip` utilities, not literals such as `z-[60]`.
15. For a Dialog or Sheet, contributors MUST use `z-overlay` on both the overlay and the content.
16. For a dropdown inside a dialog, contributors MUST use `z-dropdown`.
17. For tooltips, contributors MUST use `z-tooltip`, so they appear above all other elements.
18. Contributors MUST test that Select and DropdownMenu work inside a Dialog and a Sheet.

## Rationale
All colors are OKLCH custom properties that each theme file redefines, so a token adapts to every theme while a literal or palette class does not. The tiers are defined once as `--z-index-overlay`, `--z-index-dropdown`, and `--z-index-tooltip` in `@web/src/themes/default.css`. The `ui/` primitives already use them (`@web/src/components/ui/dialog.tsx`, `@web/src/components/ui/select.tsx`, `@web/src/components/ui/tooltip.tsx`), so a `Select` in a `Dialog` renders above the overlay with no extra `z-*` class.

## Examples
### Good
```css
background: var(--primary);
color: var(--primary-foreground);
```
### Bad
```css
background: var(--primary);
color: var(--foreground); /* poor contrast */
color: #333333;
```

## Enforcement
Not recorded in the source.

## Token usage
| Token | Use for |
| --- | --- |
| `--primary` / `--primary-foreground` | Call-to-action buttons, active navigation items, important links and highlights, brand elements |
| `--secondary` / `--secondary-foreground` | Secondary buttons, less important actions, alternative navigation items, subtle highlights |
| `--background` | Main page background |
| `--card` / `--card-foreground` | Content cards and panels |
| `--popover` / `--popover-foreground` | Tooltips, dropdowns, modals |
| `--overlay` | Scrim behind modals (always with an alpha utility) |
| `--foreground` | Main body text |
| `--muted-foreground` | Helper text, placeholders, captions, disabled text |
| `--muted` | Subtle background sections |
| `--accent` / `--accent-foreground` | Hover states, selected items |
| `--border` | Dividers, form field borders |
| `--input` | Form input backgrounds |
| `--destructive` / `--destructive-foreground` | Error messages, delete buttons, validation failures |
| `--success` / `--success-foreground` | Confirmations such as "copied" or saved |
| `--warning` / `--warning-foreground` | Non-critical caution, such as unused attachments |
| `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--sidebar-accent-foreground` | Sidebar background, text, hover states, and hover text |

## Z-index tiers
| Layer | Utility | Value |
| --- | --- | --- |
| Base content | `z-0` | 0 |
| Dialog and Sheet overlay and content | `z-overlay` | 50 |
| Select, DropdownMenu, Popover content | `z-dropdown` | 60 |
| Tooltip content and arrow | `z-tooltip` | 70 |
