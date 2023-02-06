import {hasClosestBlock} from "../util/hasClosest";
import {getEditorRange, setRangeByWbr} from "../util/selection";
import {renderToc} from "../util/toc";

export const setHeading = (vditor: IVditor, tagName: string) => {
    const range = getEditorRange(vditor);
    let blockElement = hasClosestBlock(range.startContainer);
    if (!blockElement) {
        blockElement = range.startContainer.childNodes[range.startOffset] as HTMLElement;
    }
    if (!blockElement && vditor.wysiwyg.element.children.length === 0) {
        blockElement = vditor.wysiwyg.element;
    }
    if (blockElement && !blockElement.classList.contains("vditor-wysiwyg__block")) {
        range.insertNode(document.createElement("wbr"));
        // Firefox 需要 trim https://github.com/Vanessa219/vditor/issues/207
        if (blockElement.innerHTML.trim() === "<wbr>") {
            // Firefox 光标对不齐 https://github.com/Vanessa219/vditor/issues/199 1
            blockElement.innerHTML = "<wbr><br>";
        }
        if (blockElement.tagName === "BLOCKQUOTE" || blockElement.classList.contains("vditor-reset")) {
            blockElement.innerHTML = `<${tagName} data-block="0">${blockElement.innerHTML.trim()}</${tagName}>`;
        } else {
            blockElement.outerHTML = `<${tagName} data-block="0">${blockElement.innerHTML.trim()}</${tagName}>`;
        }
        setRangeByWbr(vditor.wysiwyg.element, range);
        renderToc(vditor);
    }
};

export const removeHeading = (vditor: IVditor) => {
    const range = getSelection().getRangeAt(0);
    let blockElement = hasClosestBlock(range.startContainer);
    if (!blockElement) {
        blockElement = range.startContainer.childNodes[range.startOffset] as HTMLElement;
    }
    if (blockElement) {
        range.insertNode(document.createElement("wbr"));
        blockElement.outerHTML = `<p data-block="0">${blockElement.innerHTML}</p>`;
        setRangeByWbr(vditor.wysiwyg.element, range);
    }
    vditor.wysiwyg.popover.style.display = "none";
};
