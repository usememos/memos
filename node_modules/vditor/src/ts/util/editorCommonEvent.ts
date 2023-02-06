import {Constants} from "../constants";
import {processHeading} from "../ir/process";
import {processKeydown as irProcessKeydown} from "../ir/processKeydown";
import {getMarkdown} from "../markdown/getMarkdown";
import {previewImage} from "../preview/image";
import {processHeading as processHeadingSV} from "../sv/process";
import {processKeydown as mdProcessKeydown} from "../sv/processKeydown";
import {setEditMode} from "../toolbar/EditMode";
import {hidePanel} from "../toolbar/setToolbar";
import {afterRenderEvent} from "../wysiwyg/afterRenderEvent";
import {processKeydown} from "../wysiwyg/processKeydown";
import {removeHeading, setHeading} from "../wysiwyg/setHeading";
import {getEventName, isCtrl} from "./compatibility";
import {execAfterRender, paste} from "./fixBrowserBehavior";
import {getSelectText} from "./getSelectText";
import {hasClosestByAttribute, hasClosestByMatchTag} from "./hasClosest";
import {matchHotKey} from "./hotKey";
import {getCursorPosition, getEditorRange} from "./selection";

export const focusEvent = (vditor: IVditor, editorElement: HTMLElement) => {
    editorElement.addEventListener("focus", () => {
        if (vditor.options.focus) {
            vditor.options.focus(getMarkdown(vditor));
        }
        hidePanel(vditor, ["subToolbar", "hint"]);
    });
};

export const dblclickEvent = (vditor: IVditor, editorElement: HTMLElement) => {
    editorElement.addEventListener("dblclick", (event: MouseEvent & { target: HTMLElement }) => {
        if (event.target.tagName === "IMG") {
            if (vditor.options.image.preview) {
                vditor.options.image.preview(event.target);
            } else if (vditor.options.image.isPreview) {
                previewImage(event.target as HTMLImageElement, vditor.options.lang, vditor.options.theme);
            }
        }
    });
};

export const blurEvent = (vditor: IVditor, editorElement: HTMLElement) => {
    editorElement.addEventListener("blur", (event) => {
        if (vditor.currentMode === "ir") {
            const expandElement = vditor.ir.element.querySelector(".vditor-ir__node--expand");
            if (expandElement) {
                expandElement.classList.remove("vditor-ir__node--expand");
            }
        } else if (vditor.currentMode === "wysiwyg" &&
            !vditor.wysiwyg.selectPopover.contains(event.relatedTarget as HTMLElement)) {
            vditor.wysiwyg.hideComment();
        }
        vditor[vditor.currentMode].range = getEditorRange(vditor);
        if (vditor.options.blur) {
            vditor.options.blur(getMarkdown(vditor));
        }
    });
};

export const dropEvent = (vditor: IVditor, editorElement: HTMLElement) => {
    editorElement.addEventListener("dragstart", (event) => {
        // 选中编辑器中的文字进行拖拽
        event.dataTransfer.setData(Constants.DROP_EDITOR, Constants.DROP_EDITOR);
    });
    editorElement.addEventListener("drop",
        (event: ClipboardEvent & { dataTransfer?: DataTransfer, target: HTMLElement }) => {
            if (event.dataTransfer.getData(Constants.DROP_EDITOR)) {
                // 编辑器内选中文字拖拽
                execAfterRender(vditor);
            } else if (event.dataTransfer.types.includes("Files") || event.dataTransfer.types.includes("text/html")) {
                // 外部文件拖入编辑器中或者编辑器内选中文字拖拽
                paste(vditor, event, {
                    pasteCode: (code: string) => {
                        document.execCommand("insertHTML", false, code);
                    },
                });
            }
        });
};

export const copyEvent =
    (vditor: IVditor, editorElement: HTMLElement, copy: (event: ClipboardEvent, vditor: IVditor) => void) => {
        editorElement.addEventListener("copy", (event: ClipboardEvent) => copy(event, vditor));
    };

export const cutEvent =
    (vditor: IVditor, editorElement: HTMLElement, copy: (event: ClipboardEvent, vditor: IVditor) => void) => {
        editorElement.addEventListener("cut", (event: ClipboardEvent) => {
            copy(event, vditor);
            // 获取 comment
            if (vditor.options.comment.enable && vditor.currentMode === "wysiwyg") {
                vditor.wysiwyg.getComments(vditor);
            }
            document.execCommand("delete");
        });
    };

export const scrollCenter = (vditor: IVditor) => {
    if (vditor.currentMode === "wysiwyg" && vditor.options.comment.enable) {
        vditor.options.comment.adjustTop(vditor.wysiwyg.getComments(vditor, true));
    }
    if (!vditor.options.typewriterMode) {
        return;
    }
    const editorElement = vditor[vditor.currentMode].element;
    const cursorTop = getCursorPosition(editorElement).top;
    if (vditor.options.height === "auto" && !vditor.element.classList.contains("vditor--fullscreen")) {
        window.scrollTo(window.scrollX,
            cursorTop + vditor.element.offsetTop + vditor.toolbar.element.offsetHeight - window.innerHeight / 2 + 10);
    }
    if (vditor.options.height !== "auto" || vditor.element.classList.contains("vditor--fullscreen")) {
        editorElement.scrollTop = cursorTop + editorElement.scrollTop - editorElement.clientHeight / 2 + 10;
    }
};

