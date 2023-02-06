import {Constants} from "../constants";
import {input as IRInput} from "../ir/input";
import {processAfterRender} from "../ir/process";
import {processAfterRender as processSVAfterRender, processPaste} from "../sv/process";
import {uploadFiles} from "../upload/index";
import {setHeaders} from "../upload/setHeaders";
import {afterRenderEvent} from "../wysiwyg/afterRenderEvent";
import {input} from "../wysiwyg/input";
import {isCtrl, isFirefox} from "./compatibility";
import {scrollCenter} from "./editorCommonEvent";
import {
    getTopList,
    hasClosestBlock,
    hasClosestByAttribute,
    hasClosestByClassName,
    hasClosestByMatchTag,
} from "./hasClosest";
import {getLastNode} from "./hasClosest";
import {highlightToolbar} from "./highlightToolbar";
import {matchHotKey} from "./hotKey";
import {processCodeRender, processPasteCode} from "./processCode";
import {
    getEditorRange,
    getSelectPosition,
    insertHTML,
    setRangeByWbr,
    setSelectionByPosition, setSelectionFocus,
} from "./selection";

// https://github.com/Vanessa219/vditor/issues/508 软键盘无法删除空块
export const fixGSKeyBackspace = (event: KeyboardEvent, vditor: IVditor, startContainer: Node) => {
    if (event.keyCode === 229 && event.code === "" && event.key === "Unidentified" && vditor.currentMode !== "sv") {
        const blockElement = hasClosestBlock(startContainer);
        // 移动端的标点符号都显示为 299，因此需限定为空删除的条件
        if (blockElement && blockElement.textContent.trim() === "") {
            vditor[vditor.currentMode].composingLock = true;
            return false;
        }
    }
    return true;
};

// https://github.com/Vanessa219/vditor/issues/361 代码块后输入中文
export const fixCJKPosition = (range: Range, vditor: IVditor, event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === "Tab" || event.key === "Backspace" || event.key.indexOf("Arrow") > -1
        || isCtrl(event) || event.key === "Escape" || event.shiftKey || event.altKey) {
        return;
    }
    const pLiElement = hasClosestByMatchTag(range.startContainer, "P") ||
        hasClosestByMatchTag(range.startContainer, "LI");
    if (pLiElement && getSelectPosition(pLiElement, vditor[vditor.currentMode].element, range).start === 0) {

        // https://github.com/Vanessa219/vditor/issues/1289 WKWebView切换输入法产生六分之一空格，造成光标错位
        pLiElement.nodeValue = pLiElement.nodeValue.replace(/\u2006/g, '');

        const zwspNode = document.createTextNode(Constants.ZWSP);
        range.insertNode(zwspNode);
        range.setStartAfter(zwspNode);
    }
};

// https://github.com/Vanessa219/vditor/issues/381 光标在内联数学公式中无法向下移动
export const fixCursorDownInlineMath = (range: Range, key: string) => {
    if (key === "ArrowDown" || key === "ArrowUp") {
        const inlineElement = hasClosestByAttribute(range.startContainer, "data-type", "math-inline") ||
            hasClosestByAttribute(range.startContainer, "data-type", "html-entity") ||
            hasClosestByAttribute(range.startContainer, "data-type", "html-inline");
        if (inlineElement) {
            if (key === "ArrowDown") {
                range.setStartAfter(inlineElement.parentElement);
            }
            if (key === "ArrowUp") {
                range.setStartBefore(inlineElement.parentElement);
            }
        }
    }
};

export const insertEmptyBlock = (vditor: IVditor, position: InsertPosition) => {
    const range = getEditorRange(vditor);
    const blockElement = hasClosestBlock(range.startContainer);
    if (blockElement) {
        blockElement.insertAdjacentHTML(position, `<p data-block="0">${Constants.ZWSP}<wbr>\n</p>`);
        setRangeByWbr(vditor[vditor.currentMode].element, range);
        highlightToolbar(vditor);
        execAfterRender(vditor);
    }
};

export const isFirstCell = (cellElement: HTMLElement) => {
    const tableElement = hasClosestByMatchTag(cellElement, "TABLE") as HTMLTableElement;
    if (tableElement && tableElement.rows[0].cells[0].isSameNode(cellElement)) {
        return tableElement;
    }
    return false;
};

export const isLastCell = (cellElement: HTMLElement) => {
    const tableElement = hasClosestByMatchTag(cellElement, "TABLE") as HTMLTableElement;
    if (tableElement && tableElement.lastElementChild.lastElementChild.lastElementChild.isSameNode(cellElement)) {
        return tableElement;
    }
    return false;
};

// 光标设置到前一个表格中
const goPreviousCell = (cellElement: HTMLElement, range: Range, isSelected = true) => {
    let previousElement = cellElement.previousElementSibling;
    if (!previousElement) {
        if (cellElement.parentElement.previousElementSibling) {
            previousElement = cellElement.parentElement.previousElementSibling.lastElementChild;
        } else if (cellElement.parentElement.parentElement.tagName === "TBODY" &&
            cellElement.parentElement.parentElement.previousElementSibling) {
            previousElement = cellElement.parentElement
                .parentElement.previousElementSibling.lastElementChild.lastElementChild;
        } else {
            previousElement = null;
        }
    }
    if (previousElement) {
        range.selectNodeContents(previousElement);
        if (!isSelected) {
            range.collapse(false);
        }
        setSelectionFocus(range);
    }
    return previousElement;
};

export const insertAfterBlock = (vditor: IVditor, event: KeyboardEvent, range: Range, element: HTMLElement,
                                 blockElement: HTMLElement) => {
    const position = getSelectPosition(element, vditor[vditor.currentMode].element, range);
    if ((event.key === "ArrowDown" && element.textContent.trimRight().substr(position.start).indexOf("\n") === -1) ||
        (event.key === "ArrowRight" && position.start >= element.textContent.trimRight().length)) {
        const nextElement = blockElement.nextElementSibling;
        if (!nextElement ||
            (nextElement && (nextElement.tagName === "TABLE" || nextElement.getAttribute("data-type")))) {
            blockElement.insertAdjacentHTML("afterend",
                `<p data-block="0">${Constants.ZWSP}<wbr></p>`);
            setRangeByWbr(vditor[vditor.currentMode].element, range);
        } else {
            range.selectNodeContents(nextElement);
            range.collapse(true);
            setSelectionFocus(range);
        }
        event.preventDefault();
        return true;
    }
    return false;
};

export const insertBeforeBlock = (vditor: IVditor, event: KeyboardEvent, range: Range, element: HTMLElement,
                                  blockElement: HTMLElement) => {
    const position = getSelectPosition(element, vditor[vditor.currentMode].element, range);
    if ((event.key === "ArrowUp" && element.textContent.substr(0, position.start).indexOf("\n") === -1) ||
        ((event.key === "ArrowLeft" || (event.key === "Backspace" && range.toString() === "")) &&
            position.start === 0)) {
        const previousElement = blockElement.previousElementSibling;
        // table || code
        if (!previousElement ||
            (previousElement && (previousElement.tagName === "TABLE" || previousElement.getAttribute("data-type")))) {
            blockElement.insertAdjacentHTML("beforebegin",
                `<p data-block="0">${Constants.ZWSP}<wbr></p>`);
            setRangeByWbr(vditor[vditor.currentMode].element, range);
        } else {
            range.selectNodeContents(previousElement);
            range.collapse(false);
            setSelectionFocus(range);
        }
        event.preventDefault();
        return true;
    }
    return false;
};

