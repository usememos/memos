import { type Block, type Doc, type Extension, type ListItemBlock, quoteKind } from "@usememos/editor";

/** Attribute on the empty element a hidden completed task item renders into, for the reading CSS. */
export const HIDDEN_COMPLETED_TASK_ATTRIBUTE = "data-memos-hidden-completed-task";

/** Name of the block-view extension, for `editor.refreshViews()` when the preference changes. */
export const MEMO_TASK_VISIBILITY_EXTENSION = "memoTaskVisibility";

const isCompletedTask = (block: Block): block is ListItemBlock => block.type === "listItem" && block.listType === "task" && block.checked;

/** One answer per document: the editor renders a block at a time and keeps documents immutable. */
const hiddenByDoc = new WeakMap<Doc, ReadonlySet<string>>();

/**
 * The completed task items a reader can stop seeing without losing work. Nested
 * list items belong to the item above them until the indent drops back; a
 * completed parent above an open task or other nested list content stays visible
 * as that content's context. A note that follows the list is not nesting.
 *
 * The editor's block views draw these items empty instead of drawing the block,
 * so this only decides what is shown: the document, its ids and its Markdown are
 * untouched, and ticking a remaining task still changes only that item's bracket.
 */
export function hiddenCompletedTaskIds(doc: Doc): ReadonlySet<string> {
  const cached = hiddenByDoc.get(doc);
  if (cached) return cached;
  const blocks = doc.blocks;
  const hidden = new Set<string>();

  const hasVisibleDescendant = (start: number, indent: number, quote: ReturnType<typeof quoteKind>): boolean => {
    for (let index = start + 1; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (block.type !== "listItem") return false;
      if (quoteKind(block) !== quote) return false;
      if (block.indent <= indent) return false;
      if (!isCompletedTask(block) || hasVisibleDescendant(index, block.indent, quote)) return true;
    }
    return false;
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    if (!isCompletedTask(block)) continue;
    if (!hasVisibleDescendant(index, block.indent, quoteKind(block))) hidden.add(block.id);
  }
  hiddenByDoc.set(doc, hidden);
  return hidden;
}

/**
 * The reading preference as a block view: while `isEnabled()` is true, completed
 * task items with no open work below them render empty; everything else renders
 * as the editor draws it, checkboxes included. A preference change re-runs this
 * through `refreshViews(MEMO_TASK_VISIBILITY_EXTENSION)`, and an edited document
 * re-renders the blocks it changed.
 */
export function memoTaskVisibilityExtension(isEnabled: () => boolean): Extension {
  return {
    name: MEMO_TASK_VISIBILITY_EXTENSION,
    blockView: {
      match: isCompletedTask,
      render: (block, element, ctx) => {
        if (!isEnabled() || !hiddenCompletedTaskIds(ctx.editor.state.doc).has(block.id)) return false;
        element.setAttribute(HIDDEN_COMPLETED_TASK_ATTRIBUTE, "");
      },
    },
  };
}

/** The editor's read-only rendering of a raw Markdown block whose structure its block model cannot hold. */
const RAW_MARKDOWN_VIEW_SELECTOR = ".mbe-view-markdown";

const LIST_ITEM_CLASS = "mbe-list-item";

const listItemIndent = (item: HTMLElement): number => {
  const indent = Number(item.dataset.indent);
  return Number.isFinite(indent) ? indent : 0;
};

/** The box the editor draws for a task item, or null for an ordinary list item. */
const taskCheckbox = (item: HTMLElement): HTMLInputElement | null =>
  item.querySelector<HTMLInputElement>(":scope > .mbe-marker > input.mbe-checkbox");

/**
 * Whether an item keeps a list below it worth reading: a nested element the raw
 * rendering drew, or a following item indented below it that the editor lowered
 * into the same flow.
 */
const hasVisibleDescendant = (item: HTMLElement, visible: ReadonlyMap<HTMLElement, boolean>): boolean => {
  for (const descendant of Array.from(item.querySelectorAll<HTMLElement>(`.${LIST_ITEM_CLASS}`))) {
    if (visible.get(descendant) === true) return true;
  }
  const indent = listItemIndent(item);
  for (let sibling = item.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
    if (!(sibling instanceof HTMLElement) || !sibling.classList.contains(LIST_ITEM_CLASS)) break;
    if (listItemIndent(sibling) <= indent) break;
    if (visible.get(sibling) === true) return true;
  }
  return false;
};

const setTaskHidden = (item: HTMLElement, hidden: boolean): void => {
  if (hidden) {
    item.setAttribute(HIDDEN_COMPLETED_TASK_ATTRIBUTE, "");
    item.hidden = true;
    return;
  }
  if (!item.hasAttribute(HIDDEN_COMPLETED_TASK_ATTRIBUTE)) return;
  item.removeAttribute(HIDDEN_COMPLETED_TASK_ATTRIBUTE);
  item.hidden = false;
};

/**
 * The reading preference for a list the editor keeps as one raw Markdown block: a
 * list whose item holds a second paragraph or a code block does not fit the block
 * model, so no block view sees its items and the editor draws them itself. This
 * marks the completed ones in that drawn DOM, with the same rule as
 * `hiddenCompletedTaskIds`: a completed item stays while a nested item stays, so
 * open work and other list content below it keep their context. The Markdown, the
 * document's block ids and every checkbox stay as they are.
 *
 * Reapplied after the editor draws again; `editor.refreshViews` does not reach
 * these nested elements.
 */
export function applyCompletedTaskVisibility(root: HTMLElement, isEnabled: boolean): void {
  for (const container of Array.from(root.querySelectorAll<HTMLElement>(RAW_MARKDOWN_VIEW_SELECTOR))) {
    const items = Array.from(container.querySelectorAll<HTMLElement>(`.${LIST_ITEM_CLASS}`));
    const visible = new Map<HTMLElement, boolean>();
    // Document order puts every descendant and later sibling after its item, so
    // walking backwards decides what stays before anything it keeps visible.
    for (let index = items.length - 1; index >= 0; index -= 1) {
      const item = items[index];
      const checkbox = taskCheckbox(item);
      const completed = item.dataset.listType === "task" && checkbox !== null && checkbox.checked;
      const stays = !completed || hasVisibleDescendant(item, visible);
      visible.set(item, stays);
      setTaskHidden(item, isEnabled && !stays);
    }
  }
}
