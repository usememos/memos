import {isCtrl} from "../util/compatibility";
import {fixTab} from "../util/fixBrowserBehavior";
import {hasClosestByAttribute} from "../util/hasClosest";
import {hasClosestByTag} from "../util/hasClosestByHeadings";
import {getEditorRange, getSelectPosition} from "../util/selection";
import {inputEvent} from "./inputEvent";
import {processAfterRender, processPreviousMarkers} from "./process";

export const processKeydown = (vditor: IVditor, event: KeyboardEvent) => {
    vditor.sv.composingLock = event.isComposing;
    if (event.isComposing) {
        return false;
    }

    if (event.key.indexOf("Arrow") === -1 && event.key !== "Meta" && event.key !== "Control" && event.key !== "Alt" &&
        event.key !== "Shift" && event.key !== "CapsLock" && event.key !== "Escape" && !/^F\d{1,2}$/.test(event.key)) {
        vditor.undo.recordFirstPosition(vditor, event);
    }
    // 仅处理以下快捷键操作
    if (event.key !== "Enter" && event.key !== "Tab" && event.key !== "Backspace" && event.key.indexOf("Arrow") === -1
        && !isCtrl(event) && event.key !== "Escape") {
        return false;
    }
    const range = getEditorRange(vditor);
    let startContainer = range.startContainer;
    if (range.startContainer.nodeType !== 3 && (range.startContainer as HTMLElement).tagName === "DIV") {
        startContainer = range.startContainer.childNodes[range.startOffset - 1];
    }
    const textElement = hasClosestByAttribute(startContainer, "data-type", "text");

    // blockquote
    let blockquoteMarkerElement = hasClosestByAttribute(startContainer, "data-type", "blockquote-marker");
    if (!blockquoteMarkerElement && range.startOffset === 0 && textElement && textElement.previousElementSibling &&
        textElement.previousElementSibling.getAttribute("data-type") === "blockquote-marker") {
        blockquoteMarkerElement = textElement.previousElementSibling as HTMLElement;
    }
    // 回车逐个删除 blockquote marker 标记
    if (blockquoteMarkerElement) {
        if (event.key === "Enter" && !isCtrl(event) && !event.altKey &&
            blockquoteMarkerElement.nextElementSibling.textContent.trim() === "" &&
            getSelectPosition(blockquoteMarkerElement, vditor.sv.element, range).start ===
            blockquoteMarkerElement.textContent.length) {
            if (blockquoteMarkerElement.previousElementSibling?.getAttribute("data-type") === "padding") {
                // 列表中存在多行 BQ 时，标记回车需跳出列表
                blockquoteMarkerElement.previousElementSibling.setAttribute("data-action", "enter-remove");
            }
            blockquoteMarkerElement.remove();
            processAfterRender(vditor);
            event.preventDefault();
            return true;
        }
    }

    // list item
    const listMarkerElement = hasClosestByAttribute(startContainer, "data-type", "li-marker") as HTMLElement;
    const taskMarkerElement = hasClosestByAttribute(startContainer, "data-type", "task-marker") as HTMLElement;
    let listLastMarkerElement = listMarkerElement;
    if (!listLastMarkerElement) {
        if (taskMarkerElement && taskMarkerElement.nextElementSibling.getAttribute("data-type") !== "task-marker") {
            listLastMarkerElement = taskMarkerElement;
        }
    }
    if (!listLastMarkerElement && range.startOffset === 0 && textElement && textElement.previousElementSibling &&
        (textElement.previousElementSibling.getAttribute("data-type") === "li-marker" ||
            textElement.previousElementSibling.getAttribute("data-type") === "task-marker")) {
        listLastMarkerElement = textElement.previousElementSibling as HTMLElement;
    }
    if (listLastMarkerElement) {
        const startIndex = getSelectPosition(listLastMarkerElement, vditor.sv.element, range).start;
        const isTask = listLastMarkerElement.getAttribute("data-type") === "task-marker";
        let listFirstMarkerElement = listLastMarkerElement;
        if (isTask) {
            listFirstMarkerElement = listLastMarkerElement.previousElementSibling.previousElementSibling
                .previousElementSibling as HTMLElement;
        }
        if (startIndex === listLastMarkerElement.textContent.length) {
            // 回车清空列表标记符
            if (event.key === "Enter" && !isCtrl(event) && !event.altKey && !event.shiftKey &&
                listLastMarkerElement.nextElementSibling.textContent.trim() === "") {
                if (listFirstMarkerElement.previousElementSibling?.getAttribute("data-type") === "padding") {
                    listFirstMarkerElement.previousElementSibling.remove();
                    inputEvent(vditor);
                } else {
                    if (isTask) {
                        listFirstMarkerElement.remove();
                        listLastMarkerElement.previousElementSibling.previousElementSibling.remove();
                        listLastMarkerElement.previousElementSibling.remove();
                    }
                    listLastMarkerElement.nextElementSibling.remove();
                    listLastMarkerElement.remove();
                    processAfterRender(vditor);
                }
                event.preventDefault();
                return true;
            }
            // 第一个 marker 后 tab 进行缩进
            if (event.key === "Tab") {
                listFirstMarkerElement.insertAdjacentHTML("beforebegin",
                    `<span data-type="padding">${listFirstMarkerElement.textContent.replace(/\S/g, " ")}</span>`);
                if (/^\d/.test(listFirstMarkerElement.textContent)) {
                    listFirstMarkerElement.textContent = listFirstMarkerElement.textContent.replace(/^\d{1,}/, "1");
                    range.selectNodeContents(listLastMarkerElement.firstChild);
                    range.collapse(false);
                }
                inputEvent(vditor);
                event.preventDefault();
                return true;
            }
        }
    }

    // tab
    if (fixTab(vditor, range, event)) {
        return true;
    }

    const blockElement = hasClosestByAttribute(startContainer, "data-block", "0");
    const spanElement = hasClosestByTag(startContainer, "SPAN");
    // 回车
    if (event.key === "Enter" && !isCtrl(event) && !event.altKey && !event.shiftKey && blockElement) {
        let isFirst = false;
        const newLineMatch = blockElement.textContent.match(/^\n+/);
        if (getSelectPosition(blockElement, vditor.sv.element).start <= (newLineMatch ? newLineMatch[0].length : 0)) {
            // 允许段落开始换行
            isFirst = true;
        }
        let newLineText = "\n";
        if (spanElement) {
            if (spanElement.previousElementSibling?.getAttribute("data-action") === "enter-remove") {
                // https://github.com/Vanessa219/vditor/issues/596
                spanElement.previousElementSibling.remove();
                processAfterRender(vditor);
                event.preventDefault();
                return true;
            } else {
                newLineText += processPreviousMarkers(spanElement);
            }
        }
        range.insertNode(document.createTextNode(newLineText));
        range.collapse(false);
        if (blockElement && blockElement.textContent.trim() !== "" && !isFirst) {
            inputEvent(vditor);
        } else {
            processAfterRender(vditor);
        }
        event.preventDefault();
        return true;
    }

    // 删除后光标前有 newline 的处理
    if (event.key === "Backspace" && !isCtrl(event) && !event.altKey && !event.shiftKey) {
        if (spanElement && spanElement.previousElementSibling?.getAttribute("data-type") === "newline" &&
            getSelectPosition(spanElement, vditor.sv.element, range).start === 1 &&
            // 飘号的处理需在 inputEvent 中，否则上下飘号对不齐
            spanElement.getAttribute("data-type").indexOf("code-block-") === -1) {
            // 光标在每一行的第一个字符后
            range.setStart(spanElement, 0);
            range.extractContents();
            if (spanElement.textContent.trim() !== "") {
                inputEvent(vditor);
            } else {
                processAfterRender(vditor);
            }
            event.preventDefault();
            return true;
        }
        // 每一段第一个字符前
        if (blockElement && getSelectPosition(blockElement, vditor.sv.element, range).start === 0 &&
            blockElement.previousElementSibling) {
            range.extractContents();
            let previousLastElement = blockElement.previousElementSibling.lastElementChild;
            if (previousLastElement.getAttribute("data-type") === "newline") {
                previousLastElement.remove();
                previousLastElement = blockElement.previousElementSibling.lastElementChild;
            }
            // 场景：末尾无法删除 [```\ntext\n```\n\n]
            if (previousLastElement.getAttribute("data-type") !== "newline") {
                previousLastElement.insertAdjacentHTML("afterend", blockElement.innerHTML);
                blockElement.remove();
            }
            if (blockElement.textContent.trim() !== "" && !blockElement.previousElementSibling?.querySelector('[data-type="code-block-open-marker"]')) {
                inputEvent(vditor);
            } else {
                if (previousLastElement.getAttribute("data-type") !== "newline") {
                    // https://github.com/Vanessa219/vditor/issues/597
                    range.selectNodeContents(previousLastElement.lastChild);
                    range.collapse(false);
                }
                processAfterRender(vditor);
            }
            event.preventDefault();
            return true;
        }
    }
    return false;
};
