# Color System Guide

This document explains the color system used in the Memos application, built with OKLCH color space for better perceptual uniformity and accessibility.

## Overview

The color system supports both light and dark themes automatically through CSS custom properties. All colors are defined using OKLCH (Oklab LCH) color space, which provides better perceptual uniformity than traditional RGB/HSL.

## Color Categories

### 🎨 Primary Brand Colors

| Variable               | Light Theme   | Dark Theme      | Usage                          |
| ---------------------- | ------------- | --------------- | ------------------------------ |
| `--primary`            | Golden yellow | Brighter golden | Main brand color, primary CTAs |
| `--primary-foreground` | White         | White           | Text on primary backgrounds    |

**When to use:**

- Call-to-action buttons
- Active navigation items
- Important links and highlights
- Brand elements

```css
/* Example usage */
.cta-button {
  background: var(--primary);
  color: var(--primary-foreground);
}
```

### 🔘 Secondary Colors

| Variable                 | Light Theme | Dark Theme      | Usage                         |
| ------------------------ | ----------- | --------------- | ----------------------------- |
| `--secondary`            | Light gray  | Very light gray | Supporting actions            |
| `--secondary-foreground` | Dark gray   | Dark gray       | Text on secondary backgrounds |

**When to use:**

- Secondary buttons
- Less important actions
- Alternative navigation items
- Subtle highlights

### 📄 Background & Surface Colors

| Variable               | Light Theme | Dark Theme  | Usage                       |
| ---------------------- | ----------- | ----------- | --------------------------- |
| `--background`         | Near white  | Dark gray   | Main page background        |
| `--card`               | Near white  | Dark gray   | Card/container backgrounds  |
| `--card-foreground`    | Very dark   | Near white  | Text on card backgrounds    |
| `--popover`            | Pure white  | Darker gray | Overlay backgrounds         |
| `--popover-foreground` | Dark gray   | Light gray  | Text on overlay backgrounds |

**When to use:**

- Page backgrounds (`--background`)
- Content cards and panels (`--card`)
- Tooltips, dropdowns, modals (`--popover`)

### ✏️ Text & Content Colors

| Variable             | Light Theme | Dark Theme   | Usage                    |
| -------------------- | ----------- | ------------ | ------------------------ |
| `--foreground`       | Dark gray   | Light gray   | Primary text color       |
| `--muted`            | Light gray  | Very dark    | Subtle background areas  |
| `--muted-foreground` | Medium gray | Medium light | Secondary text, captions |

**When to use:**

- Main body text (`--foreground`)
- Helper text, placeholders (`--muted-foreground`)
- Disabled text states
- Subtle background sections (`--muted`)

### 🎯 Interactive Elements

| Variable              | Light Theme  | Dark Theme  | Usage                        |
| --------------------- | ------------ | ----------- | ---------------------------- |
| `--accent`            | Light gray   | Very dark   | Hover states, selected items |
| `--accent-foreground` | Dark gray    | Light gray  | Text on accent backgrounds   |
| `--border`            | Medium light | Medium dark | Dividers, input borders      |
| `--input`             | Medium light | Medium dark | Form input backgrounds       |

**When to use:**

- Hover states (`--accent`)
- Form field borders (`--border`)
- Input field backgrounds (`--input`)

### ⚠️ Feedback Colors

| Variable                   | Light Theme | Dark Theme | Usage                           |
| -------------------------- | ----------- | ---------- | ------------------------------- |
| `--destructive`            | Very dark   | Red        | Error states, dangerous actions |
| `--destructive-foreground` | White       | White      | Text on destructive backgrounds |

**When to use:**

- Error messages
- Delete buttons
- Warning alerts
- Validation failures

### 📊 Data Visualization

| Variable    | Purpose                                 |
| ----------- | --------------------------------------- |
| `--chart-1` | Primary data series (golden)            |
| `--chart-2` | Secondary data series (purple)          |
| `--chart-3` | Tertiary data series (light)            |
| `--chart-4` | Quaternary data series (purple variant) |
| `--chart-5` | Quinary data series (golden variant)    |

**When to use:**

- Charts and graphs
- Data visualization
- Progress indicators
- Statistical displays

### 🔧 Sidebar System

