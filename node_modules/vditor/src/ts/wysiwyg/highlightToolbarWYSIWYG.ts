import {Constants} from "../constants";
import {disableToolbar} from "../toolbar/setToolbar";
import {enableToolbar} from "../toolbar/setToolbar";
import {removeCurrentToolbar} from "../toolbar/setToolbar";
import {setCurrentToolbar} from "../toolbar/setToolbar";
import {isCtrl, updateHotkeyTip} from "../util/compatibility";
import {scrollCenter} from "../util/editorCommonEvent";
import {
    deleteColumn,
    deleteRow,
    insertColumn,
    insertRow,
    insertRowAbove,
    setTableAlign,
} from "../util/fixBrowserBehavior";
import {
    hasClosestByAttribute,
    hasClosestByClassName,
    hasClosestByMatchTag,
} from "../util/hasClosest";
import {
    hasClosestByHeadings,
    hasClosestByTag,
} from "../util/hasClosestByHeadings";
import {processCodeRender} from "../util/processCode";
import {
    getEditorRange,
    selectIsEditor,
    setRangeByWbr,
    setSelectionFocus,
} from "../util/selection";
import {afterRenderEvent} from "./afterRenderEvent";
import {removeBlockElement} from "./processKeydown";
import {renderToc} from "../util/toc";

