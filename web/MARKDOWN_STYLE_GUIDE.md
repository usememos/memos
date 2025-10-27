# Markdown Styling Guide

This document describes the compact markdown styling approach used in this codebase.

## Design Principles

Our markdown rendering uses compact spacing optimized for memos and notes:

### 1. **Scoped Styles**
All markdown styles are scoped to `.markdown-content` to avoid global pollution:
```css
.markdown-content p { /* scoped */ }
```

### 2. **Compact Block Spacing**
All block elements use **8px (0.5rem)** bottom margin:
- Paragraphs
- Lists (ul, ol)
- Code blocks (pre)
- Blockquotes
- Tables
- Horizontal rules

This is more compact than GitHub's standard (16px) but maintains readability for memo-style content.

### 3. **First/Last Child Normalization**
```css
.markdown-content > :first-child {
  margin-top: 0 !important;
}

.markdown-content > :last-child {
  margin-bottom: 0 !important;
}
```

This prevents double margins at container boundaries.

### 4. **Nested Element Spacing**
Nested elements (lists within lists, paragraphs within lists) use **minimal spacing** (2px/0.125rem):
```css
.markdown-content li > ul {
  margin-top: 0.125rem;
  margin-bottom: 0.125rem;
}
```

### 5. **Heading Separation**
Headings have moderate top margins (12px/0.75rem) to create visual sections:
```css
.markdown-content h1,
.markdown-content h2 {
  margin-top: 0.75rem;
  margin-bottom: 0.5rem;
}
```

### 6. **No White-Space Preservation**
We do NOT use `white-space: pre-line`. Spacing is controlled entirely by CSS margins, matching how GitHub/ChatGPT/Claude work.

## Component Architecture

We use a **hybrid approach**:

### CSS-Based (for standard elements)
```tsx
<div className="markdown-content">
  <ReactMarkdown>
    {content}
  </ReactMarkdown>
</div>
```

Standard elements (p, ul, ol, h1-h6, etc.) are styled via CSS.

### Component-Based (for custom elements)
```tsx
<ReactMarkdown
  components={{
    input: TaskListItem,   // Custom task list checkboxes
    span: Tag,             // Custom #tag rendering
  }}
>
  {content}
</ReactMarkdown>
```

Custom elements use React components for interactivity.

## Comparison with Industry Standards

| Feature | GitHub | ChatGPT | Claude | Memos (ours) |
|---------|--------|---------|--------|--------------|
| Block margin | 16px | 16px | 16px | 8px (compact) ⚡ |
| Scoped styles | `.markdown-body` | `.prose` | Custom | `.markdown-content` ✅ |
| First/last normalization | ✅ | ✅ | ✅ | ✅ |
| Heading underlines (h1/h2) | ✅ | ❌ | ❌ | ✅ |
| Custom components | Few | Many | Many | Some ✅ |
| Line height | 1.6 | 1.6 | 1.6 | 1.5 (compact) ⚡ |
| List padding | 2em | 2em | 2em | 1.5em (compact) ⚡ |
| Code block padding | 16px | 16px | 16px | 8-12px (compact) ⚡ |

**Note:** Our compact spacing is optimized for memo/note-taking apps where screen real estate is important.

## Examples

### Input
```markdown
1312

* 123123
```

### Rendering
- Paragraph "1312" with `margin-bottom: 0.5rem` (8px)
- List with `margin-top: 0` (normalized)
- Result: Single 8px gap between paragraph and list ✅

### Before (with `white-space: pre-line`)
```
1312
[blank line from preserved \n\n]
[16px margin]
* 123123
```
Result: Double spacing ❌

### After (compact spacing, no white-space preservation)
```
1312
[8px margin only]
* 123123
```
Result: Clean, compact single spacing ✅

## Testing

To verify correct rendering:

1. **Text followed by list**: `"text\n\n* item"` → single 8px gap
2. **List followed by text**: `"* item\n\ntext"` → single 8px gap
3. **Nested lists**: Should have minimal spacing (2px)
4. **Headings**: Should have 12px top margin (except first child)
5. **Blockquotes**: Should handle nested content properly
6. **Code blocks**: Should have 8-12px padding (compact)
7. **Tables**: Should have compact cell padding (4px vertical, 8px horizontal)

## References

- [CommonMark Spec](https://spec.commonmark.org/)
- [GitHub Flavored Markdown Spec](https://github.github.com/gfm/)
- [GitHub Markdown CSS](https://github.com/sindresorhus/github-markdown-css)
- [Tailwind Typography](https://tailwindcss.com/docs/typography-plugin)