export const listToggle = (vditor: IVditor, range: Range, type: string, cancel = true) => {
    const itemElement = hasClosestByMatchTag(range.startContainer, "LI");
    vditor[vditor.currentMode].element.querySelectorAll("wbr").forEach((wbr) => {
        wbr.remove();
    });
    range.insertNode(document.createElement("wbr"));

    if (cancel && itemElement) {
        // 取消
        let pHTML = "";
        for (let i = 0; i < itemElement.parentElement.childElementCount; i++) {
            const inputElement = itemElement.parentElement.children[i].querySelector("input");
            if (inputElement) {
                inputElement.remove();
            }
            pHTML += `<p data-block="0">${itemElement.parentElement.children[i].innerHTML.trimLeft()}</p>`;
        }
        itemElement.parentElement.insertAdjacentHTML("beforebegin", pHTML);
        itemElement.parentElement.remove();
    } else {
        if (!itemElement) {
            // 添加
            let blockElement = hasClosestByAttribute(range.startContainer, "data-block", "0");
            if (!blockElement) {
                vditor[vditor.currentMode].element.querySelector("wbr").remove();
                blockElement = vditor[vditor.currentMode].element.querySelector("p");
                blockElement.innerHTML = "<wbr>";
            }
            if (type === "check") {
                blockElement.insertAdjacentHTML("beforebegin",
                    `<ul data-block="0"><li class="vditor-task"><input type="checkbox" /> ${blockElement.innerHTML}</li></ul>`);
                blockElement.remove();
            } else if (type === "list") {
                blockElement.insertAdjacentHTML("beforebegin",
                    `<ul data-block="0"><li>${blockElement.innerHTML}</li></ul>`);
                blockElement.remove();
            } else if (type === "ordered-list") {
                blockElement.insertAdjacentHTML("beforebegin",
                    `<ol data-block="0"><li>${blockElement.innerHTML}</li></ol>`);
                blockElement.remove();
            }
        } else {
            // 切换
            if (type === "check") {
                itemElement.parentElement.querySelectorAll("li").forEach((item) => {
                    item.insertAdjacentHTML("afterbegin",
                        `<input type="checkbox" />${item.textContent.indexOf(" ") === 0 ? "" : " "}`);
                    item.classList.add("vditor-task");
                });
            } else {
                if (itemElement.querySelector("input")) {
                    itemElement.parentElement.querySelectorAll("li").forEach((item) => {
                        item.querySelector("input").remove();
                        item.classList.remove("vditor-task");
                    });
                }
                let element;
                if (type === "list") {
                    element = document.createElement("ul");
                    element.setAttribute("data-marker", "*");
                } else {
                    element = document.createElement("ol");
                    element.setAttribute("data-marker", "1.");
                }
                element.setAttribute("data-block", "0");
                element.setAttribute("data-tight", itemElement.parentElement.getAttribute("data-tight"));
                element.innerHTML = itemElement.parentElement.innerHTML;
                itemElement.parentElement.parentNode.replaceChild(element, itemElement.parentElement);
            }
        }
    }
};

export const listIndent = (vditor: IVditor, liElement: HTMLElement, range: Range) => {
    const previousElement = liElement.previousElementSibling;
    if (liElement && previousElement) {
        const liElements: HTMLElement[] = [liElement];
        Array.from(range.cloneContents().children).forEach((item, index) => {
            if (item.nodeType !== 3 && liElement && item.textContent.trim() !== ""
                && liElement.getAttribute("data-node-id") === item.getAttribute("data-node-id")) {
                if (index !== 0) {
                    liElements.push(liElement);
                }
                liElement = liElement.nextElementSibling as HTMLElement;
            }
        });

        vditor[vditor.currentMode].element.querySelectorAll("wbr").forEach((wbr) => {
            wbr.remove();
        });
        range.insertNode(document.createElement("wbr"));
        const liParentElement = previousElement.parentElement;

        let liHTML = "";
        liElements.forEach((item: HTMLElement) => {
            let marker = item.getAttribute("data-marker");
            if (marker.length !== 1) {
                marker = `1${marker.slice(-1)}`;
            }
            liHTML += `<li data-node-id="${item.getAttribute("data-node-id")}" data-marker="${marker}">${item.innerHTML}</li>`;
            item.remove();
        });
        previousElement.insertAdjacentHTML("beforeend",
            `<${liParentElement.tagName} data-block="0">${liHTML}</${liParentElement.tagName}>`);

        if (vditor.currentMode === "wysiwyg") {
            liParentElement.outerHTML = vditor.lute.SpinVditorDOM(liParentElement.outerHTML);
        } else {
            liParentElement.outerHTML = vditor.lute.SpinVditorIRDOM(liParentElement.outerHTML);
        }

        setRangeByWbr(vditor[vditor.currentMode].element, range);
        const tempTopListElement = getTopList(range.startContainer);
        if (tempTopListElement) {
            tempTopListElement.querySelectorAll(`.vditor-${vditor.currentMode}__preview[data-render='2']`)
                .forEach((item: HTMLElement) => {
                    processCodeRender(item, vditor);
                    if (vditor.currentMode === "wysiwyg") {
                        item.previousElementSibling.setAttribute("style", "display:none");
                    }
                });
        }
        execAfterRender(vditor);
        highlightToolbar(vditor);
    } else {
        vditor[vditor.currentMode].element.focus();
    }
};

export const listOutdent = (vditor: IVditor, liElement: HTMLElement, range: Range, topListElement: HTMLElement) => {
    const liParentLiElement = hasClosestByMatchTag(liElement.parentElement, "LI");
    if (liParentLiElement) {
        vditor[vditor.currentMode].element.querySelectorAll("wbr").forEach((wbr) => {
            wbr.remove();
        });
        range.insertNode(document.createElement("wbr"));

        const liParentElement = liElement.parentElement;
        const liParentAfterElement = liParentElement.cloneNode() as HTMLElement;
        const liElements: HTMLElement[] = [liElement];
        Array.from(range.cloneContents().children).forEach((item, index) => {
            if (item.nodeType !== 3 && liElement && item.textContent.trim() !== "" &&
                liElement.getAttribute("data-node-id") === item.getAttribute("data-node-id")) {
                if (index !== 0) {
                    liElements.push(liElement);
                }
                liElement = liElement.nextElementSibling as HTMLElement;
            }
        });
        let isMatch = false;
        let afterHTML = "";
        liParentElement.querySelectorAll("li").forEach((item) => {
            if (isMatch) {
                afterHTML += item.outerHTML;
                if (!item.nextElementSibling && !item.previousElementSibling) {
                    item.parentElement.remove();
                } else {
                    item.remove();
                }
            }
            if (item.isSameNode(liElements[liElements.length - 1])) {
                isMatch = true;
            }
        });

        liElements.reverse().forEach((item) => {
            liParentLiElement.insertAdjacentElement("afterend", item);
        });

        if (afterHTML) {
            liParentAfterElement.innerHTML = afterHTML;
            liElements[0].insertAdjacentElement("beforeend", liParentAfterElement);
        }

        if (vditor.currentMode === "wysiwyg") {
            topListElement.outerHTML = vditor.lute.SpinVditorDOM(topListElement.outerHTML);
        } else {
            topListElement.outerHTML = vditor.lute.SpinVditorIRDOM(topListElement.outerHTML);
        }

        setRangeByWbr(vditor[vditor.currentMode].element, range);
        const tempTopListElement = getTopList(range.startContainer);
        if (tempTopListElement) {
            tempTopListElement.querySelectorAll(`.vditor-${vditor.currentMode}__preview[data-render='2']`)
                .forEach((item: HTMLElement) => {
                    processCodeRender(item, vditor);
                    if (vditor.currentMode === "wysiwyg") {
                        item.previousElementSibling.setAttribute("style", "display:none");
                    }
                });
        }
        execAfterRender(vditor);
        highlightToolbar(vditor);
    } else {
        vditor[vditor.currentMode].element.focus();
    }
};

