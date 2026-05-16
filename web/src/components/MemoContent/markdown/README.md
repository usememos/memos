# Markdown Components

Small React components used by `MemoMarkdownRenderer` to style HTML emitted by `react-markdown`.

## Responsibilities

- Keep element styling local to each semantic HTML element.
- Strip the `node` prop from DOM output through `ReactMarkdownProps`.
- Preserve existing markdown behavior while avoiding structural fixes in CSS.

## Task Lists

GFM task lists are normalized before rendering by `remarkSplitMixedTaskLists`.

- Mixed task/bullet lists are split into separate lists so regular bullets keep bullets.
- Single-block split items are rendered as tight list items, preventing accidental `<p>` wrappers.
- `ListItem` uses a two-column grid: checkbox/control in the first column, task text and nested content in the second.
- Loose task items keep paragraph structure; the first paragraph contributes its checkbox/text to the grid, while later paragraphs align with the text column.
