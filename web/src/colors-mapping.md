# Color Mapping Guide for Memos

This document provides a comprehensive guide for mapping fixed Tailwind colors to semantic variant tokens in the Memos application. All developers should follow these guidelines when working with colors in the codebase.

## Overview

We use semantic color tokens instead of fixed Tailwind colors (like `gray-500`, `zinc-700`, etc.) to ensure consistent theming and better maintainability. All colors are defined in `/web/src/style.css` using the oklch color space.

## Color Token Reference

### Core Tokens

| Token | Usage | Light Mode | Dark Mode |
|-------|-------|------------|-----------|
| `background` | Main page background | Near white | Dark gray |
| `foreground` | Main text color | Dark gray | Light gray |
| `card` | Card/panel backgrounds | White | Dark gray |
| `card-foreground` | Text on cards | Dark gray | Light gray |
| `popover` | Popover/dropdown backgrounds | White | Darker gray |
| `popover-foreground` | Text in popovers | Dark gray | Light gray |

### Interactive Tokens

| Token | Usage | Light Mode | Dark Mode |
|-------|-------|------------|-----------|
| `primary` | Primary actions, links | Orange/amber | Lighter orange |
| `primary-foreground` | Text on primary backgrounds | White | White |
| `secondary` | Secondary backgrounds | Light gray | Light gray |
| `secondary-foreground` | Text on secondary backgrounds | Dark gray | Dark gray |
| `accent` | Accent/highlight elements | Light gray | Dark accent |
| `accent-foreground` | Text on accent backgrounds | Dark gray | Light gray |

### Semantic Tokens

| Token | Usage | Light Mode | Dark Mode |
|-------|-------|------------|-----------|
| `muted` | Subtle backgrounds | Very light gray | Dark muted |
| `muted-foreground` | Subtle/secondary text | Medium gray | Light gray |
| `destructive` | Error/danger states | Dark gray | Red |
| `destructive-foreground` | Text on destructive | White | White |
| `border` | All borders | Light gray | Dark gray |
| `input` | Form input backgrounds | Light gray | Dark gray |
| `ring` | Focus rings | Blue/purple | Blue/purple |

### Chart Colors

| Token | Usage |
|-------|-------|
| `chart-1` through `chart-5` | Data visualization colors |

### Sidebar Tokens

| Token | Usage |
|-------|-------|
| `sidebar` | Sidebar background |
| `sidebar-foreground` | Sidebar text |
| `sidebar-primary` | Primary elements in sidebar |
| `sidebar-accent` | Accent elements in sidebar |
| `sidebar-border` | Sidebar borders |

## Mapping Guide

### Gray Scale Mapping

| Fixed Color | → | Variant Token | Use Case |
|-------------|---|---------------|----------|
| `gray-50`, `gray-100` | → | `muted` or `secondary` | Subtle backgrounds |
| `gray-200`, `gray-300` | → | `border` | Borders, dividers |
| `gray-400`, `gray-500` | → | `muted-foreground` | Secondary text, icons |
| `gray-600`, `gray-700` | → | `foreground` | Primary text |
| `gray-800`, `gray-900` | → | `foreground` | Headings, emphasis |

### Zinc Scale Mapping (Dark Mode)

| Fixed Color | → | Variant Token | Use Case |
|-------------|---|---------------|----------|
| `zinc-700`, `zinc-800` | → | `card` or `secondary` | Dark backgrounds |
| `zinc-600`, `zinc-700` | → | `border` | Dark borders |
| `zinc-900` | → | `background` | Darkest background |

### Special Colors

| Fixed Color | → | Variant Token | Use Case |
|-------------|---|---------------|----------|
| `white` | → | `background` (light) or `foreground` (dark) | Context-dependent |
| `black` | → | `foreground` (light) or `background` (dark) | Context-dependent |
| `red-*` | → | `destructive` | Errors, warnings, danger |
| `blue-*` | → | `primary` or `accent` | Links, primary actions |
| `green-*` | → | `primary` or `accent` | Success states (use primary) |
| `amber-*`, `yellow-*` | → | `primary` or `accent` | Warnings, highlights |

## Implementation Examples

### Before (Fixed Colors)
```tsx
// ❌ Don't use fixed colors
<div className="bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
  <button className="bg-blue-600 text-white hover:bg-blue-700">
    Click me
  </button>
</div>
```

### After (Variant Tokens)
```tsx
// ✅ Use semantic tokens
<div className="bg-muted dark:bg-card text-muted-foreground">
  <button className="bg-primary text-primary-foreground hover:bg-primary/90">
    Click me
  </button>
</div>
```

## Common Patterns

### Cards and Panels
```tsx
// Card container
<div className="bg-background dark:bg-card border border-border">
  // Card content with proper text color
  <p className="text-foreground">Main content</p>
  <p className="text-muted-foreground">Secondary content</p>
</div>
```

### Interactive Elements
```tsx
// Primary button
<button className="bg-primary text-primary-foreground hover:bg-primary/90">

// Secondary button  
<button className="bg-secondary text-secondary-foreground hover:bg-secondary/80">

// Ghost button
<button className="hover:bg-accent hover:text-accent-foreground">

// Destructive button
<button className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
```

### Form Inputs
```tsx
<input className="bg-input border-border text-foreground placeholder:text-muted-foreground">
```

### Borders and Dividers
```tsx
// Border
<div className="border border-border">

// Divider
<div className="divide-y divide-border">
```

## Migration Checklist

When updating components:

1. ✅ Replace all `gray-*` colors with appropriate semantic tokens
2. ✅ Replace all `zinc-*` colors with appropriate semantic tokens  
3. ✅ Replace `white` and `black` with context-appropriate tokens
4. ✅ Replace color-specific classes (`red-*`, `blue-*`, etc.) with semantic tokens
5. ✅ Remove redundant dark mode classes when both modes use the same token
6. ✅ Test in both light and dark modes to ensure proper contrast

## Notes

- The Claude theme from TweakCN is currently applied, using oklch color space for better color consistency
- Success and warning variants were removed to match the Claude theme exactly
- When in doubt, prefer `muted-foreground` for secondary text and `border` for all borders
- Always test color changes in both light and dark modes
- Avoid creating new color tokens unless absolutely necessary

## Future Considerations

- If new semantic colors are needed (e.g., success, warning), they should be added to both light and dark mode definitions in `/web/src/style.css`
- Consider accessibility and WCAG compliance when choosing color combinations
- Maintain consistency with the established design system

## Completion Status

✅ **All fixed colors have been successfully replaced** (as of latest migration)
- No remaining usage of any Tailwind fixed colors including:
  - Gray scale: `-gray-*`, `-slate-*`
  - Zinc scale: `-zinc-*`
  - Colors: `-red-*`, `-blue-*`, `-green-*`, `-amber-*`, `-yellow-*`, `-teal-*`, `-purple-*`, `-pink-*`, `-rose-*`, `-orange-*`, `-lime-*`, `-emerald-*`, `-cyan-*`, `-sky-*`, `-indigo-*`, `-violet-*`, `-fuchsia-*`
  - Black/White: `bg-white`, `text-white`, `bg-black`, `text-black`
- All components now use semantic tokens exclusively

✅ **Redundant dark: prefixes removed**
- Removed all redundant `dark:` prefixes where the same semantic token is used
- Removed redundant `dark:opacity-*` where the same opacity value is used
- Preserved `dark:` prefixes where different tokens or behaviors are needed
- UI components in `/components/ui` retain all `dark:` prefixes for flexibility