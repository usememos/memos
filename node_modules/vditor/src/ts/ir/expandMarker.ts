import {hasClosestByClassName, hasTopClosestByClassName} from "../util/hasClosest";
import {setSelectionFocus} from "../util/selection";

const nextIsNode = (range: Range) => {
    const startContainer = range.startContainer;
    if (startContainer.nodeType === 3 && startContainer.nodeValue.length !== range.startOffset) {
        return false;
    }

    let nextNode: HTMLElement = startContainer.nextSibling as HTMLElement;

    while (nextNode && nextNode.textContent === "") {
        nextNode = nextNode.nextSibling as HTMLElement;
    }

    if (!nextNode) {
        // *em*|**string**
        const markerElement = hasClosestByClassName(startContainer, "vditor-ir__marker");
        if (markerElement && !markerElement.nextSibling) {
            const parentNextNode = startContainer.parentElement.parentElement.nextSibling as HTMLElement;
            if (parentNextNode && parentNextNode.nodeType !== 3 &&
                parentNextNode.classList.contains("vditor-ir__node")) {
                return parentNextNode;
            }
        }
        return false;
    } else if (nextNode && nextNode.nodeType !== 3 && nextNode.classList.contains("vditor-ir__node") &&
        !nextNode.getAttribute("data-block")) {
        // test|*em*
        return nextNode;
    }

    return false;
};

const previousIsNode = (range: Range) => {
    const startContainer = range.startContainer;
    const previousNode = startContainer.previousSibling as HTMLElement;
    if (startContainer.nodeType === 3 && range.startOffset === 0 && previousNode && previousNode.nodeType !== 3 &&
        // *em*|text
        previousNode.classList.contains("vditor-ir__node") && !previousNode.getAttribute("data-block")) {
        return previousNode;
    }
    return false;
};

export const expandMarker = (range: Range, vditor: IVditor) => {
    vditor.ir.element.querySelectorAll(".vditor-ir__node--expand").forEach((item) => {
        item.classList.remove("vditor-ir__node--expand");
    });

    const nodeElement = hasTopClosestByClassName(range.startContainer, "vditor-ir__node");
    const nodeElementEnd = !range.collapsed && hasTopClosestByClassName(range.endContainer, "vditor-ir__node");
    // 选中文本为同一个 nodeElement 内时，需要展开
    if (!range.collapsed && (!nodeElement || nodeElement !== nodeElementEnd)) {
        return;
    }

    if (nodeElement) {
        nodeElement.classList.add("vditor-ir__node--expand");
        nodeElement.classList.remove("vditor-ir__node--hidden");
        // https://github.com/Vanessa219/vditor/issues/615 safari中光标位置跳动
        setSelectionFocus(range);
    }

    const nextNode = nextIsNode(range);
    if (nextNode) {
        nextNode.classList.add("vditor-ir__node--expand");
        nextNode.classList.remove("vditor-ir__node--hidden");
        return;
    }

    const previousNode = previousIsNode(range);
    if (previousNode) {
        previousNode.classList.add("vditor-ir__node--expand");
        previousNode.classList.remove("vditor-ir__node--hidden");
        return;
    }
};