export const highlightToolbarWYSIWYG = (vditor: IVditor) => {
    clearTimeout(vditor.wysiwyg.hlToolbarTimeoutId);
    vditor.wysiwyg.hlToolbarTimeoutId = window.setTimeout(() => {
        if (
            vditor.wysiwyg.element.getAttribute("contenteditable") === "false"
        ) {
            return;
        }
        if (!selectIsEditor(vditor.wysiwyg.element)) {
            return;
        }

        removeCurrentToolbar(vditor.toolbar.elements, Constants.EDIT_TOOLBARS);
        enableToolbar(vditor.toolbar.elements, Constants.EDIT_TOOLBARS);

        const range = getSelection().getRangeAt(0);
        let typeElement = range.startContainer as HTMLElement;
        if (range.startContainer.nodeType === 3) {
            typeElement = range.startContainer.parentElement;
        } else {
            typeElement = typeElement.childNodes[
                range.startOffset >= typeElement.childNodes.length
                    ? typeElement.childNodes.length - 1
                    : range.startOffset
                ] as HTMLElement;
        }

        const footnotesElement = hasClosestByAttribute(typeElement, "data-type", "footnotes-block");
        if (footnotesElement) {
            vditor.wysiwyg.popover.innerHTML = "";
            genClose(footnotesElement, vditor);
            setPopoverPosition(vditor, footnotesElement);
            return;
        }

        // 工具栏高亮和禁用
        const liElement = hasClosestByMatchTag(typeElement, "LI");
        if (liElement) {
            if (liElement.classList.contains("vditor-task")) {
                setCurrentToolbar(vditor.toolbar.elements, ["check"]);
            } else if (liElement.parentElement.tagName === "OL") {
                setCurrentToolbar(vditor.toolbar.elements, ["ordered-list"]);
            } else if (liElement.parentElement.tagName === "UL") {
                setCurrentToolbar(vditor.toolbar.elements, ["list"]);
            }
            enableToolbar(vditor.toolbar.elements, ["outdent", "indent"]);
        } else {
            disableToolbar(vditor.toolbar.elements, ["outdent", "indent"]);
        }

        if (hasClosestByMatchTag(typeElement, "BLOCKQUOTE")) {
            setCurrentToolbar(vditor.toolbar.elements, ["quote"]);
        }

        if (
            hasClosestByMatchTag(typeElement, "B") ||
            hasClosestByMatchTag(typeElement, "STRONG")
        ) {
            setCurrentToolbar(vditor.toolbar.elements, ["bold"]);
        }

        if (
            hasClosestByMatchTag(typeElement, "I") ||
            hasClosestByMatchTag(typeElement, "EM")
        ) {
            setCurrentToolbar(vditor.toolbar.elements, ["italic"]);
        }

        if (
            hasClosestByMatchTag(typeElement, "STRIKE") ||
            hasClosestByMatchTag(typeElement, "S")
        ) {
            setCurrentToolbar(vditor.toolbar.elements, ["strike"]);
        }

        // comments
        vditor.wysiwyg.element
            .querySelectorAll(".vditor-comment--focus")
            .forEach((item) => {
                item.classList.remove("vditor-comment--focus");
            });
        const commentElement = hasClosestByClassName(typeElement, "vditor-comment");
        if (commentElement) {
            let ids = commentElement.getAttribute("data-cmtids").split(" ");
            if (ids.length > 1 && commentElement.nextSibling.isSameNode(commentElement.nextElementSibling)) {
                const nextIds = commentElement.nextElementSibling
                    .getAttribute("data-cmtids")
                    .split(" ");
                ids.find((id) => {
                    if (nextIds.includes(id)) {
                        ids = [id];
                        return true;
                    }
                });
            }
            vditor.wysiwyg.element
                .querySelectorAll(".vditor-comment")
                .forEach((item) => {
                    if (item.getAttribute("data-cmtids").indexOf(ids[0]) > -1) {
                        item.classList.add("vditor-comment--focus");
                    }
                });
        }

        const aElement = hasClosestByMatchTag(typeElement, "A");
        if (aElement) {
            setCurrentToolbar(vditor.toolbar.elements, ["link"]);
        }
        const tableElement = hasClosestByMatchTag(typeElement, "TABLE") as HTMLTableElement;
        const headingElement = hasClosestByHeadings(typeElement) as HTMLElement;
        if (hasClosestByMatchTag(typeElement, "CODE")) {
            if (hasClosestByMatchTag(typeElement, "PRE")) {
                disableToolbar(vditor.toolbar.elements, [
                    "headings",
                    "bold",
                    "italic",
                    "strike",
                    "line",
                    "quote",
                    "list",
                    "ordered-list",
                    "check",
                    "code",
                    "inline-code",
                    "upload",
                    "link",
                    "table",
                    "record",
                ]);
                setCurrentToolbar(vditor.toolbar.elements, ["code"]);
            } else {
                disableToolbar(vditor.toolbar.elements, [
                    "headings",
                    "bold",
                    "italic",
                    "strike",
                    "line",
                    "quote",
                    "list",
                    "ordered-list",
                    "check",
                    "code",
                    "upload",
                    "link",
                    "table",
                    "record",
                ]);
                setCurrentToolbar(vditor.toolbar.elements, ["inline-code"]);
            }
        } else if (headingElement) {
            disableToolbar(vditor.toolbar.elements, ["bold"]);
            setCurrentToolbar(vditor.toolbar.elements, ["headings"]);
        } else if (tableElement) {
            disableToolbar(vditor.toolbar.elements, ["table"]);
        }

        // toc popover
        const tocElement = hasClosestByClassName(typeElement, "vditor-toc") as HTMLElement;
        if (tocElement) {
            vditor.wysiwyg.popover.innerHTML = "";
            genClose(tocElement, vditor);
            setPopoverPosition(vditor, tocElement);
            return;
        }

        // quote popover
        const blockquoteElement = hasClosestByTag(typeElement, "BLOCKQUOTE") as HTMLTableElement;
        if (blockquoteElement) {
            vditor.wysiwyg.popover.innerHTML = "";
            genUp(range, blockquoteElement, vditor);
            genDown(range, blockquoteElement, vditor);
            genClose(blockquoteElement, vditor);
            setPopoverPosition(vditor, blockquoteElement);
        }

        // list item popover
        if (liElement) {
            vditor.wysiwyg.popover.innerHTML = "";

            genUp(range, liElement, vditor);
            genDown(range, liElement, vditor);
            genClose(liElement, vditor);

            setPopoverPosition(vditor, liElement);
        }

        // table popover
        if (tableElement) {
            const lang: keyof II18n | "" = vditor.options.lang;
            const options: IOptions = vditor.options;
            vditor.wysiwyg.popover.innerHTML = "";
            const updateTable = () => {
                const oldRow = tableElement.rows.length;
                const oldColumn = tableElement.rows[0].cells.length;
                const row = parseInt(input.value, 10) || oldRow;
                const column = parseInt(input2.value, 10) || oldColumn;

                if (row === oldRow && oldColumn === column) {
                    return;
                }

                if (oldColumn !== column) {
                    const columnDiff = column - oldColumn;
                    for (let i = 0; i < tableElement.rows.length; i++) {
                        if (columnDiff > 0) {
                            for (let j = 0; j < columnDiff; j++) {
                                if (i === 0) {
                                    tableElement.rows[i].lastElementChild.insertAdjacentHTML("afterend", "<th> </th>");
                                } else {
                                    tableElement.rows[i].lastElementChild.insertAdjacentHTML("afterend", "<td> </td>");
                                }
                            }
                        } else {
                            for (let k = oldColumn - 1; k >= column; k--) {
                                tableElement.rows[i].cells[k].remove();
                            }
                        }
                    }
                }

                if (oldRow !== row) {
                    const rowDiff = row - oldRow;
                    if (rowDiff > 0) {
                        let rowHTML = "<tr>";
                        for (let m = 0; m < column; m++) {
                            rowHTML += "<td> </td>";
                        }
                        for (let l = 0; l < rowDiff; l++) {
                            if (tableElement.querySelector("tbody")) {
                                tableElement
                                    .querySelector("tbody")
                                    .insertAdjacentHTML("beforeend", rowHTML);
                            } else {
                                tableElement
                                    .querySelector("thead")
                                    .insertAdjacentHTML("afterend", rowHTML + "</tr>");
                            }
                        }
                    } else {
                        for (let m = oldRow - 1; m >= row; m--) {
                            tableElement.rows[m].remove();
                            if (tableElement.rows.length === 1) {
                                tableElement.querySelector("tbody").remove();
                            }
                        }
                    }
                }
            };

            const setAlign = (type: string) => {
                setTableAlign(tableElement, type);
                if (type === "right") {
                    left.classList.remove("vditor-icon--current");
                    center.classList.remove("vditor-icon--current");
                    right.classList.add("vditor-icon--current");
                } else if (type === "center") {
                    left.classList.remove("vditor-icon--current");
                    right.classList.remove("vditor-icon--current");
                    center.classList.add("vditor-icon--current");
                } else {
                    center.classList.remove("vditor-icon--current");
                    right.classList.remove("vditor-icon--current");
                    left.classList.add("vditor-icon--current");
                }
                setSelectionFocus(range);
                afterRenderEvent(vditor);
            };

            const td = hasClosestByMatchTag(typeElement, "TD");
            const th = hasClosestByMatchTag(typeElement, "TH");
            let alignType = "left";
            if (td) {
                alignType = td.getAttribute("align") || "left";
            } else if (th) {
                alignType = th.getAttribute("align") || "center";
            }

            const left = document.createElement("button");
            left.setAttribute("type", "button");
            left.setAttribute("aria-label", window.VditorI18n.alignLeft + "<" + updateHotkeyTip("⇧⌘L") + ">");
            left.setAttribute("data-type", "left");
            left.innerHTML =
                '<svg><use xlink:href="#vditor-icon-align-left"></use></svg>';
            left.className =
                "vditor-icon vditor-tooltipped vditor-tooltipped__n" +
                (alignType === "left" ? " vditor-icon--current" : "");
            left.onclick = () => {
                setAlign("left");
            };

            const center = document.createElement("button");
            center.setAttribute("type", "button");
            center.setAttribute("aria-label", window.VditorI18n.alignCenter + "<" + updateHotkeyTip("⇧⌘C") + ">");
            center.setAttribute("data-type", "center");
            center.innerHTML =
                '<svg><use xlink:href="#vditor-icon-align-center"></use></svg>';
            center.className =
                "vditor-icon vditor-tooltipped vditor-tooltipped__n" +
                (alignType === "center" ? " vditor-icon--current" : "");
            center.onclick = () => {
                setAlign("center");
            };

            const right = document.createElement("button");
            right.setAttribute("type", "button");
            right.setAttribute("aria-label", window.VditorI18n.alignRight + "<" + updateHotkeyTip("⇧⌘R") + ">");
            right.setAttribute("data-type", "right");
            right.innerHTML =
                '<svg><use xlink:href="#vditor-icon-align-right"></use></svg>';
            right.className =
                "vditor-icon vditor-tooltipped vditor-tooltipped__n" +
                (alignType === "right" ? " vditor-icon--current" : "");
            right.onclick = () => {
                setAlign("right");
            };

            const insertRowElement = document.createElement("button");
            insertRowElement.setAttribute("type", "button");
            insertRowElement.setAttribute("aria-label", window.VditorI18n.insertRowBelow + "<" + updateHotkeyTip("⌘=") + ">");
            insertRowElement.setAttribute("data-type", "insertRow");
            insertRowElement.innerHTML =
                '<svg><use xlink:href="#vditor-icon-insert-row"></use></svg>';
            insertRowElement.className =
                "vditor-icon vditor-tooltipped vditor-tooltipped__n";
            insertRowElement.onclick = () => {
                const startContainer = getSelection().getRangeAt(0)
                    .startContainer;
                const cellElement =
                    hasClosestByMatchTag(startContainer, "TD") ||
                    hasClosestByMatchTag(startContainer, "TH");
                if (cellElement) {
                    insertRow(vditor, range, cellElement);
                }
            };

            const insertRowBElement = document.createElement("button");
            insertRowBElement.setAttribute("type", "button");
            insertRowBElement.setAttribute("aria-label",
                window.VditorI18n.insertRowAbove + "<" + updateHotkeyTip("⇧⌘F") + ">");
            insertRowBElement.setAttribute("data-type", "insertRow");
            insertRowBElement.innerHTML =
                '<svg><use xlink:href="#vditor-icon-insert-rowb"></use></svg>';
            insertRowBElement.className =
                "vditor-icon vditor-tooltipped vditor-tooltipped__n";
            insertRowBElement.onclick = () => {
                const startContainer = getSelection().getRangeAt(0)
                    .startContainer;
                const cellElement =
                    hasClosestByMatchTag(startContainer, "TD") ||
                    hasClosestByMatchTag(startContainer, "TH");
                if (cellElement) {
                    insertRowAbove(vditor, range, cellElement);
                }
            };

            const insertColumnElement = document.createElement("button");
            insertColumnElement.setAttribute("type", "button");
            insertColumnElement.setAttribute("aria-label", window.VditorI18n.insertColumnRight + "<" + updateHotkeyTip("⇧⌘=") + ">");
            insertColumnElement.setAttribute("data-type", "insertColumn");
            insertColumnElement.innerHTML =
                '<svg><use xlink:href="#vditor-icon-insert-column"></use></svg>';
            insertColumnElement.className =
                "vditor-icon vditor-tooltipped vditor-tooltipped__n";
            insertColumnElement.onclick = () => {
                const startContainer = getSelection().getRangeAt(0)
                    .startContainer;
                const cellElement =
                    hasClosestByMatchTag(startContainer, "TD") ||
                    hasClosestByMatchTag(startContainer, "TH");
                if (cellElement) {
                    insertColumn(vditor, tableElement, cellElement);
                }
            };

            const insertColumnBElement = document.createElement("button");
            insertColumnBElement.setAttribute("type", "button");
            insertColumnBElement.setAttribute("aria-label", window.VditorI18n.insertColumnLeft + "<" + updateHotkeyTip("⇧⌘G") + ">");
            insertColumnBElement.setAttribute("data-type", "insertColumn");
            insertColumnBElement.innerHTML =
                '<svg><use xlink:href="#vditor-icon-insert-columnb"></use></svg>';
            insertColumnBElement.className =
                "vditor-icon vditor-tooltipped vditor-tooltipped__n";
            insertColumnBElement.onclick = () => {
                const startContainer = getSelection().getRangeAt(0)
                    .startContainer;
                const cellElement =
                    hasClosestByMatchTag(startContainer, "TD") ||
                    hasClosestByMatchTag(startContainer, "TH");
                if (cellElement) {
                    insertColumn(vditor, tableElement, cellElement, "beforebegin");
                }
            };

            const deleteRowElement = document.createElement("button");
            deleteRowElement.setAttribute("type", "button");
            deleteRowElement.setAttribute("aria-label", window.VditorI18n["delete-row"] + "<" + updateHotkeyTip("⌘-") + ">");
            deleteRowElement.setAttribute("data-type", "deleteRow");
            deleteRowElement.innerHTML =
                '<svg><use xlink:href="#vditor-icon-delete-row"></use></svg>';
            deleteRowElement.className =
                "vditor-icon vditor-tooltipped vditor-tooltipped__n";
            deleteRowElement.onclick = () => {
                const startContainer = getSelection().getRangeAt(0)
                    .startContainer;
                const cellElement =
                    hasClosestByMatchTag(startContainer, "TD") ||
                    hasClosestByMatchTag(startContainer, "TH");
                if (cellElement) {
                    deleteRow(vditor, range, cellElement);
                }
            };

            const deleteColumnElement = document.createElement("button");
            deleteColumnElement.setAttribute("type", "button");
            deleteColumnElement.setAttribute("aria-label", window.VditorI18n["delete-column"] + "<" + updateHotkeyTip("⇧⌘-") + ">");
            deleteColumnElement.setAttribute("data-type", "deleteColumn");
            deleteColumnElement.innerHTML =
                '<svg><use xlink:href="#vditor-icon-delete-column"></use></svg>';
            deleteColumnElement.className =
                "vditor-icon vditor-tooltipped vditor-tooltipped__n";
            deleteColumnElement.onclick = () => {
                const startContainer = getSelection().getRangeAt(0)
                    .startContainer;
                const cellElement =
                    hasClosestByMatchTag(startContainer, "TD") ||
                    hasClosestByMatchTag(startContainer, "TH");
                if (cellElement) {
                    deleteColumn(vditor, range, tableElement, cellElement);
                }
            };

            const inputWrap = document.createElement("span");
            inputWrap.setAttribute("aria-label", window.VditorI18n.row);
            inputWrap.className = "vditor-tooltipped vditor-tooltipped__n";
            const input = document.createElement("input");
            inputWrap.appendChild(input);
            input.type = "number";
            input.min = "1";
            input.className = "vditor-input";
            input.style.width = "42px";
            input.style.textAlign = "center";
            input.setAttribute("placeholder", window.VditorI18n.row);
            input.value = tableElement.rows.length.toString();
            input.oninput = () => {
                updateTable();
            };
            input.onkeydown = (event) => {
                if (event.isComposing) {
                    return;
                }
                if (event.key === "Tab") {
                    input2.focus();
                    input2.select();
                    event.preventDefault();
                    return;
                }
                removeBlockElement(vditor, event);
            };

            const input2Wrap = document.createElement("span");
            input2Wrap.setAttribute("aria-label", window.VditorI18n.column);
            input2Wrap.className = "vditor-tooltipped vditor-tooltipped__n";
            const input2 = document.createElement("input");
            input2Wrap.appendChild(input2);
            input2.type = "number";
            input2.min = "1";
            input2.className = "vditor-input";
            input2.style.width = "42px";
            input2.style.textAlign = "center";
            input2.setAttribute("placeholder", window.VditorI18n.column);
            input2.value = tableElement.rows[0].cells.length.toString();
            input2.oninput = () => {
                updateTable();
            };
            input2.onkeydown = (event) => {
                if (event.isComposing) {
                    return;
                }
                if (event.key === "Tab") {
                    input.focus();
                    input.select();
                    event.preventDefault();
                    return;
                }
                removeBlockElement(vditor, event);
            };

            genUp(range, tableElement, vditor);
            genDown(range, tableElement, vditor);
            genClose(tableElement, vditor);
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", left);
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", center);
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", right);
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", insertRowBElement);
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", insertRowElement);
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", insertColumnBElement);
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", insertColumnElement);
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", deleteRowElement);
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", deleteColumnElement);
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", inputWrap);
            vditor.wysiwyg.popover.insertAdjacentHTML("beforeend", " x ");
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", input2Wrap);
            setPopoverPosition(vditor, tableElement);
        }

        // link ref popover
        const linkRefElement = hasClosestByAttribute(typeElement, "data-type", "link-ref");
        if (linkRefElement) {
            genLinkRefPopover(vditor, linkRefElement);
        }

        // footnote popover
        const footnotesRefElement = hasClosestByAttribute(typeElement, "data-type", "footnotes-ref");
        if (footnotesRefElement) {
            const lang: keyof II18n | "" = vditor.options.lang;
            const options: IOptions = vditor.options;
            vditor.wysiwyg.popover.innerHTML = "";

            const inputWrap = document.createElement("span");
            inputWrap.setAttribute("aria-label", window.VditorI18n.footnoteRef + "<" + updateHotkeyTip("⌥Enter") + ">");
            inputWrap.className = "vditor-tooltipped vditor-tooltipped__n";
            const input = document.createElement("input");
            inputWrap.appendChild(input);
            input.className = "vditor-input";
            input.setAttribute("placeholder", window.VditorI18n.footnoteRef + "<" + updateHotkeyTip("⌥Enter") + ">");
            input.style.width = "120px";
            input.value = footnotesRefElement.getAttribute("data-footnotes-label");
            input.oninput = () => {
                if (input.value.trim() !== "") {
                    footnotesRefElement.setAttribute("data-footnotes-label", input.value);
                }
            };
            input.onkeydown = (event) => {
                if (event.isComposing) {
                    return;
                }
                if (
                    !isCtrl(event) &&
                    !event.shiftKey &&
                    event.altKey &&
                    event.key === "Enter"
                ) {
                    range.selectNodeContents(footnotesRefElement);
                    range.collapse(false);
                    setSelectionFocus(range);
                    event.preventDefault();
                    return;
                }
                removeBlockElement(vditor, event);
            };

            genClose(footnotesRefElement, vditor);
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", inputWrap);
            setPopoverPosition(vditor, footnotesRefElement);
        }

        // block popover: math-inline, math-block, html-block, html-inline, code-block, html-entity
        let blockRenderElement = hasClosestByClassName(typeElement, "vditor-wysiwyg__block") as HTMLElement;
        const isBlock = blockRenderElement ? blockRenderElement.getAttribute("data-type").indexOf("block") > -1 : false;
        vditor.wysiwyg.element
            .querySelectorAll(".vditor-wysiwyg__preview")
            .forEach((itemElement) => {
                if (!blockRenderElement || (blockRenderElement && isBlock && !blockRenderElement.contains(itemElement))) {
                    const previousElement = itemElement.previousElementSibling as HTMLElement;
                    previousElement.style.display = "none";
                }
            });
        if (blockRenderElement && isBlock) {
            vditor.wysiwyg.popover.innerHTML = "";
            genUp(range, blockRenderElement, vditor);
            genDown(range, blockRenderElement, vditor);
            genClose(blockRenderElement, vditor);

            if (blockRenderElement.getAttribute("data-type") === "code-block") {
                const languageWrap = document.createElement("span");
                languageWrap.setAttribute("aria-label", window.VditorI18n.language + "<" + updateHotkeyTip("⌥Enter") + ">");
                languageWrap.className = "vditor-tooltipped vditor-tooltipped__n";
                const language = document.createElement("input");
                languageWrap.appendChild(language);

                const codeElement =
                    blockRenderElement.firstElementChild.firstElementChild;

                language.className = "vditor-input";
                language.setAttribute("placeholder",
                    window.VditorI18n.language + "<" + updateHotkeyTip("⌥Enter") + ">");
                language.value =
                    codeElement.className.indexOf("language-") > -1
                        ? codeElement.className.split("-")[1].split(" ")[0]
                        : "";
                language.oninput = (e: InputEvent) => {
                    if (language.value.trim() !== "") {
                        codeElement.className = `language-${language.value}`;
                    } else {
                        codeElement.className = "";
                        vditor.hint.recentLanguage = "";
                    }
                    if (blockRenderElement.lastElementChild.classList.contains("vditor-wysiwyg__preview")) {
                        blockRenderElement.lastElementChild.innerHTML =
                            blockRenderElement.firstElementChild.innerHTML;
                        processCodeRender(blockRenderElement.lastElementChild as HTMLElement, vditor);
                    }
                    afterRenderEvent(vditor);
                    // 当鼠标点选语言时，触发自定义input事件
                    if (e.detail === 1) {
                        // 选择语言后，输入焦点切换到代码输入框
                        range.setStart(codeElement.firstChild, 0);
                        range.collapse(true);
                        setSelectionFocus(range);
                    }
                };
                language.onkeydown = (event: KeyboardEvent) => {
                    if (event.isComposing) {
                        return;
                    }
                    if (removeBlockElement(vditor, event)) {
                        return;
                    }
                    if (
                        event.key === "Escape" &&
                        vditor.hint.element.style.display === "block"
                    ) {
                        vditor.hint.element.style.display = "none";
                        event.preventDefault();
                        return;
                    }
                    vditor.hint.select(event, vditor);
                    if (
                        !isCtrl(event) &&
                        !event.shiftKey &&
                        event.key === "Enter"
                    ) {
                        range.setStart(codeElement.firstChild, 0);
                        range.collapse(true);
                        setSelectionFocus(range);
                        event.preventDefault();
                        event.stopPropagation();
                    }
                };
                language.onkeyup = (event: KeyboardEvent) => {
                    if (
                        event.isComposing ||
                        event.key === "Enter" ||
                        event.key === "ArrowUp" ||
                        event.key === "Escape" ||
                        event.key === "ArrowDown"
                    ) {
                        return;
                    }
                    const matchLangData: IHintData[] = [];
                    const key = language.value.substring(0, language.selectionStart);
                    Constants.CODE_LANGUAGES.forEach((keyName) => {
                        if (keyName.indexOf(key.toLowerCase()) > -1) {
                            matchLangData.push({
                                html: keyName,
                                value: keyName,
                            });
                        }
                    });
                    vditor.hint.genHTML(matchLangData, key, vditor);
                    event.preventDefault();
                };
                vditor.wysiwyg.popover.insertAdjacentElement("beforeend", languageWrap);
            }
            setPopoverPosition(vditor, blockRenderElement);
        } else {
            blockRenderElement = undefined;
        }
        if (headingElement) {
            vditor.wysiwyg.popover.innerHTML = "";

            const inputWrap = document.createElement("span");
            inputWrap.setAttribute("aria-label", "ID" + "<" + updateHotkeyTip("⌥Enter") + ">");
            inputWrap.className = "vditor-tooltipped vditor-tooltipped__n";
            const input = document.createElement("input");
            inputWrap.appendChild(input);
            input.className = "vditor-input";
            input.setAttribute("placeholder", "ID" + "<" + updateHotkeyTip("⌥Enter") + ">");
            input.style.width = "120px";
            input.value = headingElement.getAttribute("data-id") || "";
            input.oninput = () => {
                headingElement.setAttribute("data-id", input.value);
            };
            input.onkeydown = (event) => {
                if (event.isComposing) {
                    return;
                }
                if (
                    !isCtrl(event) &&
                    !event.shiftKey &&
                    event.altKey &&
                    event.key === "Enter"
                ) {
                    range.selectNodeContents(headingElement);
                    range.collapse(false);
                    setSelectionFocus(range);
                    event.preventDefault();
                    return;
                }
                removeBlockElement(vditor, event);
            };

            genUp(range, headingElement, vditor);
            genDown(range, headingElement, vditor);
            genClose(headingElement, vditor);
            vditor.wysiwyg.popover.insertAdjacentElement("beforeend", inputWrap);
            setPopoverPosition(vditor, headingElement);
        }

        // a popover
        if (aElement) {
            genAPopover(vditor, aElement);
        }

        if (
            !blockquoteElement &&
            !liElement &&
            !tableElement &&
            !blockRenderElement &&
            !aElement &&
            !linkRefElement &&
            !footnotesRefElement &&
            !headingElement &&
            !tocElement
        ) {
            const blockElement = hasClosestByAttribute(typeElement, "data-block", "0");
            if (
                blockElement &&
                blockElement.parentElement.isEqualNode(vditor.wysiwyg.element)
            ) {
                vditor.wysiwyg.popover.innerHTML = "";
                genUp(range, blockElement, vditor);
                genDown(range, blockElement, vditor);
                genClose(blockElement, vditor);

                setPopoverPosition(vditor, blockElement);
            } else {
                vditor.wysiwyg.popover.style.display = "none";
            }
        }

        // 反斜杠特殊处理
        vditor.wysiwyg.element
            .querySelectorAll('span[data-type="backslash"] > span')
            .forEach((item: HTMLElement) => {
                item.style.display = "none";
            });
        const backslashElement = hasClosestByAttribute(range.startContainer, "data-type", "backslash");
        if (backslashElement) {
            backslashElement.querySelector("span").style.display = "inline";
        }
    }, 200);
};