export const hotkeyEvent = (vditor: IVditor, editorElement: HTMLElement) => {
    editorElement.addEventListener("keydown", (event: KeyboardEvent & { target: HTMLElement }) => {
        // hint: 上下选择
        if ((vditor.options.hint.extend.length > 1 || vditor.toolbar.elements.emoji) &&
            vditor.hint.select(event, vditor)) {
            return;
        }

        // 重置 comment
        if (vditor.options.comment.enable && vditor.currentMode === "wysiwyg" &&
            (event.key === "Backspace" || matchHotKey("⌘X", event))) {
            vditor.wysiwyg.getComments(vditor);
        }

        if (vditor.currentMode === "sv") {
            if (mdProcessKeydown(vditor, event)) {
                return;
            }
        } else if (vditor.currentMode === "wysiwyg") {
            if (processKeydown(vditor, event)) {
                return;
            }
        } else if (vditor.currentMode === "ir") {
            if (irProcessKeydown(vditor, event)) {
                return;
            }
        }

        if (vditor.options.ctrlEnter && matchHotKey("⌘Enter", event)) {
            vditor.options.ctrlEnter(getMarkdown(vditor));
            event.preventDefault();
            return;
        }

        // undo
        if (matchHotKey("⌘Z", event) && !vditor.toolbar.elements.undo) {
            vditor.undo.undo(vditor);
            event.preventDefault();
            return;
        }

        // redo
        if (matchHotKey("⌘Y", event) && !vditor.toolbar.elements.redo) {
            vditor.undo.redo(vditor);
            event.preventDefault();
            return;
        }

        // esc
        if (event.key === "Escape") {
            if (vditor.hint.element.style.display === "block") {
                vditor.hint.element.style.display = "none";
            } else if (vditor.options.esc && !event.isComposing) {
                vditor.options.esc(getMarkdown(vditor));
            }
            event.preventDefault();
            return;
        }

        // h1 - h6 hotkey
        if (isCtrl(event) && event.altKey && !event.shiftKey && /^Digit[1-6]$/.test(event.code)) {
            if (vditor.currentMode === "wysiwyg") {
                const tagName = event.code.replace("Digit", "H");
                if (hasClosestByMatchTag(getSelection().getRangeAt(0).startContainer, tagName)) {
                    removeHeading(vditor);
                } else {
                    setHeading(vditor, tagName);
                }
                afterRenderEvent(vditor);
            } else if (vditor.currentMode === "sv") {
                processHeadingSV(vditor, "#".repeat(parseInt(event.code.replace("Digit", ""), 10)) + " ");
            } else if (vditor.currentMode === "ir") {
                processHeading(vditor, "#".repeat(parseInt(event.code.replace("Digit", ""), 10)) + " ");
            }
            event.preventDefault();
            return true;
        }

        // toggle edit mode
        if (isCtrl(event) && event.altKey && !event.shiftKey && /^Digit[7-9]$/.test(event.code)) {
            if (event.code === "Digit7") {
                setEditMode(vditor, "wysiwyg", event);
            } else if (event.code === "Digit8") {
                setEditMode(vditor, "ir", event);
            } else if (event.code === "Digit9") {
                setEditMode(vditor, "sv", event);
            }
            return true;
        }

        // toolbar action
        vditor.options.toolbar.find((menuItem: IMenuItem) => {
            if (!menuItem.hotkey || menuItem.toolbar) {
                if (menuItem.toolbar) {
                    const sub = menuItem.toolbar.find((subMenuItem: IMenuItem) => {
                        if (!subMenuItem.hotkey) {
                            return false;
                        }
                        if (matchHotKey(subMenuItem.hotkey, event)) {
                            vditor.toolbar.elements[subMenuItem.name].children[0]
                                .dispatchEvent(new CustomEvent(getEventName()));
                            event.preventDefault();
                            return true;
                        }
                    });
                    return sub ? true : false;
                }
                return false;
            }
            if (matchHotKey(menuItem.hotkey, event)) {
                vditor.toolbar.elements[menuItem.name].children[0].dispatchEvent(new CustomEvent(getEventName()));
                event.preventDefault();
                return true;
            }
        });
    });
};

export const selectEvent = (vditor: IVditor, editorElement: HTMLElement) => {
    editorElement.addEventListener("selectstart", (event: Event & { target: HTMLElement }) => {
        editorElement.onmouseup = () => {
            setTimeout(() => { // 鼠标放开后 range 没有即时更新
                const selectText = getSelectText(vditor[vditor.currentMode].element);
                if (selectText.trim()) {
                    if (vditor.currentMode === "wysiwyg" && vditor.options.comment.enable) {
                        if (!hasClosestByAttribute(event.target, "data-type", "footnotes-block") &&
                            !hasClosestByAttribute(event.target, "data-type", "link-ref-defs-block")) {
                            vditor.wysiwyg.showComment();
                        } else {
                            vditor.wysiwyg.hideComment();
                        }
                    }
                    if (vditor.options.select) {
                        vditor.options.select(selectText);
                    }
                } else {
                    if (vditor.currentMode === "wysiwyg" && vditor.options.comment.enable) {
                        vditor.wysiwyg.hideComment();
                    }
                }
            });
        };
    });
};
