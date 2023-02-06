import {Constants} from "../constants";
import {getMarkdown} from "../markdown/getMarkdown";
import {removeCurrentToolbar} from "../toolbar/setToolbar";
import {accessLocalStorage} from "../util/compatibility";
import {listToggle} from "../util/fixBrowserBehavior";
import {hasClosestBlock, hasClosestByAttribute, hasClosestByClassName, hasClosestByMatchTag} from "../util/hasClosest";
import {getEditorRange, getSelectPosition, setRangeByWbr, setSelectionFocus} from "../util/selection";
import {highlightToolbarIR} from "./highlightToolbarIR";
import {input} from "./input";

export const processHint = (vditor: IVditor) => {
    vditor.hint.render(vditor);
    const startContainer = getEditorRange(vditor).startContainer;
    // 代码块语言提示
    const preBeforeElement = hasClosestByAttribute(startContainer, "data-type", "code-block-info");
    if (preBeforeElement) {
        if (preBeforeElement.textContent.replace(Constants.ZWSP, "") === "" && vditor.hint.recentLanguage) {
            preBeforeElement.textContent = Constants.ZWSP + vditor.hint.recentLanguage;
            const range = getEditorRange(vditor);
            range.selectNodeContents(preBeforeElement);
        } else {
            const matchLangData: IHintData[] = [];
            const key =
                preBeforeElement.textContent.substring(0, getSelectPosition(preBeforeElement, vditor.ir.element).start)
                    .replace(Constants.ZWSP, "");
            Constants.CODE_LANGUAGES.forEach((keyName) => {
                if (keyName.indexOf(key.toLowerCase()) > -1) {
                    matchLangData.push({
                        html: keyName,
                        value: keyName,
                    });
                }
            });
            vditor.hint.genHTML(matchLangData, key, vditor);
        }
    }
};

export const processAfterRender = (vditor: IVditor, options = {
    enableAddUndoStack: true,
    enableHint: false,
    enableInput: true,
}) => {
    if (options.enableHint) {
        processHint(vditor);
    }

    clearTimeout(vditor.ir.processTimeoutId);
    vditor.ir.processTimeoutId = window.setTimeout(() => {
        if (vditor.ir.composingLock) {
            return;
        }
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

        if (options.enableAddUndoStack) {
            vditor.undo.addToUndoStack(vditor);
        }
    }, vditor.options.undoDelay);
};

export const processHeading = (vditor: IVditor, value: string) => {
    const range = getEditorRange(vditor);
    const headingElement = hasClosestBlock(range.startContainer) || range.startContainer as HTMLElement;
    if (headingElement) {
        const headingMarkerElement = headingElement.querySelector(".vditor-ir__marker--heading");
        if (headingMarkerElement) {
            headingMarkerElement.innerHTML = value;
        } else {
            headingElement.insertAdjacentText("afterbegin", value);
            range.selectNodeContents(headingElement);
            range.collapse(false);
        }
        input(vditor, range.cloneRange());
        highlightToolbarIR(vditor);
    }
};

const removeInline = (range: Range, vditor: IVditor, type: string) => {
    const inlineElement = hasClosestByAttribute(range.startContainer, "data-type", type) as HTMLElement;
    if (inlineElement) {
        inlineElement.firstElementChild.remove();
        inlineElement.lastElementChild.remove();
        range.insertNode(document.createElement("wbr"));
        const tempElement = document.createElement("div");
        tempElement.innerHTML = vditor.lute.SpinVditorIRDOM(inlineElement.outerHTML);
        inlineElement.outerHTML = tempElement.firstElementChild.innerHTML.trim();
    }
};