const setPopoverPosition = (vditor: IVditor, element: HTMLElement) => {
    let targetElement = element;
    const tableElement = hasClosestByMatchTag(element, "TABLE");
    if (tableElement) {
        targetElement = tableElement;
    }
    vditor.wysiwyg.popover.style.left = "0";
    vditor.wysiwyg.popover.style.display = "block";
    vditor.wysiwyg.popover.style.top =
        Math.max(-8, targetElement.offsetTop - 21 - vditor.wysiwyg.element.scrollTop) + "px";
    vditor.wysiwyg.popover.style.left =
        Math.min(targetElement.offsetLeft, vditor.wysiwyg.element.clientWidth - vditor.wysiwyg.popover.clientWidth) + "px";
    vditor.wysiwyg.popover.setAttribute("data-top", (targetElement.offsetTop - 21).toString());
};

export const genLinkRefPopover = (vditor: IVditor, linkRefElement: HTMLElement) => {
    vditor.wysiwyg.popover.innerHTML = "";

    const updateLinkRef = () => {
        if (input.value.trim() !== "") {
            if (linkRefElement.tagName === "IMG") {
                linkRefElement.setAttribute("alt", input.value);
            } else {
                linkRefElement.textContent = input.value;
            }
        }
        // data-link-label
        if (input1.value.trim() !== "") {
            linkRefElement.setAttribute("data-link-label", input1.value);
        }
    };

    const inputWrap = document.createElement("span");
    inputWrap.setAttribute("aria-label", window.VditorI18n.textIsNotEmpty);
    inputWrap.className = "vditor-tooltipped vditor-tooltipped__n";
    const input = document.createElement("input");
    inputWrap.appendChild(input);
    input.className = "vditor-input";
    input.setAttribute("placeholder", window.VditorI18n.textIsNotEmpty);
    input.style.width = "120px";
    input.value =
        linkRefElement.getAttribute("alt") || linkRefElement.textContent;
    input.oninput = () => {
        updateLinkRef();
    };
    input.onkeydown = (event) => {
        if (removeBlockElement(vditor, event)) {
            return;
        }
        linkHotkey(vditor, linkRefElement, event, input1);
    };

    const input1Wrap = document.createElement("span");
    input1Wrap.setAttribute("aria-label", window.VditorI18n.linkRef);
    input1Wrap.className = "vditor-tooltipped vditor-tooltipped__n";
    const input1 = document.createElement("input");
    input1Wrap.appendChild(input1);
    input1.className = "vditor-input";
    input1.setAttribute("placeholder", window.VditorI18n.linkRef);
    input1.value = linkRefElement.getAttribute("data-link-label");
    input1.oninput = () => {
        updateLinkRef();
    };
    input1.onkeydown = (event) => {
        if (removeBlockElement(vditor, event)) {
            return;
        }
        linkHotkey(vditor, linkRefElement, event, input);
    };

    genClose(linkRefElement, vditor);
    vditor.wysiwyg.popover.insertAdjacentElement("beforeend", inputWrap);
    vditor.wysiwyg.popover.insertAdjacentElement("beforeend", input1Wrap);
    setPopoverPosition(vditor, linkRefElement);
};

