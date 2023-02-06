import {Constants} from "../constants";
import {isHeadingMD, isHrMD} from "../util/fixBrowserBehavior";
import {
    getTopList,
    hasClosestBlock, hasClosestByAttribute,
    hasClosestByClassName,
} from "../util/hasClosest";
import {hasClosestByTag} from "../util/hasClosestByHeadings";
import {log} from "../util/log";
import {processCodeRender} from "../util/processCode";
import {getSelectPosition, setRangeByWbr} from "../util/selection";
import {renderToc} from "../util/toc";
import {processAfterRender} from "./process";
import {getMarkdown} from "../markdown/getMarkdown";

export const input = (vditor: IVditor, range: Range, ignoreSpace = false, event?: InputEvent) => {
    let blockElement = hasClosestBlock(range.startContainer);
    // 前后可以输入空格
    if (blockElement && !ignoreSpace && blockElement.getAttribute("data-type") !== "code-block") {
        if ((isHrMD(blockElement.innerHTML) && blockElement.previousElementSibling) ||
            isHeadingMD(blockElement.innerHTML)) {
            return;
        }

        // 前后空格处理
        const startOffset = getSelectPosition(blockElement, vditor.ir.element, range).start;

        // 开始可以输入空格
        let startSpace = true;
        for (let i = startOffset - 1;
            // 软换行后有空格
             i > blockElement.textContent.substr(0, startOffset).lastIndexOf("\n");
             i--) {
            if (blockElement.textContent.charAt(i) !== " " &&
                // 多个 tab 前删除不形成代码块 https://github.com/Vanessa219/vditor/issues/162 1
                blockElement.textContent.charAt(i) !== "\t") {
                startSpace = false;
                break;
            }
        }
        if (startOffset === 0) {
            startSpace = false;
        }

        // 结尾可以输入空格
        let endSpace = true;
        for (let i = startOffset - 1; i < blockElement.textContent.length; i++) {
            if (blockElement.textContent.charAt(i) !== " " && blockElement.textContent.charAt(i) !== "\n") {
                endSpace = false;
                break;
            }
        }

        if (startSpace) {
            if (typeof vditor.options.input === "function") {
                vditor.options.input(getMarkdown(vditor));
            }
            return;
        }
        if (endSpace) {
            const markerElement = hasClosestByClassName(range.startContainer, "vditor-ir__marker");
            if (markerElement) {
                // inline marker space https://github.com/Vanessa219/vditor/issues/239
            } else {
                const previousNode = range.startContainer.previousSibling as HTMLElement;
                if (previousNode && previousNode.nodeType !== 3 && previousNode.classList.contains("vditor-ir__node--expand")) {
                    // FireFox https://github.com/Vanessa219/vditor/issues/239
                    previousNode.classList.remove("vditor-ir__node--expand");
                }
                if (typeof vditor.options.input === "function") {
                    vditor.options.input(getMarkdown(vditor));
                }
                return;
            }
        }
    }

    vditor.ir.element.querySelectorAll(".vditor-ir__node--expand").forEach((item) => {
        item.classList.remove("vditor-ir__node--expand");
    });

    if (!blockElement) {
        // 使用顶级块元素，应使用 innerHTML
        blockElement = vditor.ir.element;
    }

    // document.exeComment insertHTML 会插入 wbr
    if (!blockElement.querySelector("wbr")) {
        const previewRenderElement = hasClosestByClassName(range.startContainer, "vditor-ir__preview");
        if (previewRenderElement) {
            previewRenderElement.previousElementSibling.insertAdjacentHTML("beforeend", "<wbr>");
        } else {
            range.insertNode(document.createElement("wbr"));
        }
    }

    // 清除浏览器自带的样式
    blockElement.querySelectorAll("[style]").forEach((item) => {
        item.removeAttribute("style");
    });

    if (blockElement.getAttribute("data-type") === "link-ref-defs-block") {
        // 修改链接引用
        blockElement = vditor.ir.element;
    }

    const isIRElement = blockElement.isEqualNode(vditor.ir.element);
    const footnoteElement = hasClosestByAttribute(blockElement, "data-type", "footnotes-block");
    let html = "";
    if (!isIRElement) {
        const blockquoteElement = hasClosestByTag(range.startContainer, "BLOCKQUOTE");
        // 列表需要到最顶层
        const topListElement = getTopList(range.startContainer);
        if (topListElement) {
            blockElement = topListElement;
        }

        // 应到引用层，否则 > --- 会解析为 front-matter；列表中有 blockquote 则解析 blockquote；blockquote 中有列表则解析列表
        if (blockquoteElement && (!topListElement || (topListElement && !blockquoteElement.contains(topListElement)))) {
            blockElement = blockquoteElement;
        }

        // 修改脚注
        if (footnoteElement) {
            blockElement = footnoteElement;
        }

        html = blockElement.outerHTML;

        if (blockElement.tagName === "UL" || blockElement.tagName === "OL") {
            // 如果为列表的话，需要把上下的列表都重绘
            const listPrevElement = blockElement.previousElementSibling;
            const listNextElement = blockElement.nextElementSibling;
            if (listPrevElement && (listPrevElement.tagName === "UL" || listPrevElement.tagName === "OL")) {
                html = listPrevElement.outerHTML + html;
                listPrevElement.remove();
            }
            if (listNextElement && (listNextElement.tagName === "UL" || listNextElement.tagName === "OL")) {
                html = html + listNextElement.outerHTML;
                listNextElement.remove();
            }
            // firefox 列表回车不会产生新的 list item https://github.com/Vanessa219/vditor/issues/194
            html = html.replace("<div><wbr><br></div>", "<li><p><wbr><br></p></li>");
        } else if (blockElement.previousElementSibling &&
            blockElement.previousElementSibling.textContent.replace(Constants.ZWSP, "") !== "" &&
            event && event.inputType === "insertParagraph") {
            // 换行时需要处理上一段落
            html = blockElement.previousElementSibling.outerHTML + html;
            blockElement.previousElementSibling.remove();
        }
        if (!blockElement.innerText.startsWith("```")) {
            // 添加链接引用
            vditor.ir.element.querySelectorAll("[data-type='link-ref-defs-block']").forEach((item) => {
                if (item && !(blockElement as HTMLElement).isEqualNode(item)) {
                    html += item.outerHTML;
                    item.remove();
                }
            });

            // 添加脚注
            vditor.ir.element.querySelectorAll("[data-type='footnotes-block']").forEach((item) => {
                if (item && !(blockElement as HTMLElement).isEqualNode(item)) {
                    html += item.outerHTML;
                    item.remove();
                }
            });
        }
    } else {
        html = blockElement.innerHTML;
    }

    log("SpinVditorIRDOM", html, "argument", vditor.options.debugger);
    html = vditor.lute.SpinVditorIRDOM(html);
    log("SpinVditorIRDOM", html, "result", vditor.options.debugger);

    if (isIRElement) {
        blockElement.innerHTML = html;
    } else {
        blockElement.outerHTML = html;

        // 更新正文中的 tip
        if (footnoteElement) {
            const footnoteItemElement = hasClosestByAttribute(vditor.ir.element.querySelector("wbr"),
                "data-type", "footnotes-def");
            if (footnoteItemElement) {
                const footnoteItemText = footnoteItemElement.textContent;
                const marker = footnoteItemText.substring(1, footnoteItemText.indexOf("]:"));
                const footnoteRefElement = vditor.ir.element.querySelector(`sup[data-type="footnotes-ref"][data-footnotes-label="${marker}"]`);
                if (footnoteRefElement) {
                    footnoteRefElement.setAttribute("aria-label",
                        footnoteItemText.substr(marker.length + 3).trim().substr(0, 24));
                }
            }
        }
    }

    //  linkref 合并及添加
    let firstLinkRefDefElement: HTMLElement;
    const allLinkRefDefsElement = vditor.ir.element.querySelectorAll("[data-type='link-ref-defs-block']");
    allLinkRefDefsElement.forEach((item: HTMLElement, index) => {
        if (index === 0) {
            firstLinkRefDefElement = item;
        } else {
            firstLinkRefDefElement.insertAdjacentHTML("beforeend", item.innerHTML);
            item.remove();
        }
    });
    if (allLinkRefDefsElement.length > 0) {
        vditor.ir.element.insertAdjacentElement("beforeend", allLinkRefDefsElement[0]);
    }

    // 脚注合并后添加的末尾
    let firstFootnoteElement: HTMLElement;
    const allFootnoteElement = vditor.ir.element.querySelectorAll("[data-type='footnotes-block']");
    allFootnoteElement.forEach((item: HTMLElement, index) => {
        if (index === 0) {
            firstFootnoteElement = item;
        } else {
            firstFootnoteElement.insertAdjacentHTML("beforeend", item.innerHTML);
            item.remove();
        }
    });
    if (allFootnoteElement.length > 0) {
        vditor.ir.element.insertAdjacentElement("beforeend", allFootnoteElement[0]);
    }

    setRangeByWbr(vditor.ir.element, range);

    vditor.ir.element.querySelectorAll(".vditor-ir__preview[data-render='2']").forEach((item: HTMLElement) => {
        processCodeRender(item, vditor);
    });

    renderToc(vditor);

    processAfterRender(vditor, {
        enableAddUndoStack: true,
        enableHint: true,
        enableInput: true,
    });
};
