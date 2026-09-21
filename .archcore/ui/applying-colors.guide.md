---
title: "Applying and testing colors"
status: draft
tags:
  - "ui"
---

Reader: a frontend contributor who styles a new surface with the theme color tokens. Task: apply matching token pairs and check the result in the light and dark themes. Step actor: the contributor.

## Prerequisites
- The web app runs locally (`pnpm dev` in `web/`, per `@web/package.json`).
- The color tokens are defined in `@web/src/themes/default.css`; each other theme file in `web/src/themes/` redefines them.
- The theme options are listed in `THEME_OPTIONS` (`@web/src/utils/theme.ts`): Sync with system, Light (`default`), Dark (`default-dark`), Paper (`paper`). You pick one under Theme in the user menu (`@web/src/components/UserMenu.tsx`) or in the preferences settings.

## Steps
1. Pick the token pair that matches the element:
   ```css
   /* Primary button */
   .btn-primary { background: var(--primary); color: var(--primary-foreground); border: 1px solid var(--primary); }
   /* Secondary button */
   .btn-secondary { background: var(--secondary); color: var(--secondary-foreground); border: 1px solid var(--border); }
   /* Destructive button */
   .btn-destructive { background: var(--destructive); color: var(--destructive-foreground); border: 1px solid var(--destructive); }
   /* Input field */
   .input { background: var(--input); color: var(--foreground); border: 1px solid var(--border); }
   /* Content card */
   .card { background: var(--card); color: var(--card-foreground); border: 1px solid var(--border); }
   /* Popover or modal */
   .popover { background: var(--popover); color: var(--popover-foreground); box-shadow: var(--shadow-lg); }
   ```
2. Apply the pair through its Tailwind color utilities or `var(--token)`, with no hardcoded color.
3. Open the page with the Light theme selected.
4. Switch to the Dark theme and check the page again.
5. Check readability at different browser zoom levels.
6. Check the page with a colorblind simulation tool.
7. Validate the WCAG contrast ratios of each text and background pair.

## Verification
- Text stays readable on its background in both the Light and the Dark theme.
- Each text and background pair passes the WCAG contrast check in both themes.
- The element changes color when the theme changes, with no extra code.

## Common Issues
- Text has poor contrast on a colored background. The pair is mixed, for example `--primary` with `--foreground`; use the matching `-foreground` token.
- An element keeps the same color in every theme. It uses a hardcoded value or a palette class; replace it with a token.
