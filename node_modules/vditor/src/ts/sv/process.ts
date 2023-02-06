import {getMarkdown} from "../markdown/getMarkdown";
import {accessLocalStorage} from "../util/compatibility";
import {scrollCenter} from "../util/editorCommonEvent";
import {hasClosestBlock, hasClosestByAttribute} from "../util/hasClosest";
import {hasClosestByTag} from "../util/hasClosestByHeadings";
import {log} from "../util/log";
import {getEditorRange, setRangeByWbr} from "../util/selection";
import {inputEvent} from "./inputEvent";

export const processPaste = (vditor: IVditor, text: string) => {
    const range = getEditorRange(vditor);
    range.extractContents();
    range.insertNode(document.createTextNode(Lute.Caret));
    range.insertNode(document.createTextNode(text));
    let blockElement = hasClosestByAttribute(range.startContainer, "data-block", "0");
    if (!blockElement) {
        blockElement = vditor.sv.element;
    }
    let spinHTML = vditor.lute.SpinVditorSVDOM(blockElement.textContent)
    if (spinHTML.indexOf('data-type="footnotes-link"') > -1 ||
        spinHTML.indexOf('data-type="link-ref-defs-block"') > -1) {
        spinHTML = "<div data-block='0'>" + spinHTML + "</div>";
    } else {
        spinHTML = "<div data-block='0'>" +
            spinHTML.replace(/<span data-type="newline"><br \/><span style="display: none">\n<\/span><\/span><span data-type="newline"><br \/><span style="display: none">\n<\/span><\/span></g, '<span data-type="newline"><br /><span style="display: none">\n</span></span><span data-type="newline"><br /><span style="display: none">\n</span></span></div><div data-block="0"><') +
            "</div>";
    }
    if (blockElement.isEqualNode(vditor.sv.element)) {
        blockElement.innerHTML = spinHTML;
    } else {
        blockElement.outerHTML = spinHTML;
    }
    setRangeByWbr(vditor.sv.element, range);

    scrollCenter(vditor);
};

export const getSideByType = (spanNode: Node, type: string, isPrevious = true) => {
    let sideElement = spanNode as Element;
    if (sideElement.nodeType === 3) {
        sideElement = sideElement.parentElement;
    }
    while (sideElement) {
        if (sideElement.getAttribute("data-type") === type) {
            return sideElement;
        }
        if (isPrevious) {
            sideElement = sideElement.previousElementSibling;
        } else {
            sideElement = sideElement.nextElementSibling;
        }
    }
    return false;
};

export const processSpinVditorSVDOM = (html: string, vditor: IVditor) => {
    log("SpinVditorSVDOM", html, "argument", vditor.options.debugger);
    const spinHTML = vditor.lute.SpinVditorSVDOM(html)
    if (spinHTML.indexOf('data-type="footnotes-link"') > -1 ||
        spinHTML.indexOf('data-type="link-ref-defs-block"') > -1) {
        html = "<div data-block='0'>" + spinHTML + "</div>";
    } else {
        html = "<div data-block='0'>" +
            spinHTML.replace(/<span data-type="newline"><br \/><span style="display: none">\n<\/span><\/span><span data-type="newline"><br \/><span style="display: none">\n<\/span><\/span></g, '<span data-type="newline"><br /><span style="display: none">\n</span></span><span data-type="newline"><br /><span style="display: none">\n</span></span></div><div data-block="0"><') +
            "</div>";
    }
    log("SpinVditorSVDOM", html, "result", vditor.options.debugger);
    return html;
};

export const processPreviousMarkers = (spanElement: HTMLElement) => {
    const spanType = spanElement.getAttribute("data-type");
    let previousElement = spanElement.previousElementSibling;
    // 有内容的子列表/标题，在其 marker 后换行
    let markerText = (spanType && spanType !== "text" && spanType !== "table" && spanType !== "heading-marker" &&
        spanType !== "newline" && spanType !== "yaml-front-matter-open-marker" && spanType !== "yaml-front-matter-close-marker"
        && spanType !== "code-block-info" && spanType !== "code-block-close-marker" && spanType !== "code-block-open-marker") ?
        spanElement.textContent : "";
    let hasNL = false;
    if (spanType === "newline") {
        hasNL = true;
    }
    while (previousElement && !hasNL) {
        const previousType = previousElement.getAttribute("data-type");
        if (previousType === "li-marker" || previousType === "blockquote-marker" || previousType === "task-marker" ||
            previousType === "padding") {
            const previousText = previousElement.textContent;
            if (previousType === "li-marker" &&
                (spanType === "code-block-open-marker" || spanType === "code-block-info")) {
                // https://github.com/Vanessa219/vditor/issues/586
                markerText = previousText.replace(/\S/g, " ") + markerText;
            } else if (spanType === "code-block-close-marker" &&
                previousElement.nextElementSibling.isSameNode(spanElement)) {
                // https://github.com/Vanessa219/vditor/issues/594
                const openMarker = getSideByType(spanElement, "code-block-open-marker");
                if (openMarker && openMarker.previousElementSibling) {
                    previousElement = openMarker.previousElementSibling;
                    markerText = previousText + markerText;
                }
            } else {
                markerText = previousText + markerText;
            }
        } else if (previousType === "newline") {
            hasNL = true;
        }
        previousElement = previousElement.previousElementSibling;
    }
    return markerText;
};