const genUp = (range: Range, element: HTMLElement, vditor: IVditor) => {
    const previousElement = element.previousElementSibling;
    if (
        !previousElement ||
        (!element.parentElement.isEqualNode(vditor.wysiwyg.element) &&
            element.tagName !== "LI")
    ) {
        return;
    }
    const upElement = document.createElement("button");
    upElement.setAttribute("type", "button");
    upElement.setAttribute("data-type", "up");
    upElement.setAttribute("aria-label", window.VditorI18n.up + "<" + updateHotkeyTip("⇧⌘U") + ">");
    upElement.innerHTML = '<svg><use xlink:href="#vditor-icon-up"></use></svg>';
    upElement.className = "vditor-icon vditor-tooltipped vditor-tooltipped__n";
    upElement.onclick = () => {
        range.insertNode(document.createElement("wbr"));
        previousElement.insertAdjacentElement("beforebegin", element);
        setRangeByWbr(vditor.wysiwyg.element, range);
        afterRenderEvent(vditor);
        highlightToolbarWYSIWYG(vditor);
        scrollCenter(vditor);
    };
    vditor.wysiwyg.popover.insertAdjacentElement("beforeend", upElement);
};

const genDown = (range: Range, element: HTMLElement, vditor: IVditor) => {
    const nextElement = element.nextElementSibling;
    if (
        !nextElement ||
        (!element.parentElement.isEqualNode(vditor.wysiwyg.element) &&
            element.tagName !== "LI")
    ) {
        return;
    }
    const downElement = document.createElement("button");
    downElement.setAttribute("type", "button");
    downElement.setAttribute("data-type", "down");
    downElement.setAttribute("aria-label", window.VditorI18n.down + "<" + updateHotkeyTip("⇧⌘D") + ">");
    downElement.innerHTML =
        '<svg><use xlink:href="#vditor-icon-down"></use></svg>';
    downElement.className =
        "vditor-icon vditor-tooltipped vditor-tooltipped__n";
    downElement.onclick = () => {
        range.insertNode(document.createElement("wbr"));
        nextElement.insertAdjacentElement("afterend", element);
        setRangeByWbr(vditor.wysiwyg.element, range);
        afterRenderEvent(vditor);
        highlightToolbarWYSIWYG(vditor);
        scrollCenter(vditor);
    };
    vditor.wysiwyg.popover.insertAdjacentElement("beforeend", downElement);
};