export const setTableAlign = (tableElement: HTMLTableElement, type: string) => {
    const cell = getSelection().getRangeAt(0).startContainer.parentElement;

    const columnCnt = tableElement.rows[0].cells.length;
    const rowCnt = tableElement.rows.length;
    let currentColumn = 0;

    for (let i = 0; i < rowCnt; i++) {
        for (let j = 0; j < columnCnt; j++) {
            if (tableElement.rows[i].cells[j].isSameNode(cell)) {
                currentColumn = j;
                break;
            }
        }
    }
    for (let k = 0; k < rowCnt; k++) {
        tableElement.rows[k].cells[currentColumn].setAttribute("align", type);
    }
};

export const isHrMD = (text: string) => {
    // - _ *
    const marker = text.trimRight().split("\n").pop();
    if (marker === "") {
        return false;
    }
    if (marker.replace(/ |-/g, "") === ""
        || marker.replace(/ |_/g, "") === ""
        || marker.replace(/ |\*/g, "") === "") {
        if (marker.replace(/ /g, "").length > 2) {
            if (marker.indexOf("-") > -1 && marker.trimLeft().indexOf(" ") === -1
                && text.trimRight().split("\n").length > 1) {
                // 满足 heading
                return false;
            }
            if (marker.indexOf("    ") === 0 || marker.indexOf("\t") === 0) {
                // 代码块
                return false;
            }
            return true;
        }
        return false;
    }
    return false;
};

export const isHeadingMD = (text: string) => {
    // - =
    const textArray = text.trimRight().split("\n");
    text = textArray.pop();

    if (text.indexOf("    ") === 0 || text.indexOf("\t") === 0) {
        return false;
    }

    text = text.trimLeft();
    if (text === "" || textArray.length === 0) {
        return false;
    }
    if (text.replace(/-/g, "") === ""
        || text.replace(/=/g, "") === "") {
        return true;
    }
    return false;
};

export const execAfterRender = (vditor: IVditor, options = {
    enableAddUndoStack: true,
    enableHint: false,
    enableInput: true,
}) => {
    if (vditor.currentMode === "wysiwyg") {
        afterRenderEvent(vditor, options);
    } else if (vditor.currentMode === "ir") {
        processAfterRender(vditor, options);
    } else if (vditor.currentMode === "sv") {
        processSVAfterRender(vditor, options);
    }
};

export const fixList = (range: Range, vditor: IVditor, pElement: HTMLElement | false, event: KeyboardEvent) => {
    const startContainer = range.startContainer;
    const liElement = hasClosestByMatchTag(startContainer, "LI");
    if (liElement) {
        if (!isCtrl(event) && !event.altKey && event.key === "Enter" &&
            // fix li 中有多个 P 时，在第一个 P 中换行会在下方生成新的 li
            (!event.shiftKey && pElement && liElement.contains(pElement) && pElement.nextElementSibling)) {
            if (liElement && !liElement.textContent.endsWith("\n")) {
                // li 结尾需 \n
                liElement.insertAdjacentText("beforeend", "\n");
            }
            range.insertNode(document.createTextNode("\n\n"));
            range.collapse(false);
            execAfterRender(vditor);
            event.preventDefault();
            return true;
        }

        if (!isCtrl(event) && !event.shiftKey && !event.altKey && event.key === "Backspace" &&
            !liElement.previousElementSibling && range.toString() === "" &&
            getSelectPosition(liElement, vditor[vditor.currentMode].element, range).start === 0) {
            // 光标位于点和第一个字符中间时，无法删除 li 元素
            if (liElement.nextElementSibling) {
                liElement.parentElement.insertAdjacentHTML("beforebegin",
                    `<p data-block="0"><wbr>${liElement.innerHTML}</p>`);
                liElement.remove();
            } else {
                liElement.parentElement.outerHTML = `<p data-block="0"><wbr>${liElement.innerHTML}</p>`;
            }
            setRangeByWbr(vditor[vditor.currentMode].element, range);
            execAfterRender(vditor);
            event.preventDefault();
            return true;
        }

        // 空列表删除后与上一级段落对齐
        if (!isCtrl(event) && !event.shiftKey && !event.altKey && event.key === "Backspace" &&
            liElement.textContent.trim().replace(Constants.ZWSP, "") === "" &&
            range.toString() === "" && liElement.previousElementSibling?.tagName === "LI") {
            liElement.previousElementSibling.insertAdjacentText("beforeend", "\n\n");
            range.selectNodeContents(liElement.previousElementSibling);
            range.collapse(false);
            liElement.remove();
            setRangeByWbr(vditor[vditor.currentMode].element, range);
            execAfterRender(vditor);
            event.preventDefault();
            return true;
        }

        if (!isCtrl(event) && !event.altKey && event.key === "Tab") {
            // 光标位于第一/零字符时，tab 用于列表的缩进
            let isFirst = false;
            if (range.startOffset === 0
                && ((startContainer.nodeType === 3 && !startContainer.previousSibling)
                    || (startContainer.nodeType !== 3 && startContainer.nodeName === "LI"))) {
                // 有序/无序列表
                isFirst = true;
            } else if (liElement.classList.contains("vditor-task") && range.startOffset === 1
                && startContainer.previousSibling.nodeType !== 3
                && (startContainer.previousSibling as HTMLElement).tagName === "INPUT") {
                // 任务列表
                isFirst = true;
            }

            if (isFirst || range.toString() !== "") {
                if (event.shiftKey) {
                    listOutdent(vditor, liElement, range, liElement.parentElement);
                } else {
                    listIndent(vditor, liElement, range);
                }
                event.preventDefault();
                return true;
            }
        }
    }
    return false;
};

// tab 处理: block code render, table, 列表第一个字符中的 tab 处理单独写在上面
export const fixTab = (vditor: IVditor, range: Range, event: KeyboardEvent) => {
    if (vditor.options.tab && event.key === "Tab") {
        if (event.shiftKey) {
            // TODO shift+tab
        } else {
            if (range.toString() === "") {
                range.insertNode(document.createTextNode(vditor.options.tab));
                range.collapse(false);
            } else {
                range.extractContents();
                range.insertNode(document.createTextNode(vditor.options.tab));
                range.collapse(false);
            }
        }
        setSelectionFocus(range);
        execAfterRender(vditor);
        event.preventDefault();
        return true;
    }
};