export const processToolbar = (vditor: IVditor, actionBtn: Element, prefix: string, suffix: string) => {
    const range = getEditorRange(vditor);
    const commandName = actionBtn.getAttribute("data-type");
    let typeElement = range.startContainer as HTMLElement;
    if (typeElement.nodeType === 3) {
        typeElement = typeElement.parentElement;
    }
    let useHighlight = true;
    // 移除
    if (actionBtn.classList.contains("vditor-menu--current")) {
        if (commandName === "quote") {
            const quoteElement = hasClosestByMatchTag(typeElement, "BLOCKQUOTE");
            if (quoteElement) {
                range.insertNode(document.createElement("wbr"));
                quoteElement.outerHTML = quoteElement.innerHTML.trim() === "" ?
                    `<p data-block="0">${quoteElement.innerHTML}</p>` : quoteElement.innerHTML;
            }
        } else if (commandName === "link") {
            const aElement = hasClosestByAttribute(range.startContainer, "data-type", "a") as HTMLElement;
            if (aElement) {
                const aTextElement = hasClosestByClassName(range.startContainer, "vditor-ir__link");
                if (aTextElement) {
                    range.insertNode(document.createElement("wbr"));
                    aElement.outerHTML = aTextElement.innerHTML;
                } else {
                    aElement.outerHTML = aElement.querySelector(".vditor-ir__link").innerHTML + "<wbr>";
                }
            }
        } else if (commandName === "italic") {
            removeInline(range, vditor, "em");
        } else if (commandName === "bold") {
            removeInline(range, vditor, "strong");
        } else if (commandName === "strike") {
            removeInline(range, vditor, "s");
        } else if (commandName === "inline-code") {
            removeInline(range, vditor, "code");
        } else if (commandName === "check" || commandName === "list" || commandName === "ordered-list") {
            listToggle(vditor, range, commandName);
            useHighlight = false;
            actionBtn.classList.remove("vditor-menu--current");
        }
    } else {
        // 添加
        if (vditor.ir.element.childNodes.length === 0) {
            vditor.ir.element.innerHTML = '<p data-block="0"><wbr></p>';
            setRangeByWbr(vditor.ir.element, range);
        }
        const blockElement = hasClosestBlock(range.startContainer);
        if (commandName === "line") {
            if (blockElement) {
                const hrHTML = '<hr data-block="0"><p data-block="0"><wbr>\n</p>';
                if (blockElement.innerHTML.trim() === "") {
                    blockElement.outerHTML = hrHTML;
                } else {
                    blockElement.insertAdjacentHTML("afterend", hrHTML);
                }
            }
        } else if (commandName === "quote") {
            if (blockElement) {
                range.insertNode(document.createElement("wbr"));
                blockElement.outerHTML = `<blockquote data-block="0">${blockElement.outerHTML}</blockquote>`;
                useHighlight = false;
                actionBtn.classList.add("vditor-menu--current");
            }
        } else if (commandName === "link") {
            let html;
            if (range.toString() === "") {
                html = `${prefix}<wbr>${suffix}`;
            } else {
                html = `${prefix}${range.toString()}${suffix.replace(")", "<wbr>)")}`;
            }
            document.execCommand("insertHTML", false, html);
            useHighlight = false;
            actionBtn.classList.add("vditor-menu--current");
        } else if (commandName === "italic" || commandName === "bold" || commandName === "strike"
            || commandName === "inline-code" || commandName === "code" || commandName === "table") {
            let html;
            if (range.toString() === "") {
                html = `${prefix}<wbr>${suffix}`;
            } else {
                if (commandName === "code" || commandName === "table") {
                    html = `${prefix}${range.toString()}<wbr>${suffix}`;
                } else {
                    html = `${prefix}${range.toString()}${suffix}<wbr>`;
                }
                range.deleteContents();
            }
            if (commandName === "table" || commandName === "code") {
                html = "\n" + html + "\n\n";
            }

            const spanElement = document.createElement("span");
            spanElement.innerHTML = html;
            range.insertNode(spanElement);
            input(vditor, range);

            if (commandName === "table") {
                range.selectNodeContents(getSelection().getRangeAt(0).startContainer.parentElement);
                setSelectionFocus(range);
            }
        } else if (commandName === "check" || commandName === "list" || commandName === "ordered-list") {
            listToggle(vditor, range, commandName, false);
            useHighlight = false;
            removeCurrentToolbar(vditor.toolbar.elements, ["check", "list", "ordered-list"]);
            actionBtn.classList.add("vditor-menu--current");
        }
    }
    setRangeByWbr(vditor.ir.element, range);
    processAfterRender(vditor);
    if (useHighlight) {
        highlightToolbarIR(vditor);
    }
};