const genClose = (element: HTMLElement, vditor: IVditor) => {
    const close = document.createElement("button");
    close.setAttribute("type", "button");
    close.setAttribute("data-type", "remove");
    close.setAttribute("aria-label", window.VditorI18n.remove + "<" + updateHotkeyTip("⇧⌘X") + ">");
    close.innerHTML =
        '<svg><use xlink:href="#vditor-icon-trashcan"></use></svg>';
    close.className = "vditor-icon vditor-tooltipped vditor-tooltipped__n";
    close.onclick = () => {
        const range = getEditorRange(vditor);
        range.setStartAfter(element);
        setSelectionFocus(range);
        element.remove();
        afterRenderEvent(vditor);
        highlightToolbarWYSIWYG(vditor);
        if (["H1", "H2", "H3", "H4", "H5" ,"H6"].includes(element.tagName)) {
            renderToc(vditor);
        }
    };
    vditor.wysiwyg.popover.insertAdjacentElement("beforeend", close);
};

const linkHotkey = (
    vditor: IVditor,
    element: HTMLElement,
    event: KeyboardEvent,
    nextInputElement: HTMLInputElement,
) => {
    if (event.isComposing) {
        return;
    }
    if (event.key === "Tab") {
        nextInputElement.focus();
        nextInputElement.select();
        event.preventDefault();
        return;
    }
    if (
        !isCtrl(event) &&
        !event.shiftKey &&
        event.altKey &&
        event.key === "Enter"
    ) {
        const range = getEditorRange(vditor);
        // firefox 不会打断 link https://github.com/Vanessa219/vditor/issues/193
        element.insertAdjacentHTML("afterend", Constants.ZWSP);
        range.setStartAfter(element.nextSibling);
        range.collapse(true);
        setSelectionFocus(range);
        event.preventDefault();
    }
};

