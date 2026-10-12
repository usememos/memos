# Markdown Components

Small React components used by `MemoMarkdownRenderer` to style HTML emitted by `react-markdown`.

## Responsibilities

- Keep element styling local to each semantic HTML element.
- Strip the `node` prop from DOM output through `ReactMarkdownProps`.
- Preserve existing markdown behavior while avoiding structural fixes in CSS.

## Collapsible Sections

`Details` and `Summary` preserve native disclosure behavior and authored `open` attributes. Styling uses theme tokens and
direct-child selectors so nested indicators follow only their own disclosure. Contents enter `NestedMarkdownRenderContext`
to keep bare links inline, consistent with other nested Markdown blocks.

## Task Lists

GFM task lists are normalized before rendering by `remarkSplitMixedTaskLists`.

- Mixed task/bullet lists are split into separate lists so regular bullets keep bullets.
- Single-block split items are rendered as tight list items, preventing accidental `<p>` wrappers.
- `ListItem` uses a two-column grid: checkbox/control in the first column and a single task-body wrapper in the second.
- Task text, emphasis, links, tags, and nested content stay inside the body wrapper so inline markdown does not become separate grid items.
- Loose task items keep paragraph structure inside the task-body wrapper.
