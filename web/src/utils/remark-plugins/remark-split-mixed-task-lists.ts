import type { List, ListItem, Root } from "mdast";
import type { Parent } from "unist";

const isTaskItem = (item: ListItem): boolean => typeof item.checked === "boolean";

const isSingleBlockItem = (item: ListItem): boolean => item.children.length <= 1;

const hasLooseBlockItem = (item: ListItem): boolean => !isSingleBlockItem(item) && Boolean(item.spread);

const normalizeSplitListItems = (items: ListItem[]): ListItem[] =>
  items.map((item) => (isSingleBlockItem(item) ? { ...item, spread: false } : item));

const splitMixedList = (list: List): List[] => {
  const hasTaskItem = list.children.some(isTaskItem);
  const hasRegularItem = list.children.some((item) => !isTaskItem(item));

  if (!hasTaskItem || !hasRegularItem) {
    return [list];
  }

  const groups: Array<{ isTaskGroup: boolean; items: ListItem[] }> = [];
  for (const item of list.children) {
    const isTaskGroup = isTaskItem(item);
    const previousGroup = groups.at(-1);

    if (previousGroup && previousGroup.isTaskGroup === isTaskGroup) {
      previousGroup.items.push(item);
    } else {
      groups.push({ isTaskGroup, items: [item] });
    }
  }

  return groups.map(({ items }) => {
    const children = normalizeSplitListItems(items);
    return {
      ...list,
      children,
      spread: children.some(hasLooseBlockItem),
    };
  });
};

const splitMixedTaskListsInParent = (parent: Parent): void => {
  for (let index = 0; index < parent.children.length; index++) {
    const child = parent.children[index];

    if ("children" in child && Array.isArray(child.children)) {
      splitMixedTaskListsInParent(child as Parent);
    }

    if (child.type !== "list") {
      continue;
    }

    const splitLists = splitMixedList(child as List);
    if (splitLists.length > 1) {
      parent.children.splice(index, 1, ...splitLists);
      index += splitLists.length - 1;
    }
  }
};

export const remarkSplitMixedTaskLists = () => {
  return (tree: Root) => {
    splitMixedTaskListsInParent(tree);
  };
};