export const fixMarkdown = (event: KeyboardEvent, vditor: IVditor, pElement: HTMLElement | false, range: Range) => {
    if (!pElement) {
        return;
    }
    if (!isCtrl(event) && !event.altKey && event.key === "Enter") {
        const pText = String.raw`${pElement.textContent}`.replace(/\\\|/g, "").trim();
        const pTextList = pText.split("|");
        if (pText.startsWith("|") && pText.endsWith("|") && pTextList.length > 3) {
            // table 自动完成
            let tableHeaderMD = pTextList.map(() => "---").join("|");
            tableHeaderMD =
                pElement.textContent + "\n" + tableHeaderMD.substring(3, tableHeaderMD.length - 3) + "\n|<wbr>";
            pElement.outerHTML = vditor.lute.SpinVditorDOM(tableHeaderMD);
            setRangeByWbr(vditor[vditor.currentMode].element, range);
            execAfterRender(vditor);
            scrollCenter(vditor);
            event.preventDefault();
            return true;
        }

        // hr 渲染
        if (isHrMD(pElement.innerHTML) && pElement.previousElementSibling) {
            // 软换行后 hr 前有内容
            let pInnerHTML = "";
            const innerHTMLList = pElement.innerHTML.trimRight().split("\n");
            if (innerHTMLList.length > 1) {
                innerHTMLList.pop();
                pInnerHTML = `<p data-block="0">${innerHTMLList.join("\n")}</p>`;
            }

            pElement.insertAdjacentHTML("afterend",
                `${pInnerHTML}<hr data-block="0"><p data-block="0"><wbr>\n</p>`);
            pElement.remove();
            setRangeByWbr(vditor[vditor.currentMode].element, range);
            execAfterRender(vditor);
            scrollCenter(vditor);
            event.preventDefault();
            return true;
        }

        if (isHeadingMD(pElement.innerHTML)) {
            // heading 渲染
            if (vditor.currentMode === "wysiwyg") {
                pElement.outerHTML = vditor.lute.SpinVditorDOM(pElement.innerHTML + '<p data-block="0"><wbr>\n</p>');
            } else {
                pElement.outerHTML = vditor.lute.SpinVditorIRDOM(pElement.innerHTML + '<p data-block="0"><wbr>\n</p>');
            }
            setRangeByWbr(vditor[vditor.currentMode].element, range);
            execAfterRender(vditor);
            scrollCenter(vditor);
            event.preventDefault();
            return true;
        }
    }

    // 软换行会被切割 https://github.com/Vanessa219/vditor/issues/220
    if (range.collapsed && pElement.previousElementSibling && event.key === "Backspace" &&
        !isCtrl(event) && !event.altKey && !event.shiftKey &&
        pElement.textContent.trimRight().split("\n").length > 1 &&
        getSelectPosition(pElement, vditor[vditor.currentMode].element, range).start === 0) {
        const lastElement = getLastNode(pElement.previousElementSibling) as HTMLElement;
        if (!lastElement.textContent.endsWith("\n")) {
            lastElement.textContent = lastElement.textContent + "\n";
        }
        lastElement.parentElement.insertAdjacentHTML("beforeend", `<wbr>${pElement.innerHTML}`);
        pElement.remove();
        setRangeByWbr(vditor[vditor.currentMode].element, range);
        return false;
    }
    return false;
};

export const insertRow = (vditor: IVditor, range: Range, cellElement: HTMLElement) => {
    let rowHTML = "";
    for (let m = 0; m < cellElement.parentElement.childElementCount; m++) {
        rowHTML += `<td align="${cellElement.parentElement.children[m].getAttribute("align")}"> </td>`;
    }
    if (cellElement.tagName === "TH") {
        cellElement.parentElement.parentElement.insertAdjacentHTML("afterend",
            `<tbody><tr>${rowHTML}</tr></tbody>`);
    } else {
        cellElement.parentElement.insertAdjacentHTML("afterend", `<tr>${rowHTML}</tr>`);
    }
    execAfterRender(vditor);
};

export const insertRowAbove = (vditor: IVditor, range: Range, cellElement: HTMLElement) => {
    let rowHTML = "";
    for (let m = 0; m < cellElement.parentElement.childElementCount; m++) {
        if (cellElement.tagName === "TH") {
            rowHTML += `<th align="${cellElement.parentElement.children[m].getAttribute("align")}"> </th>`;
        } else {
            rowHTML += `<td align="${cellElement.parentElement.children[m].getAttribute("align")}"> </td>`;
        }
    }
    if (cellElement.tagName === "TH") {
        cellElement.parentElement.parentElement.insertAdjacentHTML("beforebegin", `<thead><tr>${rowHTML}</tr></thead>`);

        range.insertNode(document.createElement("wbr"));
        const theadHTML = cellElement.parentElement.innerHTML.replace(/<th>/g, "<td>").replace(/<\/th>/g, "</td>");
        cellElement.parentElement.parentElement.nextElementSibling.insertAdjacentHTML("afterbegin", theadHTML);

        cellElement.parentElement.parentElement.remove();
        setRangeByWbr(vditor.ir.element, range);
    } else {
        cellElement.parentElement.insertAdjacentHTML("beforebegin", `<tr>${rowHTML}</tr>`);
    }
    execAfterRender(vditor);
};

export const insertColumn =
    (vditor: IVditor, tableElement: HTMLTableElement, cellElement: HTMLElement, type: InsertPosition = "afterend") => {
        let index = 0;
        let previousElement = cellElement.previousElementSibling;
        while (previousElement) {
            index++;
            previousElement = previousElement.previousElementSibling;
        }
        for (let i = 0; i < tableElement.rows.length; i++) {
            if (i === 0) {
                tableElement.rows[i].cells[index].insertAdjacentHTML(type, "<th> </th>");
            } else {
                tableElement.rows[i].cells[index].insertAdjacentHTML(type, "<td> </td>");
            }
        }
        execAfterRender(vditor);
    };
export const deleteRow = (vditor: IVditor, range: Range, cellElement: HTMLElement) => {
    if (cellElement.tagName === "TD") {
        const tbodyElement = cellElement.parentElement.parentElement;
        if (cellElement.parentElement.previousElementSibling) {
            range.selectNodeContents(cellElement.parentElement.previousElementSibling.lastElementChild);
        } else {
            range.selectNodeContents(tbodyElement.previousElementSibling.lastElementChild.lastElementChild);
        }

        if (tbodyElement.childElementCount === 1) {
            tbodyElement.remove();
        } else {
            cellElement.parentElement.remove();
        }

        range.collapse(false);
        setSelectionFocus(range);
        execAfterRender(vditor);
    }
};

export const deleteColumn =
    (vditor: IVditor, range: Range, tableElement: HTMLTableElement, cellElement: HTMLElement) => {
        let index = 0;
        let previousElement = cellElement.previousElementSibling;
        while (previousElement) {
            index++;
            previousElement = previousElement.previousElementSibling;
        }
        if (cellElement.previousElementSibling || cellElement.nextElementSibling) {
            range.selectNodeContents(cellElement.previousElementSibling || cellElement.nextElementSibling);
            range.collapse(true);
        }
        for (let i = 0; i < tableElement.rows.length; i++) {
            const cells = tableElement.rows[i].cells;
            if (cells.length === 1) {
                tableElement.remove();
                highlightToolbar(vditor);
                break;
            }
            cells[index].remove();
        }
        setSelectionFocus(range);
        execAfterRender(vditor);
    };

