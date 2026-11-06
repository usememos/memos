# Themes

Color, shadow and font tokens come from `@usememos/ui` (read `web/node_modules/@usememos/ui/llms.txt`,
then its color.md). Every token is a CSS variable named `--mu-<name>`; the Tailwind utilities for them
carry an `mu-` prefix (`bg-mu-surface`, `text-mu-ink-muted`).

- **Light and Dark** are the package's own themes, selected by `data-theme="light" | "dark"` on `<html>`.
  `utils/theme.ts` sets the attribute from the saved preference (`default`, `default-dark`, `paper` or
  `system`, kept as they are in the account setting and in localStorage) and the OS scheme.
- **Paper** (`paper.css`) is memos' app theme: a `[data-theme="paper"]` rule that must set every name in
  the package's `themeTokens` (27 colors and 5 shadows), with every text pair at 4.5:1 or more.
  `tests/paper-theme.test.ts` checks both. Its primary stays ink, warm rather than a brand hue.
- `default.css` only sets the text fonts to the package's and adds the wordmark's serif. Colors, radius
  and shadows are used through the package's `mu-` utilities and `var(--mu-*)`; memos keeps no names of
  its own for them. The admin "Additional style" setting must target the same tokens and `mu-` classes.

There is no `.dark` or `.light` class; `color-scheme` comes from the theme rule, and the memo editor
follows it.