| Variable                       | Usage                        |
| ------------------------------ | ---------------------------- |
| `--sidebar`                    | Sidebar background           |
| `--sidebar-foreground`         | Sidebar text                 |
| `--sidebar-primary`            | Active sidebar items         |
| `--sidebar-primary-foreground` | Text on active sidebar items |
| `--sidebar-accent`             | Sidebar hover states         |
| `--sidebar-accent-foreground`  | Text on sidebar hover states |
| `--sidebar-border`             | Sidebar dividers             |

## Best Practices

### ✅ Do's

1. **Always pair colors correctly:**

   ```css
   /* Correct */
   background: var(--primary);
   color: var(--primary-foreground);
   ```

2. **Use semantic meaning:**
   - Primary = main actions
   - Secondary = supporting actions
   - Destructive = dangerous/delete actions
   - Muted = less important content

3. **Respect the design system:**
   - Use existing color tokens instead of custom colors
   - Maintain consistency across components

### ❌ Don'ts

1. **Don't mix incompatible pairs:**

   ```css
   /* Incorrect - poor contrast */
   background: var(--primary);
   color: var(--foreground);
   ```

2. **Don't use colors outside their intended purpose:**
   - Don't use destructive colors for positive actions
   - Don't use primary colors for secondary elements

3. **Don't hardcode color values:**

   ```css
   /* Bad */
   color: #333333;

   /* Good */
   color: var(--foreground);
   ```

## Theme Switching

The color system automatically adapts between light and dark themes when the `.dark` class is applied to a parent element (typically `<html>` or `<body>`):

```javascript
// Toggle dark mode
document.documentElement.classList.toggle("dark");
```

## Accessibility

- All color pairs meet WCAG contrast requirements
- Color is never the only means of conveying information

## Implementation Examples

### Button Variants

```css
/* Primary button */
.btn-primary {
  background: var(--primary);
  color: var(--primary-foreground);
  border: 1px solid var(--primary);
}

/* Secondary button */
.btn-secondary {
  background: var(--secondary);
  color: var(--secondary-foreground);
  border: 1px solid var(--border);
}

/* Destructive button */
.btn-destructive {
  background: var(--destructive);
  color: var(--destructive-foreground);
  border: 1px solid var(--destructive);
}
```

### Form Elements

```css
/* Input field */
.input {
  background: var(--input);
  color: var(--foreground);
  border: 1px solid var(--border);
}
```

### Cards and Containers

```css
/* Content card */
.card {
  background: var(--card);
  color: var(--card-foreground);
  border: 1px solid var(--border);
}

/* Popover/Modal */
.popover {
  background: var(--popover);
  color: var(--popover-foreground);
  box-shadow: var(--shadow-lg);
}
```

## Color Testing

To ensure proper contrast and accessibility:

1. Test both light and dark themes
2. Verify readability at different zoom levels
3. Check with colorblind simulation tools
4. Validate WCAG contrast ratios

## Z-Index Hierarchy

The application uses a structured z-index hierarchy to ensure proper layering of UI components:

| Component Type    | Z-Index  | Usage                                 |
| ----------------- | -------- | ------------------------------------- |
| **Base Content**  | `z-0`    | Normal page content                   |
| **Overlays**      | `z-50`   | Dialog/Sheet backgrounds              |
| **Modal Content** | `z-50`   | Dialog/Sheet content                  |
| **Dropdowns**     | `z-[60]` | Select, DropdownMenu, Popover content |
| **Tooltips**      | `z-[70]` | Tooltip content (highest priority)    |

### Rules

1. **Dialog/Sheet**: Use `z-50` for both overlay and content
2. **Interactive Elements**: Use `z-[60]` for dropdowns inside dialogs
3. **Tooltips**: Use `z-[70]` to appear above all other elements
4. **Always test**: Ensure Select/DropdownMenu works inside Dialog/Sheet

### Example

```tsx
// ✅ Correct: Select inside Dialog will appear above dialog content
<Dialog>
  <DialogContent>
    <Select>
      <SelectContent className="z-[60]">
        {" "}
        {/* Higher than dialog */}
        <SelectItem>Option 1</SelectItem>
      </SelectContent>
    </Select>
  </DialogContent>
</Dialog>
```

---

_This color system is designed to provide a consistent, accessible, and beautiful user experience across all themes and components._