export const fixTable = (vditor: IVditor, event: KeyboardEvent, range: Range) => {
    const startContainer = range.startContainer;
    const cellElement = hasClosestByMatchTag(startContainer, "TD") ||
        hasClosestByMatchTag(startContainer, "TH");
    if (cellElement) {
        // 换行或软换行：在 cell 中添加 br
        if (!isCtrl(event) && !event.altKey && event.key === "Enter") {
            if (!cellElement.lastElementChild ||
                (cellElement.lastElementChild && (!cellElement.lastElementChild.isSameNode(cellElement.lastChild) ||
                    cellElement.lastElementChild.tagName !== "BR"))) {
                cellElement.insertAdjacentHTML("beforeend", "<br>");
            }
            const brElement = document.createElement("br");
            range.insertNode(brElement);
            range.setStartAfter(brElement);
            execAfterRender(vditor);
            scrollCenter(vditor);
            event.preventDefault();
            return true;
        }

        // tab：光标移向下一个 cell
        if (event.key === "Tab") {
            if (event.shiftKey) {
                // shift + tab 光标移动到前一个 cell
                goPreviousCell(cellElement, range);
                event.preventDefault();
                return true;
            }

            let nextElement = cellElement.nextElementSibling;
            if (!nextElement) {
                if (cellElement.parentElement.nextElementSibling) {
                    nextElement = cellElement.parentElement.nextElementSibling.firstElementChild;
                } else if (cellElement.parentElement.parentElement.tagName === "THEAD" &&
                    cellElement.parentElement.parentElement.nextElementSibling) {
                    nextElement =
                        cellElement.parentElement.parentElement.nextElementSibling.firstElementChild.firstElementChild;
                } else {
                    nextElement = null;
                }
            }
            if (nextElement) {
                range.selectNodeContents(nextElement);
                setSelectionFocus(range);
            }
            event.preventDefault();
            return true;
        }

        const tableElement = cellElement.parentElement.parentElement.parentElement as HTMLTableElement;
        if (event.key === "ArrowUp") {
            event.preventDefault();
            if (cellElement.tagName === "TH") {
                if (tableElement.previousElementSibling) {
                    range.selectNodeContents(tableElement.previousElementSibling);
                    range.collapse(false);
                    setSelectionFocus(range);
                } else {
                    insertEmptyBlock(vditor, "beforebegin");
                }
                return true;
            }

            let m = 0;
            const trElement = cellElement.parentElement as HTMLTableRowElement;
            for (; m < trElement.cells.length; m++) {
                if (trElement.cells[m].isSameNode(cellElement)) {
                    break;
                }
            }

            let previousElement = trElement.previousElementSibling as HTMLTableRowElement;
            if (!previousElement) {
                previousElement = trElement.parentElement.previousElementSibling.firstChild as HTMLTableRowElement;
            }
            range.selectNodeContents(previousElement.cells[m]);
            range.collapse(false);
            setSelectionFocus(range);
            return true;
        }

        if (event.key === "ArrowDown") {
            event.preventDefault();
            const trElement = cellElement.parentElement as HTMLTableRowElement;
            if (!trElement.nextElementSibling && cellElement.tagName === "TD") {
                if (tableElement.nextElementSibling) {
                    range.selectNodeContents(tableElement.nextElementSibling);
                    range.collapse(true);
                    setSelectionFocus(range);
                } else {
                    insertEmptyBlock(vditor, "afterend");
                }
                return true;
            }

            let m = 0;
            for (; m < trElement.cells.length; m++) {
                if (trElement.cells[m].isSameNode(cellElement)) {
                    break;
                }
            }

            let nextElement = trElement.nextElementSibling as HTMLTableRowElement;
            if (!nextElement) {
                nextElement = trElement.parentElement.nextElementSibling.firstChild as HTMLTableRowElement;
            }
            range.selectNodeContents(nextElement.cells[m]);
            range.collapse(true);
            setSelectionFocus(range);
            return true;
        }

        // focus row input, only wysiwyg
        if (vditor.currentMode === "wysiwyg" &&
            !isCtrl(event) && event.key === "Enter" && !event.shiftKey && event.altKey) {
            const inputElement = (vditor.wysiwyg.popover.querySelector(".vditor-input") as HTMLInputElement);
            inputElement.focus();
            inputElement.select();
            event.preventDefault();
            return true;
        }

        // Backspace：光标移动到前一个 cell
        if (!isCtrl(event) && !event.shiftKey && !event.altKey && event.key === "Backspace"
            && range.startOffset === 0 && range.toString() === "") {
            const previousCellElement = goPreviousCell(cellElement, range, false);
            if (!previousCellElement && tableElement) {
                if (tableElement.textContent.trim() === "") {
                    tableElement.outerHTML = `<p data-block="0"><wbr>\n</p>`;
                    setRangeByWbr(vditor[vditor.currentMode].element, range);
                } else {
                    range.setStartBefore(tableElement);
                    range.collapse(true);
                }
                execAfterRender(vditor);
            }
            event.preventDefault();
            return true;
        }
        // 上方新添加一行
        if (matchHotKey("⇧⌘F", event)) {
            insertRowAbove(vditor, range, cellElement);
            event.preventDefault();
            return true;
        }

        // 下方新添加一行 https://github.com/Vanessa219/vditor/issues/46
        if (matchHotKey("⌘=", event)) {
            insertRow(vditor, range, cellElement);
            event.preventDefault();
            return true;
        }

        // 左方新添加一列
        if (matchHotKey("⇧⌘G", event)) {
            insertColumn(vditor, tableElement, cellElement, "beforebegin");
            event.preventDefault();
            return true;
        }

        // 后方新添加一列
        if (matchHotKey("⇧⌘=", event)) {
            insertColumn(vditor, tableElement, cellElement);
            event.preventDefault();
            return true;
        }

        // 删除当前行
        if (matchHotKey("⌘-", event)) {
            deleteRow(vditor, range, cellElement);
            event.preventDefault();
            return true;
        }

        // 删除当前列
        if (matchHotKey("⇧⌘-", event)) {
            deleteColumn(vditor, range, tableElement, cellElement);
            event.preventDefault();
            return true;
        }

        // 剧左
        if (matchHotKey("⇧⌘L", event)) {
            if (vditor.currentMode === "ir") {
                setTableAlign(tableElement, "left");
                execAfterRender(vditor);
                event.preventDefault();
                return true;
            } else {
                const itemElement: HTMLElement = vditor.wysiwyg.popover.querySelector('[data-type="left"]');
                if (itemElement) {
                    itemElement.click();
                    event.preventDefault();
                    return true;
                }
            }
        }

        // 剧中
        if (matchHotKey("⇧⌘C", event)) {
            if (vditor.currentMode === "ir") {
                setTableAlign(tableElement, "center");
                execAfterRender(vditor);
                event.preventDefault();
                return true;
            } else {
                const itemElement: HTMLElement = vditor.wysiwyg.popover.querySelector('[data-type="center"]');
                if (itemElement) {
                    itemElement.click();
                    event.preventDefault();
                    return true;
                }
            }
        }
        // 剧右
        if (matchHotKey("⇧⌘R", event)) {
            if (vditor.currentMode === "ir") {
                setTableAlign(tableElement, "right");
                execAfterRender(vditor);
                event.preventDefault();
                return true;
            } else {
                const itemElement: HTMLElement = vditor.wysiwyg.popover.querySelector('[data-type="right"]');
                if (itemElement) {
                    itemElement.click();
                    event.preventDefault();
                    return true;
                }
            }
        }
    }
    return false;
};