export const processAfterRender = (vditor: IVditor, options = {
    enableAddUndoStack: true,
    enableHint: false,
    enableInput: true,
}) => {
    if (options.enableHint) {
        vditor.hint.render(vditor);
    }

    vditor.preview.render(vditor);

    const text = getMarkdown(vditor);
    if (typeof vditor.options.input === "function" && options.enableInput) {
        vditor.options.input(text);
    }

    if (vditor.options.counter.enable) {
        vditor.counter.render(vditor, text);
    }

    if (vditor.options.cache.enable && accessLocalStorage()) {
        localStorage.setItem(vditor.options.cache.id, text);
        if (vditor.options.cache.after) {
            vditor.options.cache.after(text);
        }
    }

    if (vditor.devtools) {
        vditor.devtools.renderEchart(vditor);
    }

    clearTimeout(vditor.sv.processTimeoutId);
    vditor.sv.processTimeoutId = window.setTimeout(() => {
        if (options.enableAddUndoStack && !vditor.sv.composingLock) {
            vditor.undo.addToUndoStack(vditor);
        }
    }, vditor.options.undoDelay);
};

export const processHeading = (vditor: IVditor, value: string) => {
    const range = getEditorRange(vditor);
    const headingElement = hasClosestByTag(range.startContainer, "SPAN");
    if (headingElement && headingElement.textContent.trim() !== "") {
        value = "\n" + value;
    }
    range.collapse(true);
    document.execCommand("insertHTML", false, value);
};

export const processToolbar = (vditor: IVditor, actionBtn: Element, prefix: string, suffix: string) => {
    const range = getEditorRange(vditor);
    const commandName = actionBtn.getAttribute("data-type");
    // 添加
    if (vditor.sv.element.childNodes.length === 0) {
        vditor.sv.element.innerHTML = `<span data-type="p" data-block="0"><span data-type="text"><wbr></span></span><span data-type="newline"><br><span style="display: none">
</span></span>`;
        setRangeByWbr(vditor.sv.element, range);
    }
    const blockElement = hasClosestBlock(range.startContainer);
    const spanElement = hasClosestByTag(range.startContainer, "SPAN");
    if (!blockElement) {
        return;
    }
    if (commandName === "link") {
        let html;
        if (range.toString() === "") {
            html = `${prefix}${Lute.Caret}${suffix}`;
        } else {
            html = `${prefix}${range.toString()}${suffix.replace(")", Lute.Caret + ")")}`;
        }
        document.execCommand("insertHTML", false, html);
        return;
    } else if (commandName === "italic" || commandName === "bold" || commandName === "strike" ||
        commandName === "inline-code" || commandName === "code" || commandName === "table" || commandName === "line") {
        let html;
        // https://github.com/Vanessa219/vditor/issues/563 代码块不需要后面的 ```
        if (range.toString() === "") {
            html = `${prefix}${Lute.Caret}${commandName === "code" ? "" : suffix}`;
        } else {
            html = `${prefix}${range.toString()}${Lute.Caret}${commandName === "code" ? "" : suffix}`;
        }
        if (commandName === "table" || (commandName === "code" && spanElement && spanElement.textContent !== "")) {
            html = "\n\n" + html;
        } else if (commandName === "line") {
            html = `\n\n${prefix}\n${Lute.Caret}`;
        }
        document.execCommand("insertHTML", false, html);
        return;
    } else if (commandName === "check" || commandName === "list" || commandName === "ordered-list" ||
        commandName === "quote") {
        if (spanElement) {
            let marker = "* ";
            if (commandName === "check") {
                marker = "* [ ] ";
            } else if (commandName === "ordered-list") {
                marker = "1. ";
            } else if (commandName === "quote") {
                marker = "> ";
            }
            const newLine = getSideByType(spanElement, "newline");
            if (newLine) {
                newLine.insertAdjacentText("afterend", marker);
            } else {
                blockElement.insertAdjacentText("afterbegin", marker);
            }
            inputEvent(vditor);
            return;
        }
    }
    setRangeByWbr(vditor.sv.element, range);
    processAfterRender(vditor);
};