export const genAPopover = (vditor: IVditor, aElement: HTMLElement) => {
    vditor.wysiwyg.popover.innerHTML = "";

    const updateA = () => {
        if (input.value.trim() !== "") {
            aElement.innerHTML = input.value;
        }
        aElement.setAttribute("href", input1.value);
        aElement.setAttribute("title", input2.value);
        afterRenderEvent(vditor);
    };

    aElement.querySelectorAll("[data-marker]").forEach((item: HTMLElement) => {
        item.removeAttribute("data-marker");
    });
    const inputWrap = document.createElement("span");
    inputWrap.setAttribute("aria-label", window.VditorI18n.textIsNotEmpty);
    inputWrap.className = "vditor-tooltipped vditor-tooltipped__n";
    const input = document.createElement("input");
    inputWrap.appendChild(input);
    input.className = "vditor-input";
    input.setAttribute("placeholder", window.VditorI18n.textIsNotEmpty);
    input.style.width = "120px";
    input.value = aElement.innerHTML || "";
    input.oninput = () => {
        updateA();
    };
    input.onkeydown = (event) => {
        if (removeBlockElement(vditor, event)) {
            return;
        }
        linkHotkey(vditor, aElement, event, input1);
    };

    const input1Wrap = document.createElement("span");
    input1Wrap.setAttribute("aria-label", window.VditorI18n.link);
    input1Wrap.className = "vditor-tooltipped vditor-tooltipped__n";
    const input1 = document.createElement("input");
    input1Wrap.appendChild(input1);
    input1.className = "vditor-input";
    input1.setAttribute("placeholder", window.VditorI18n.link);
    input1.value = aElement.getAttribute("href") || "";
    input1.oninput = () => {
        updateA();
    };
    input1.onkeydown = (event) => {
        if (removeBlockElement(vditor, event)) {
            return;
        }
        linkHotkey(vditor, aElement, event, input2);
    };

    const input2Wrap = document.createElement("span");
    input2Wrap.setAttribute("aria-label", window.VditorI18n.tooltipText);
    input2Wrap.className = "vditor-tooltipped vditor-tooltipped__n";
    const input2 = document.createElement("input");
    input2Wrap.appendChild(input2);
    input2.className = "vditor-input";
    input2.setAttribute("placeholder", window.VditorI18n.tooltipText);
    input2.style.width = "60px";
    input2.value = aElement.getAttribute("title") || "";
    input2.oninput = () => {
        updateA();
    };
    input2.onkeydown = (event) => {
        if (removeBlockElement(vditor, event)) {
            return;
        }
        linkHotkey(vditor, aElement, event, input);
    };

    genClose(aElement, vditor);
    vditor.wysiwyg.popover.insertAdjacentElement("beforeend", inputWrap);
    vditor.wysiwyg.popover.insertAdjacentElement("beforeend", input1Wrap);
    vditor.wysiwyg.popover.insertAdjacentElement("beforeend", input2Wrap);
    setPopoverPosition(vditor, aElement);
};