export const fixCodeBlock = (vditor: IVditor, event: KeyboardEvent, codeRenderElement: HTMLElement, range: Range) => {
    // 行级代码块中 command + a，近对当前代码块进行全选
    if (codeRenderElement.tagName === "PRE" && matchHotKey("⌘A", event)) {
        range.selectNodeContents(codeRenderElement.firstElementChild);
        event.preventDefault();
        return true;
    }

    // tab
    // TODO shift + tab, shift and 选中文字
    if (vditor.options.tab && event.key === "Tab" && !event.shiftKey && range.toString() === "") {
        range.insertNode(document.createTextNode(vditor.options.tab));
        range.collapse(false);
        execAfterRender(vditor);
        event.preventDefault();
        return true;
    }

    // Backspace: 光标位于第零个字符，仅删除代码块标签
    if (event.key === "Backspace" && !isCtrl(event) && !event.shiftKey && !event.altKey) {
        const codePosition = getSelectPosition(codeRenderElement, vditor[vditor.currentMode].element, range);
        if ((codePosition.start === 0 ||
                (codePosition.start === 1 && codeRenderElement.innerText === "\n")) // 空代码块，光标在 \n 后
            && range.toString() === "") {
            codeRenderElement.parentElement.outerHTML =
                `<p data-block="0"><wbr>${codeRenderElement.firstElementChild.innerHTML}</p>`;
            setRangeByWbr(vditor[vditor.currentMode].element, range);
            execAfterRender(vditor);
            event.preventDefault();
            return true;
        }
    }

    // 换行
    if (!isCtrl(event) && !event.altKey && event.key === "Enter") {
        if (!codeRenderElement.firstElementChild.textContent.endsWith("\n")) {
            codeRenderElement.firstElementChild.insertAdjacentText("beforeend", "\n");
        }
        range.extractContents();
        range.insertNode(document.createTextNode("\n"));
        range.collapse(false);
        setSelectionFocus(range);
        if (!isFirefox()) {
            if (vditor.currentMode === "wysiwyg") {
                input(vditor, range);
            } else {
                IRInput(vditor, range);
            }
        }
        scrollCenter(vditor);
        event.preventDefault();
        return true;
    }
    return false;
};

export const fixBlockquote = (vditor: IVditor, range: Range, event: KeyboardEvent, pElement: HTMLElement | false) => {
    const startContainer = range.startContainer;
    const blockquoteElement = hasClosestByMatchTag(startContainer, "BLOCKQUOTE");
    if (blockquoteElement && range.toString() === "") {
        if (event.key === "Backspace" && !isCtrl(event) && !event.shiftKey && !event.altKey &&
            getSelectPosition(blockquoteElement, vditor[vditor.currentMode].element, range).start === 0) {
            // Backspace: 光标位于引用中的第零个字符，仅删除引用标签
            range.insertNode(document.createElement("wbr"));
            blockquoteElement.outerHTML = blockquoteElement.innerHTML;
            setRangeByWbr(vditor[vditor.currentMode].element, range);
            execAfterRender(vditor);
            event.preventDefault();
            return true;
        }

        if (pElement && event.key === "Enter" && !isCtrl(event) && !event.shiftKey && !event.altKey
            && pElement.parentElement.tagName === "BLOCKQUOTE") {
            // Enter: 空行回车应逐层跳出
            let isEmpty = false;
            if (pElement.innerHTML.replace(Constants.ZWSP, "") === "\n" ||
                pElement.innerHTML.replace(Constants.ZWSP, "") === "") {
                // 空 P
                isEmpty = true;
                pElement.remove();
            } else if (pElement.innerHTML.endsWith("\n\n") &&
                getSelectPosition(pElement, vditor[vditor.currentMode].element, range).start ===
                pElement.textContent.length - 1) {
                // 软换行
                pElement.innerHTML = pElement.innerHTML.substr(0, pElement.innerHTML.length - 2);
                isEmpty = true;
            }
            if (isEmpty) {
                // 需添加零宽字符，否则的话无法记录 undo
                blockquoteElement.insertAdjacentHTML("afterend", `<p data-block="0">${Constants.ZWSP}<wbr>\n</p>`);
                setRangeByWbr(vditor[vditor.currentMode].element, range);
                execAfterRender(vditor);
                event.preventDefault();
                return true;
            }
        }
        const blockElement = hasClosestBlock(startContainer);
        if (vditor.currentMode === "wysiwyg" && blockElement && matchHotKey("⇧⌘;", event)) {
            // 插入 blockquote
            range.insertNode(document.createElement("wbr"));
            blockElement.outerHTML = `<blockquote data-block="0">${blockElement.outerHTML}</blockquote>`;
            setRangeByWbr(vditor.wysiwyg.element, range);
            afterRenderEvent(vditor);
            event.preventDefault();
            return true;
        }

        if (insertAfterBlock(vditor, event, range, blockquoteElement, blockquoteElement)) {
            return true;
        }
        if (insertBeforeBlock(vditor, event, range, blockquoteElement, blockquoteElement)) {
            return true;
        }
    }
    return false;
};

export const fixTask = (vditor: IVditor, range: Range, event: KeyboardEvent) => {
    const startContainer = range.startContainer;
    const taskItemElement = hasClosestByClassName(startContainer, "vditor-task");
    if (taskItemElement) {
        if (matchHotKey("⇧⌘J", event)) {
            // ctrl + shift: toggle checked
            const inputElement = taskItemElement.firstElementChild as HTMLInputElement;
            if (inputElement.checked) {
                inputElement.removeAttribute("checked");
            } else {
                inputElement.setAttribute("checked", "checked");
            }
            execAfterRender(vditor);
            event.preventDefault();
            return true;
        }

        // Backspace: 在选择框前进行删除
        if (event.key === "Backspace" && !isCtrl(event) && !event.shiftKey && !event.altKey && range.toString() === ""
            && range.startOffset === 1
            && ((startContainer.nodeType === 3 && startContainer.previousSibling &&
                    (startContainer.previousSibling as HTMLElement).tagName === "INPUT")
                || startContainer.nodeType !== 3)) {
            const previousElement = taskItemElement.previousElementSibling;
            taskItemElement.querySelector("input").remove();
            if (previousElement) {
                const lastNode = getLastNode(previousElement);
                lastNode.parentElement.insertAdjacentHTML("beforeend", "<wbr>" + taskItemElement.innerHTML.trim());
                taskItemElement.remove();
            } else {
                taskItemElement.parentElement.insertAdjacentHTML("beforebegin",
                    `<p data-block="0"><wbr>${taskItemElement.innerHTML.trim() || "\n"}</p>`);
                if (taskItemElement.nextElementSibling) {
                    taskItemElement.remove();
                } else {
                    taskItemElement.parentElement.remove();
                }
            }
            setRangeByWbr(vditor[vditor.currentMode].element, range);
            execAfterRender(vditor);
            event.preventDefault();
            return true;
        }

        if (event.key === "Enter" && !isCtrl(event) && !event.shiftKey && !event.altKey) {
            if (taskItemElement.textContent.trim() === "") {
                // 当前任务列表无文字
                if (hasClosestByClassName(taskItemElement.parentElement, "vditor-task")) {
                    // 为子元素时，需进行反向缩进
                    const topListElement = getTopList(startContainer);
                    if (topListElement) {
                        listOutdent(vditor, taskItemElement, range, topListElement);
                    }
                } else {
                    // 仅有一级任务列表
                    if (taskItemElement.nextElementSibling) {
                        // 任务列表下方还有元素，需要使用用段落隔断
                        let afterHTML = "";
                        let beforeHTML = "";
                        let isAfter = false;
                        Array.from(taskItemElement.parentElement.children).forEach((taskItem) => {
                            if (taskItemElement.isSameNode(taskItem)) {
                                isAfter = true;
                            } else {
                                if (isAfter) {
                                    afterHTML += taskItem.outerHTML;
                                } else {
                                    beforeHTML += taskItem.outerHTML;
                                }
                            }
                        });
                        const parentTagName = taskItemElement.parentElement.tagName;
                        const dataMarker = taskItemElement.parentElement.tagName === "OL" ? "" : ` data-marker="${taskItemElement.parentElement.getAttribute("data-marker")}"`;
                        let startAttribute = "";
                        if (beforeHTML) {
                            startAttribute = taskItemElement.parentElement.tagName === "UL" ? "" : ` start="1"`;
                            beforeHTML = `<${parentTagName} data-tight="true"${dataMarker} data-block="0">${beforeHTML}</${parentTagName}>`;
                        }
                        // <p data-block="0">\n<wbr></p> => <p data-block="0"><wbr>\n</p>
                        // https://github.com/Vanessa219/vditor/issues/430
                        taskItemElement.parentElement.outerHTML = `${beforeHTML}<p data-block="0"><wbr>\n</p><${parentTagName}
 data-tight="true"${dataMarker} data-block="0"${startAttribute}>${afterHTML}</${parentTagName}>`;
                    } else {
                        // 任务列表下方无任务列表元素
                        taskItemElement.parentElement.insertAdjacentHTML("afterend", `<p data-block="0"><wbr>\n</p>`);
                        if (taskItemElement.parentElement.querySelectorAll("li").length === 1) {
                            // 任务列表仅有一项时，使用 p 元素替换
                            taskItemElement.parentElement.remove();
                        } else {
                            // 任务列表有多项时，当前任务列表位于最后一项，移除该任务列表
                            taskItemElement.remove();
                        }
                    }
                }
            } else if (startContainer.nodeType !== 3 && range.startOffset === 0 &&
                (startContainer.firstChild as HTMLElement).tagName === "INPUT") {
                // 光标位于 input 之前
                range.setStart(startContainer.childNodes[1], 1);
            } else {
                // 当前任务列表有文字，光标后的文字需添加到新任务列表中
                range.setEndAfter(taskItemElement.lastChild);
                taskItemElement.insertAdjacentHTML("afterend", `<li class="vditor-task" data-marker="${taskItemElement.getAttribute("data-marker")}"><input type="checkbox"> <wbr></li>`);
                document.querySelector("wbr").after(range.extractContents());
            }
            setRangeByWbr(vditor[vditor.currentMode].element, range);
            execAfterRender(vditor);
            scrollCenter(vditor);
            event.preventDefault();
            return true;
        }
    }
    return false;
};

