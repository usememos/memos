# Markdown Components

Modern, type-safe React components for rendering markdown content via react-markdown.

## Architecture

### Component-Based Rendering
Following patterns from popular AI chat apps (ChatGPT, Claude, Perplexity), we use React components instead of CSS selectors for markdown rendering. This provides:

- **Type Safety**: Full TypeScript support with proper prop types
- **Maintainability**: Components are easier to test, modify, and understand
- **Performance**: No CSS specificity conflicts, cleaner DOM
- **Modularity**: Each element is independently styled and documented

### Type System

All components extend `ReactMarkdownProps` which includes the AST `node` prop passed by react-markdown. This is explicitly destructured as `node: _node` to:
1. Filter it from DOM props (avoids `node="[object Object]"` in HTML)
2. Keep it available for advanced use cases (e.g., detecting task lists)
3. Maintain type safety without `as any` casts

### GFM Task Lists

Task lists (from remark-gfm) are handled by:
- **Detection**: `contains-task-list` and `task-list-item` classes from remark-gfm
- **Styling**: Tailwind utilities with arbitrary variants for nested elements
- **Checkboxes**: Custom `TaskListItem` component with Radix UI checkbox
- **Interactivity**: Updates memo content via `toggleTaskAtIndex` utility

### Component Patterns

Each component follows this structure:
```tsx
import { cn } from "@/lib/utils";
import type { ReactMarkdownProps } from "./types";

interface ComponentProps extends React.HTMLAttributes<HTMLElement>, ReactMarkdownProps {
  children?: React.ReactNode;
  // component-specific props
}

/**
 * JSDoc description
 */
export const Component = ({ children, className, node: _node, ...props }: ComponentProps) => {
  return (
    <element className={cn("base-classes", className)} {...props}>
      {children}
    </element>
  );
};
```

## Components

| Component | Element | Purpose |
|-----------|---------|---------|
| `Heading` | h1-h6 | Semantic headings with level-based styling |
| `Paragraph` | p | Compact paragraphs with consistent spacing |
| `Link` | a | External links with security attributes |
| `List` | ul/ol | Regular and GFM task lists |
| `ListItem` | li | List items with task checkbox support |
| `Blockquote` | blockquote | Quotes with left border accent |
| `InlineCode` | code | Inline code with background |
| `Image` | img | Responsive images with rounded corners |
| `HorizontalRule` | hr | Section separators |

## Styling Approach

- **Tailwind CSS**: All styling uses Tailwind utilities
- **Design Tokens**: Colors use CSS variables (e.g., `--primary`, `--muted-foreground`)
- **Responsive**: Max-width constraints, responsive images
- **Accessibility**: Semantic HTML, proper ARIA attributes via Radix UI

## Integration

Components are mapped to HTML elements in `MemoContent/index.tsx`:

```tsx
<ReactMarkdown
  components={{
    h1: ({ children }) => <Heading level={1}>{children}</Heading>,
    p: ({ children, ...props }) => <Paragraph {...props}>{children}</Paragraph>,
    // ... more mappings
  }}
>
  {content}
</ReactMarkdown>
```

## Future Enhancements

- [ ] Syntax highlighting themes for code blocks
- [ ] Table sorting/filtering interactions
- [ ] Image lightbox/zoom functionality
- [ ] Collapsible sections for long content
- [ ] Copy button for code blocks