export const genImagePopover = (event: Event, vditor: IVditor) => {
    const imgElement = event.target as HTMLImageElement;
    vditor.wysiwyg.popover.innerHTML = "";
    const updateImg = () => {
        imgElement.setAttribute("src", inputElement.value);
        imgElement.setAttribute("alt", alt.value);
        imgElement.setAttribute("title", title.value);
    };

    const inputWrap = document.createElement("span");
    inputWrap.setAttribute("aria-label", window.VditorI18n.imageURL);
    inputWrap.className = "vditor-tooltipped vditor-tooltipped__n";
    const inputElement = document.createElement("input");
    inputWrap.appendChild(inputElement);
    inputElement.className = "vditor-input";
    inputElement.setAttribute("placeholder", window.VditorI18n.imageURL);
    inputElement.value = imgElement.getAttribute("src") || "";
    inputElement.oninput = () => {
        updateImg();
    };
    inputElement.onkeydown = (elementEvent) => {
        removeBlockElement(vditor, elementEvent);
    };

    const altWrap = document.createElement("span");
    altWrap.setAttribute("aria-label", window.VditorI18n.alternateText);
    altWrap.className = "vditor-tooltipped vditor-tooltipped__n";
    const alt = document.createElement("input");
    altWrap.appendChild(alt);
    alt.className = "vditor-input";
    alt.setAttribute("placeholder", window.VditorI18n.alternateText);
    alt.style.width = "52px";
    alt.value = imgElement.getAttribute("alt") || "";
    alt.oninput = () => {
        updateImg();
    };
    alt.onkeydown = (elementEvent) => {
        removeBlockElement(vditor, elementEvent);
    };

    const titleWrap = document.createElement("span");
    titleWrap.setAttribute("aria-label", window.VditorI18n.title);
    titleWrap.className = "vditor-tooltipped vditor-tooltipped__n";
    const title = document.createElement("input");
    titleWrap.appendChild(title);
    title.className = "vditor-input";
    title.setAttribute("placeholder", window.VditorI18n.title);
    title.value = imgElement.getAttribute("title") || "";
    title.oninput = () => {
        updateImg();
    };
    title.onkeydown = (elementEvent) => {
        removeBlockElement(vditor, elementEvent);
    };
    genClose(imgElement, vditor);
    vditor.wysiwyg.popover.insertAdjacentElement("beforeend", inputWrap);
    vditor.wysiwyg.popover.insertAdjacentElement("beforeend", altWrap);
    vditor.wysiwyg.popover.insertAdjacentElement("beforeend", titleWrap);

    setPopoverPosition(vditor, imgElement);
};