export const fixDelete = (vditor: IVditor, range: Range, event: KeyboardEvent, pElement: HTMLElement | false) => {
    if (range.startContainer.nodeType !== 3) {
        // 光标位于 hr 前，hr 前有内容
        const rangeElement = (range.startContainer as HTMLElement).children[range.startOffset];
        if (rangeElement && rangeElement.tagName === "HR") {
            range.selectNodeContents(rangeElement.previousElementSibling);
            range.collapse(false);
            event.preventDefault();
            return true;
        }
    }

    if (pElement) {
        const previousElement = pElement.previousElementSibling;
        if (previousElement && getSelectPosition(pElement, vditor[vditor.currentMode].element, range).start === 0 &&
            ((isFirefox() && previousElement.tagName === "HR") || previousElement.tagName === "TABLE")) {
            if (previousElement.tagName === "TABLE") {
                // table 后删除 https://github.com/Vanessa219/vditor/issues/243
                const lastCellElement = previousElement.lastElementChild.lastElementChild.lastElementChild;
                lastCellElement.innerHTML =
                    lastCellElement.innerHTML.trimLeft() + "<wbr>" + pElement.textContent.trim();
                pElement.remove();
            } else {
                // 光标位于 hr 后进行删除
                previousElement.remove();
            }
            setRangeByWbr(vditor[vditor.currentMode].element, range);
            execAfterRender(vditor);
            event.preventDefault();
            return true;
        }
    }
    return false;
};

export const fixHR = (range: Range) => {
    if (isFirefox() && range.startContainer.nodeType !== 3 &&
        (range.startContainer as HTMLElement).tagName === "HR") {
        range.setStartBefore(range.startContainer);
    }
};

// firefox https://github.com/Vanessa219/vditor/issues/407
export const fixFirefoxArrowUpTable = (event: KeyboardEvent, blockElement: false | HTMLElement, range: Range) => {
    if (!isFirefox()) {
        return false;
    }
    if (event.key === "ArrowUp" && blockElement && blockElement.previousElementSibling?.tagName === "TABLE") {
        const tableElement = blockElement.previousElementSibling as HTMLTableElement;
        range.selectNodeContents(tableElement.rows[tableElement.rows.length - 1].lastElementChild);
        range.collapse(false);
        event.preventDefault();
        return true;
    }
    if (event.key === "ArrowDown" && blockElement && blockElement.nextElementSibling?.tagName === "TABLE") {
        range.selectNodeContents((blockElement.nextElementSibling as HTMLTableElement).rows[0].cells[0]);
        range.collapse(true);
        event.preventDefault();
        return true;
    }
    return false;
};

