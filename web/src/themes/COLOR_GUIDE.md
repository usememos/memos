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

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../.archcore/ui/color-conventions.rule.md).

### 🔘 Secondary Colors

| Variable                 | Light Theme | Dark Theme      | Usage                         |
| ------------------------ | ----------- | --------------- | ----------------------------- |
| `--secondary`            | Light gray  | Very light gray | Supporting actions            |
| `--secondary-foreground` | Dark gray   | Dark gray       | Text on secondary backgrounds |

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../.archcore/ui/color-conventions.rule.md).

### 📄 Background & Surface Colors

| Variable               | Light Theme | Dark Theme  | Usage                       |
| ---------------------- | ----------- | ----------- | --------------------------- |
| `--background`         | Near white  | Dark gray   | Main page background        |
| `--card`               | Near white  | Dark gray   | Card/container backgrounds  |
| `--card-foreground`    | Very dark   | Near white  | Text on card backgrounds    |
| `--popover`            | Pure white  | Darker gray | Overlay backgrounds         |
| `--popover-foreground` | Dark gray   | Light gray  | Text on overlay backgrounds |
| `--overlay`            | Pure black  | Pure black  | Scrim behind modals         |

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../.archcore/ui/color-conventions.rule.md).

### ✏️ Text & Content Colors

| Variable             | Light Theme | Dark Theme   | Usage                    |
| -------------------- | ----------- | ------------ | ------------------------ |
| `--foreground`       | Dark gray   | Light gray   | Primary text color       |
| `--muted`            | Light gray  | Very dark    | Subtle background areas  |
| `--muted-foreground` | Medium gray | Medium light | Secondary text, captions |

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../.archcore/ui/color-conventions.rule.md).

### 🎯 Interactive Elements

| Variable              | Light Theme  | Dark Theme  | Usage                        |
| --------------------- | ------------ | ----------- | ---------------------------- |
| `--accent`            | Light gray   | Very dark   | Hover states, selected items |
| `--accent-foreground` | Dark gray    | Light gray  | Text on accent backgrounds   |
| `--border`            | Medium light | Medium dark | Dividers, input borders      |
| `--input`             | Medium light | Medium dark | Form input backgrounds       |

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../.archcore/ui/color-conventions.rule.md).

### ⚠️ Feedback Colors

| Variable                   | Light Theme | Dark Theme    | Usage                              |
| -------------------------- | ----------- | ------------- | ---------------------------------- |
| `--destructive`            | Very dark   | Red           | Error states, dangerous actions    |
| `--destructive-foreground` | White       | White         | Text on destructive backgrounds    |
| `--success`                | Green       | Brighter green| Confirmation states (copied, saved)|
| `--success-foreground`     | Near white  | Near black    | Text on success backgrounds        |
| `--warning`                | Amber       | Brighter amber| Caution states (unused, deprecated)|
| `--warning-foreground`     | Dark        | Dark          | Text on warning backgrounds        |

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../.archcore/ui/color-conventions.rule.md).

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

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../.archcore/ui/color-conventions.rule.md).

Kept here because `.archcore/` does not carry these rows:

| Variable                       | Usage                        |
| ------------------------------ | ---------------------------- |
| `--sidebar-primary`            | Active sidebar items         |
| `--sidebar-primary-foreground` | Text on active sidebar items |
| `--sidebar-border`             | Sidebar dividers             |

## Best Practices

### ✅ Do's

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../.archcore/ui/color-conventions.rule.md).

### ❌ Don'ts

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../.archcore/ui/color-conventions.rule.md).

## Theme Switching

The color system automatically adapts between light and dark themes when the `.dark` class is applied to a parent element (typically `<html>` or `<body>`):

```javascript
// Toggle dark mode
document.documentElement.classList.toggle("dark");
```

## Accessibility

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../.archcore/ui/color-conventions.rule.md).

## Implementation Examples

### Button Variants

> Moved to [`.archcore/ui/applying-colors.guide.md`](../../../.archcore/ui/applying-colors.guide.md).

### Form Elements

> Moved to [`.archcore/ui/applying-colors.guide.md`](../../../.archcore/ui/applying-colors.guide.md).

### Cards and Containers

> Moved to [`.archcore/ui/applying-colors.guide.md`](../../../.archcore/ui/applying-colors.guide.md).

## Color Testing

> Moved to [`.archcore/ui/applying-colors.guide.md`](../../../.archcore/ui/applying-colors.guide.md).

## Z-Index Hierarchy

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../.archcore/ui/color-conventions.rule.md).

### Rules

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../.archcore/ui/color-conventions.rule.md).

---

_This color system is designed to provide a consistent, accessible, and beautiful user experience across all themes and components._
