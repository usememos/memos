---
title: "Markdown component contract"
status: draft
tags:
  - "markdown"
---

## Purpose & Scope
This spec defines the markdown element components in `@web/src/components/MemoContent/markdown/` and the task-list normalization they rely on. `MemoMarkdownRenderer` (`@web/src/components/MemoContent/MemoMarkdownRenderer.tsx`) maps the HTML elements that `react-markdown` emits to these components; every read-only memo view depends on the result. Out of scope: the rest of the remark/rehype pipeline, code blocks, tables, math, mentions, and tags.

## Surface
- Components: `AnchorLink`, `Blockquote`, `Heading`, `HorizontalRule`, `Image`, `InlineCode`, `Link`, `List`, `ListItem`, `Paragraph`, exported from `@web/src/components/MemoContent/markdown/index.ts`.
- Shared prop type: `ReactMarkdownProps` (`node?: Element`) in `@web/src/components/MemoContent/markdown/types.ts`.
- Task-list normalization: `remarkSplitMixedTaskLists` in `@web/src/utils/remark-plugins/remark-split-mixed-task-lists.ts`, registered in `@web/src/components/MemoContent/pipeline.ts`.
- Task-list styles: `markdownStyles.taskListItem` (two-column grid) and `markdownStyles.taskItemContent` in `@web/src/lib/markdownStyles.ts`.

## Normative Behavior
1. Each component MUST keep the styling of its semantic HTML element local to that component.
2. Each component MUST strip the `node` prop from its DOM output, typed through `ReactMarkdownProps`.
3. The components MUST preserve existing markdown behavior.
4. The components MUST NOT fix markdown structure through CSS.
5. The renderer MUST normalize GFM task lists with `remarkSplitMixedTaskLists` before rendering.
6. WHEN a list mixes task items and regular items, the plugin MUST split it into separate lists so regular items keep their bullets.
7. WHEN a split item holds a single block, the plugin MUST mark it tight, so no `<p>` wrapper is added.
8. WHEN `ListItem` renders a task item, it MUST use a two-column grid: the checkbox control first, one task-body wrapper second.
9. `ListItem` MUST keep task text, emphasis, links, tags, and nested content inside the task-body wrapper.
10. WHEN a task item is loose, `ListItem` MUST keep its paragraph structure inside the task-body wrapper.

## Constraints & Invariants
- Invariant: inline markdown inside a task item never becomes a separate grid item.
- Invariant: a list that holds only task items, or only regular items, passes through the plugin unchanged.

## Failure Behavior
Not recorded in the source.

## Conformance
An implementation conforms when it meets behaviors 1–10 and holds the invariants.
Given a list `- [ ] a` followed by `- b`,
When the memo renders,
Then `a` renders as a task item and `b` keeps its bullet in a separate list.