export const paste = async (vditor: IVditor, event: (ClipboardEvent | DragEvent) & { target: HTMLElement }, callback: {
    pasteCode(code: string): void,
}) => {
    if (vditor[vditor.currentMode].element.getAttribute("contenteditable") !== "true") {
        return;
    }
    event.stopPropagation();
    event.preventDefault();
    let textHTML;
    let textPlain;
    let files;

    if ("clipboardData" in event) {
        textHTML = event.clipboardData.getData("text/html");
        textPlain = event.clipboardData.getData("text/plain");
        files = event.clipboardData.files;
    } else {
        textHTML = event.dataTransfer.getData("text/html");
        textPlain = event.dataTransfer.getData("text/plain");
        if (event.dataTransfer.types.includes("Files")) {
            files = event.dataTransfer.items;
        }
    }
    const renderers: {
        HTML2VditorDOM?: ILuteRender,
        HTML2VditorIRDOM?: ILuteRender,
        Md2VditorDOM?: ILuteRender,
        Md2VditorIRDOM?: ILuteRender,
        Md2VditorSVDOM?: ILuteRender,
    } = {};
    const renderLinkDest: ILuteRenderCallback = (node, entering) => {
        if (!entering) {
            return ["", Lute.WalkContinue];
        }

        const src = node.TokensStr();
        if (node.__internal_object__.Parent.Type === 34 && src && src.indexOf("file://") === -1 &&
            vditor.options.upload.linkToImgUrl) {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", vditor.options.upload.linkToImgUrl);
            if (vditor.options.upload.token) {
                xhr.setRequestHeader("X-Upload-Token", vditor.options.upload.token);
            }
            if (vditor.options.upload.withCredentials) {
                xhr.withCredentials = true;
            }
            setHeaders(vditor, xhr);
            xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
            xhr.onreadystatechange = () => {
                if (xhr.readyState === XMLHttpRequest.DONE) {
                    if (xhr.status === 200) {
                        let responseText = xhr.responseText;
                        if (vditor.options.upload.linkToImgFormat) {
                            responseText = vditor.options.upload.linkToImgFormat(xhr.responseText);
                        }
                        const responseJSON = JSON.parse(responseText);
                        if (responseJSON.code !== 0) {
                            vditor.tip.show(responseJSON.msg);
                            return;
                        }
                        const original = responseJSON.data.originalURL;
                        if (vditor.currentMode === "sv") {
                            vditor.sv.element.querySelectorAll(".vditor-sv__marker--link")
                                .forEach((item: HTMLElement) => {
                                    if (item.textContent === original) {
                                        item.textContent = responseJSON.data.url;
                                    }
                                });
                        } else {
                            const imgElement: HTMLImageElement =
                                vditor[vditor.currentMode].element.querySelector(`img[src="${original}"]`);
                            imgElement.src = responseJSON.data.url;
                            if (vditor.currentMode === "ir") {
                                imgElement.previousElementSibling.previousElementSibling.innerHTML =
                                    responseJSON.data.url;
                            }
                        }
                        execAfterRender(vditor);
                    } else {
                        vditor.tip.show(xhr.responseText);
                    }
                    if (vditor.options.upload.linkToImgCallback) {
                        vditor.options.upload.linkToImgCallback(xhr.responseText);
                    }
                }
            };
            xhr.send(JSON.stringify({url: src}));
        }
        if (vditor.currentMode === "ir") {
            return [`<span class="vditor-ir__marker vditor-ir__marker--link">${Lute.EscapeHTMLStr(src)}</span>`, Lute.WalkContinue];
        } else if (vditor.currentMode === "wysiwyg") {
            return ["", Lute.WalkContinue];
        } else {
            return [`<span class="vditor-sv__marker--link">${Lute.EscapeHTMLStr(src)}</span>`, Lute.WalkContinue];
        }
    };

    // 浏览器地址栏拷贝处理
    if (textHTML.replace(/&amp;/g, "&").replace(/<(|\/)(html|body|meta)[^>]*?>/ig, "").trim() ===
        `<a href="${textPlain}">${textPlain}</a>` ||
        textHTML.replace(/&amp;/g, "&").replace(/<(|\/)(html|body|meta)[^>]*?>/ig, "").trim() ===
        `<!--StartFragment--><a href="${textPlain}">${textPlain}</a><!--EndFragment-->`) {
        textHTML = "";
    }

    // process word
    const doc = new DOMParser().parseFromString(textHTML, "text/html");
    if (doc.body) {
        textHTML = doc.body.innerHTML;
    }
    textHTML = Lute.Sanitize(textHTML);
    vditor.wysiwyg.getComments(vditor);

    // process code
    const height = vditor[vditor.currentMode].element.scrollHeight;
    const code = processPasteCode(textHTML, textPlain, vditor.currentMode);
    const codeElement = vditor.currentMode === "sv" ?
        hasClosestByAttribute(event.target, "data-type", "code-block") :
        hasClosestByMatchTag(event.target, "CODE");
    if (codeElement) {
        // 粘贴在代码位置
        if (vditor.currentMode === "sv") {
            document.execCommand("insertHTML", false, textPlain.replace(/&/g, "&amp;").replace(/</g, "&lt;"));
        } else {
            const position = getSelectPosition(event.target, vditor[vditor.currentMode].element);
            if (codeElement.parentElement.tagName !== "PRE") {
                // https://github.com/Vanessa219/vditor/issues/463
                textPlain += Constants.ZWSP;
            }
            codeElement.textContent = codeElement.textContent.substring(0, position.start)
                + textPlain + codeElement.textContent.substring(position.end);
            setSelectionByPosition(position.start + textPlain.length, position.start + textPlain.length,
                codeElement.parentElement);
            if (codeElement.parentElement?.nextElementSibling.classList
                .contains(`vditor-${vditor.currentMode}__preview`)) {
                codeElement.parentElement.nextElementSibling.innerHTML = codeElement.outerHTML;
                processCodeRender(codeElement.parentElement.nextElementSibling as HTMLElement, vditor);
            }
        }
    } else if (code) {
        callback.pasteCode(code);
    } else {
        if (textHTML.trim() !== "") {
            const tempElement = document.createElement("div");
            tempElement.innerHTML = textHTML;
            tempElement.querySelectorAll("[style]").forEach((e) => {
                e.removeAttribute("style");
            });
            tempElement.querySelectorAll(".vditor-copy").forEach((e) => {
                e.remove();
            });
            if (vditor.currentMode === "ir") {
                renderers.HTML2VditorIRDOM = {renderLinkDest};
                vditor.lute.SetJSRenderers({renderers});
                insertHTML(vditor.lute.HTML2VditorIRDOM(tempElement.innerHTML), vditor);
            } else if (vditor.currentMode === "wysiwyg") {
                renderers.HTML2VditorDOM = {renderLinkDest};
                vditor.lute.SetJSRenderers({renderers});
                insertHTML(vditor.lute.HTML2VditorDOM(tempElement.innerHTML), vditor);
            } else {
                renderers.Md2VditorSVDOM = {renderLinkDest};
                vditor.lute.SetJSRenderers({renderers});
                processPaste(vditor, vditor.lute.HTML2Md(tempElement.innerHTML).trimRight());
            }
            vditor.outline.render(vditor);
        } else if (files.length > 0) {
            if (vditor.options.upload.url || vditor.options.upload.handler) {
                await uploadFiles(vditor, files);
            } else {
                const fileReader = new FileReader();
                let file: File;
                if ("clipboardData" in event) {
                    files = event.clipboardData.files;
                    file = files[0];
                } else if (event.dataTransfer.types.includes("Files")) {
                    files = event.dataTransfer.items;
                    file = files[0].getAsFile();
                }
                if (file && file.type.startsWith("image")) {
                    fileReader.readAsDataURL(file);
                    fileReader.onload = () => {
                        let imgHTML = ''
                        if (vditor.currentMode === "wysiwyg") {
                            imgHTML += `<img alt="${file.name}" src="${fileReader.result.toString()}">\n`;
                        } else {
                            imgHTML += `![${file.name}](${fileReader.result.toString()})\n`;
                        }
                        document.execCommand("insertHTML", false, imgHTML);
                    }
                }
            }
        } else if (textPlain.trim() !== "" && files.length === 0) {
            if (vditor.currentMode === "ir") {
                renderers.Md2VditorIRDOM = {renderLinkDest};
                vditor.lute.SetJSRenderers({renderers});
                insertHTML(vditor.lute.Md2VditorIRDOM(textPlain), vditor);
            } else if (vditor.currentMode === "wysiwyg") {
                renderers.Md2VditorDOM = {renderLinkDest};
                vditor.lute.SetJSRenderers({renderers});
                insertHTML(vditor.lute.Md2VditorDOM(textPlain), vditor);
            } else {
                renderers.Md2VditorSVDOM = {renderLinkDest};
                vditor.lute.SetJSRenderers({renderers});
                processPaste(vditor, textPlain);
            }
            vditor.outline.render(vditor);
        }
    }
    if (vditor.currentMode !== "sv") {
        const blockElement = hasClosestBlock(getEditorRange(vditor).startContainer);
        if (blockElement) {
            // https://github.com/Vanessa219/vditor/issues/591
            const range = getEditorRange(vditor);
            vditor[vditor.currentMode].element.querySelectorAll("wbr").forEach((wbr) => {
                wbr.remove();
            });
            range.insertNode(document.createElement("wbr"));
            if (vditor.currentMode === "wysiwyg") {
                blockElement.outerHTML = vditor.lute.SpinVditorDOM(blockElement.outerHTML);
            } else {
                blockElement.outerHTML = vditor.lute.SpinVditorIRDOM(blockElement.outerHTML);
            }
            setRangeByWbr(vditor[vditor.currentMode].element, range);
        }
        vditor[vditor.currentMode].element.querySelectorAll(`.vditor-${vditor.currentMode}__preview[data-render='2']`)
            .forEach((item: HTMLElement) => {
                processCodeRender(item, vditor);
            });
    }
    vditor.wysiwyg.triggerRemoveComment(vditor);
    execAfterRender(vditor);
    if (vditor[vditor.currentMode].element.scrollHeight - height >
        Math.min(vditor[vditor.currentMode].element.clientHeight, window.innerHeight) / 2) {
        scrollCenter(vditor);
    }
};
