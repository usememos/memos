import {Constants} from "../constants";
import {setRangeByWbr, setSelectionFocus} from "../util/selection";

export const previoueIsEmptyA = (node: Node) => {
    let previousNode = node.previousSibling as HTMLElement;
    while (previousNode) {
        if (previousNode.nodeType !== 3 && previousNode.tagName === "A" && !previousNode.previousSibling
            && previousNode.innerHTML.replace(Constants.ZWSP, "") === "" && previousNode.nextSibling) {
            return previousNode;
        }
        previousNode = previousNode.previousSibling as HTMLElement;
    }
    return false;
};

export const nextIsCode = (range: Range) => {
    let nextNode: HTMLElement = range.startContainer.nextSibling as HTMLElement;
    while (nextNode && nextNode.textContent === "") {
        nextNode = nextNode.nextSibling as HTMLElement;
    }

    if (nextNode && nextNode.nodeType !== 3 && (nextNode.tagName === "CODE" ||
        nextNode.getAttribute("data-type") === "math-inline" ||
        nextNode.getAttribute("data-type") === "html-entity" ||
        nextNode.getAttribute("data-type") === "html-inline")
    ) {
        return true;
    }
    return false;
};

export const getNextHTML = (node: Node) => {
    let html = "";
    let nextNode = node.nextSibling;
    while (nextNode) {
        if (nextNode.nodeType === 3) {
            html += nextNode.textContent;
        } else {
            html += (nextNode as HTMLElement).outerHTML;
        }
        nextNode = nextNode.nextSibling;
    }
    return html;
};

export const getPreviousHTML = (node: Node) => {
    let html = "";
    let previousNode = node.previousSibling;
    while (previousNode) {
        if (previousNode.nodeType === 3) {
            html = previousNode.textContent + html;
        } else {
            html = (previousNode as HTMLElement).outerHTML + html;
        }
        previousNode = previousNode.previousSibling;
    }
    return html;
};

export const getRenderElementNextNode = (blockCodeElement: HTMLElement) => {
    let nextNode = blockCodeElement;
    while (nextNode && !nextNode.nextSibling) {
        nextNode = nextNode.parentElement;
    }

    return nextNode.nextSibling;
};

export const splitElement = (range: Range) => {
    const previousHTML = getPreviousHTML(range.startContainer);
    const nextHTML = getNextHTML(range.startContainer);
    const text = range.startContainer.textContent;
    const offset = range.startOffset;

    let beforeHTML = "";
    let afterHTML = "";

    if (text.substr(0, offset) !== "" && text.substr(0, offset) !== Constants.ZWSP || previousHTML) {
        beforeHTML = `${previousHTML}${text.substr(0, offset)}`;
    }
    if (text.substr(offset) !== "" && text.substr(offset) !== Constants.ZWSP || nextHTML) {
        afterHTML = `${text.substr(offset)}${nextHTML}`;
    }

    return {
        afterHTML,
        beforeHTML,
    };
};

export const modifyPre = (vditor: IVditor, range: Range) => {
    // 没有被块元素包裹
    Array.from(vditor.wysiwyg.element.childNodes).find((node: HTMLElement) => {
        if (node.nodeType === 3) {
            const pElement = document.createElement("p");
            pElement.setAttribute("data-block", "0");
            pElement.textContent = node.textContent;
            // 为空按下 tab 且 tab = '    ' 时，range.startContainer 不为 node
            const cloneRangeOffset = range.startContainer.nodeType === 3 ? range.startOffset : node.textContent.length;
            node.parentNode.insertBefore(pElement, node);
            node.remove();
            range.setStart(pElement.firstChild, Math.min(pElement.firstChild.textContent.length, cloneRangeOffset));
            range.collapse(true);
            setSelectionFocus(range);
            return true;
        } else if (!node.getAttribute("data-block")) {
            if (node.tagName === "P") {
                node.remove();
            } else {
                if (node.tagName === "DIV") {
                    range.insertNode(document.createElement("wbr"));
                    // firefox 列表换行产生 div
                    node.outerHTML = `<p data-block="0">${node.innerHTML}</p>`;
                } else {
                    if (node.tagName === "BR") {
                        // firefox 空换行产生 BR
                        node.outerHTML = `<p data-block="0">${node.outerHTML}<wbr></p>`;
                    } else {
                        range.insertNode(document.createElement("wbr"));
                        node.outerHTML = `<p data-block="0">${node.outerHTML}</p>`;
                    }
                }
                setRangeByWbr(vditor.wysiwyg.element, range);
                range = getSelection().getRangeAt(0);
            }
            return true;
        }
    });
};
