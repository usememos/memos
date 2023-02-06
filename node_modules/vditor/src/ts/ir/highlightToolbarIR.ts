import {Constants} from "../constants";
import {disableToolbar, enableToolbar, removeCurrentToolbar, setCurrentToolbar} from "../toolbar/setToolbar";
import {hasClosestByAttribute, hasClosestByMatchTag} from "../util/hasClosest";
import {hasClosestByHeadings} from "../util/hasClosestByHeadings";
import {getEditorRange, selectIsEditor} from "../util/selection";

export const highlightToolbarIR = (vditor: IVditor) => {
    clearTimeout(vditor[vditor.currentMode].hlToolbarTimeoutId);
    vditor[vditor.currentMode].hlToolbarTimeoutId = window.setTimeout(() => {
        if (vditor[vditor.currentMode].element.getAttribute("contenteditable") === "false") {
            return;
        }
        if (!selectIsEditor(vditor[vditor.currentMode].element)) {
            return;
        }

        removeCurrentToolbar(vditor.toolbar.elements, Constants.EDIT_TOOLBARS);
        enableToolbar(vditor.toolbar.elements, Constants.EDIT_TOOLBARS);

        const range = getEditorRange(vditor);
        let typeElement = range.startContainer as HTMLElement;
        if (range.startContainer.nodeType === 3) {
            typeElement = range.startContainer.parentElement;
        }
        if (typeElement.classList.contains("vditor-reset")) {
            typeElement = typeElement.childNodes[range.startOffset] as HTMLElement;
        }

        const headingElement = vditor.currentMode === "sv" ?
            hasClosestByAttribute(typeElement, "data-type", "heading") : hasClosestByHeadings(typeElement);
        if (headingElement) {
            setCurrentToolbar(vditor.toolbar.elements, ["headings"]);
        }

        const quoteElement =
            vditor.currentMode === "sv" ? hasClosestByAttribute(typeElement, "data-type", "blockquote") :
                hasClosestByMatchTag(typeElement, "BLOCKQUOTE");
        if (quoteElement) {
            setCurrentToolbar(vditor.toolbar.elements, ["quote"]);
        }

        const strongElement = hasClosestByAttribute(typeElement, "data-type", "strong");
        if (strongElement) {
            setCurrentToolbar(vditor.toolbar.elements, ["bold"]);
        }

        const emElement = hasClosestByAttribute(typeElement, "data-type", "em");
        if (emElement) {
            setCurrentToolbar(vditor.toolbar.elements, ["italic"]);
        }

        const sElement = hasClosestByAttribute(typeElement, "data-type", "s");
        if (sElement) {
            setCurrentToolbar(vditor.toolbar.elements, ["strike"]);
        }

        const aElement = hasClosestByAttribute(typeElement, "data-type", "a");
        if (aElement) {
            setCurrentToolbar(vditor.toolbar.elements, ["link"]);
        }

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

        const codeBlockElement = hasClosestByAttribute(typeElement, "data-type", "code-block");
        if (codeBlockElement) {
            disableToolbar(vditor.toolbar.elements, ["headings", "bold", "italic", "strike", "line", "quote",
                "list", "ordered-list", "check", "code", "inline-code", "upload", "link", "table", "record"]);
            setCurrentToolbar(vditor.toolbar.elements, ["code"]);
        }

        const codeElement = hasClosestByAttribute(typeElement, "data-type", "code");
        if (codeElement) {
            disableToolbar(vditor.toolbar.elements, ["headings", "bold", "italic", "strike", "line", "quote",
                "list", "ordered-list", "check", "code", "upload", "link", "table", "record"]);
            setCurrentToolbar(vditor.toolbar.elements, ["inline-code"]);
        }

        const tableElement = hasClosestByAttribute(typeElement, "data-type", "table");
        if (tableElement) {
            disableToolbar(vditor.toolbar.elements, ["headings", "list", "ordered-list", "check", "line",
                "quote", "code", "table"]);
        }

    }, 200);
};
