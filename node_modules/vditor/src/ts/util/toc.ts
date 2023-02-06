import {mathRender} from "../markdown/mathRender";
import {execAfterRender, insertAfterBlock, insertBeforeBlock} from "./fixBrowserBehavior";
import {hasClosestByClassName, hasClosestByMatchTag} from "./hasClosest";
import {getSelectPosition} from "./selection";

export const renderToc = (vditor: IVditor) => {
    if (vditor.currentMode === "sv") {
        return;
    }
    const editorElement = vditor[vditor.currentMode].element;
    let tocHTML = vditor.outline.render(vditor);
    if (tocHTML === "") {
        tocHTML = "[ToC]";
    }
    editorElement.querySelectorAll('[data-type="toc-block"]').forEach((item: HTMLElement) => {
        item.innerHTML = tocHTML;
        mathRender(item, {
            cdn: vditor.options.cdn,
            math: vditor.options.preview.math,
        });
    });
};

export const clickToc = (event: MouseEvent & { target: HTMLElement }, vditor: IVditor) => {
    const spanElement = hasClosestByMatchTag(event.target, "SPAN");
    if (spanElement && hasClosestByClassName(spanElement, "vditor-toc")) {
        const headingElement = vditor[vditor.currentMode].element.querySelector("#" + spanElement.getAttribute("data-target-id")) as HTMLElement;
        if (headingElement) {
            if (vditor.options.height === "auto") {
                let windowScrollY = headingElement.offsetTop + vditor.element.offsetTop;
                if (!vditor.options.toolbarConfig.pin) {
                    windowScrollY += vditor.toolbar.element.offsetHeight;
                }
                window.scrollTo(window.scrollX, windowScrollY);
            } else {
                if (vditor.element.offsetTop < window.scrollY) {
                    window.scrollTo(window.scrollX, vditor.element.offsetTop);
                }
                vditor[vditor.currentMode].element.scrollTop = headingElement.offsetTop;
            }
        }
        return;
    }
};

export const keydownToc = (blockElement: HTMLElement, vditor: IVditor, event: KeyboardEvent, range: Range) => {
    // toc 前无元素，插入空块
    if (blockElement.previousElementSibling &&
        blockElement.previousElementSibling.classList.contains("vditor-toc")) {
        if (event.key === "Backspace" &&
            getSelectPosition(blockElement, vditor[vditor.currentMode].element, range).start === 0) {
            blockElement.previousElementSibling.remove();
            execAfterRender(vditor);
            return true;
        }
        if (insertBeforeBlock(vditor, event, range, blockElement, blockElement.previousElementSibling as HTMLElement)) {
            return true;
        }
    }
    // toc 后无元素，插入空块
    if (blockElement.nextElementSibling &&
        blockElement.nextElementSibling.classList.contains("vditor-toc")) {
        if (event.key === "Delete" &&
            getSelectPosition(blockElement, vditor[vditor.currentMode].element, range).start
            >= blockElement.textContent.trimRight().length) {
            blockElement.nextElementSibling.remove();
            execAfterRender(vditor);
            return true;
        }
        if (insertAfterBlock(vditor, event, range, blockElement, blockElement.nextElementSibling as HTMLElement)) {
            return true;
        }
    }
    // toc 删除
    if (event.key === "Backspace" || event.key === "Delete") {
        const tocElement = hasClosestByClassName(range.startContainer, "vditor-toc");
        if (tocElement) {
            tocElement.remove();
            execAfterRender(vditor);
            return true;
        }
    }
};
