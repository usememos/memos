import * as DiffMatchPatch from "diff-match-patch";
import {disableToolbar, enableToolbar, hidePanel} from "../toolbar/setToolbar";
import {isFirefox, isSafari} from "../util/compatibility";
import {scrollCenter} from "../util/editorCommonEvent";
import {execAfterRender} from "../util/fixBrowserBehavior";
import {highlightToolbar} from "../util/highlightToolbar";
import {processCodeRender} from "../util/processCode";
import {setRangeByWbr, setSelectionFocus} from "../util/selection";
import {renderToc} from "../util/toc";

interface IUndo {
    hasUndo: boolean;
    lastText: string;
    redoStack: DiffMatchPatch.patch_obj[][];
    undoStack: DiffMatchPatch.patch_obj[][];
}

class Undo {
    private stackSize = 50;
    private dmp: DiffMatchPatch.diff_match_patch;
    private wysiwyg: IUndo;
    private ir: IUndo;
    private sv: IUndo;

    constructor() {
        this.resetStack();
        // @ts-ignore
        this.dmp = new DiffMatchPatch();
    }

    public clearStack(vditor: IVditor) {
        this.resetStack();
        this.resetIcon(vditor);
    }

    public resetIcon(vditor: IVditor) {
        if (!vditor.toolbar) {
            return;
        }

        if (this[vditor.currentMode].undoStack.length > 1) {
            enableToolbar(vditor.toolbar.elements, ["undo"]);
        } else {
            disableToolbar(vditor.toolbar.elements, ["undo"]);
        }

        if (this[vditor.currentMode].redoStack.length !== 0) {
            enableToolbar(vditor.toolbar.elements, ["redo"]);
        } else {
            disableToolbar(vditor.toolbar.elements, ["redo"]);
        }
    }

    public undo(vditor: IVditor) {
        if (vditor[vditor.currentMode].element.getAttribute("contenteditable") === "false") {
            return;
        }
        if (this[vditor.currentMode].undoStack.length < 2) {
            return;
        }
        const state = this[vditor.currentMode].undoStack.pop();
        if (!state) {
            return;
        }
        this[vditor.currentMode].redoStack.push(state);
        this.renderDiff(state, vditor);
        this[vditor.currentMode].hasUndo = true;
        // undo 操作后，需要关闭 hint
        hidePanel(vditor, ["hint"]);
    }

    public redo(vditor: IVditor) {
        if (vditor[vditor.currentMode].element.getAttribute("contenteditable") === "false") {
            return;
        }
        const state = this[vditor.currentMode].redoStack.pop();
        if (!state) {
            return;
        }
        this[vditor.currentMode].undoStack.push(state);
        this.renderDiff(state, vditor, true);
    }

    public recordFirstPosition(vditor: IVditor, event: KeyboardEvent) {
        if (getSelection().rangeCount === 0) {
            return;
        }
        if (this[vditor.currentMode].undoStack.length !== 1 || this[vditor.currentMode].undoStack[0].length === 0 ||
            this[vditor.currentMode].redoStack.length > 0) {
            return;
        }
        if (isFirefox() && event.key === "Backspace") {
            // Firefox 第一次删除无效
            return;
        }
        if (isSafari()) {
            // Safari keydown 在 input 之后，不需要重复记录历史
            return;
        }
        const text = this.addCaret(vditor);
        if (text.replace("<wbr>", "").replace(" vditor-ir__node--expand", "")
            !== this[vditor.currentMode].undoStack[0][0].diffs[0][1].replace("<wbr>", "")) {
            // 当还不没有存入 undo 栈时，按下 ctrl 后会覆盖 lastText
            return;
        }
        this[vditor.currentMode].undoStack[0][0].diffs[0][1] = text;
        this[vditor.currentMode].lastText = text;
        // 不能添加 setSelectionFocus(cloneRange); 否则 windows chrome 首次输入会烂
    }

    public addToUndoStack(vditor: IVditor) {
        // afterRenderEvent.ts 已经 debounce
        const text = this.addCaret(vditor, true);
        const diff = this.dmp.diff_main(text, this[vditor.currentMode].lastText, true);
        const patchList = this.dmp.patch_make(text, this[vditor.currentMode].lastText, diff);
        if (patchList.length === 0 && this[vditor.currentMode].undoStack.length > 0) {
            return;
        }
        this[vditor.currentMode].lastText = text;
        this[vditor.currentMode].undoStack.push(patchList);
        if (this[vditor.currentMode].undoStack.length > this.stackSize) {
            this[vditor.currentMode].undoStack.shift();
        }
        if (this[vditor.currentMode].hasUndo) {
            this[vditor.currentMode].redoStack = [];
            this[vditor.currentMode].hasUndo = false;
            disableToolbar(vditor.toolbar.elements, ["redo"]);
        }

        if (this[vditor.currentMode].undoStack.length > 1) {
            enableToolbar(vditor.toolbar.elements, ["undo"]);
        }
    }

    private renderDiff(state: DiffMatchPatch.patch_obj[], vditor: IVditor, isRedo: boolean = false) {
        let text;
        if (isRedo) {
            const redoPatchList = this.dmp.patch_deepCopy(state).reverse();
            redoPatchList.forEach((patch) => {
                patch.diffs.forEach((diff) => {
                    diff[0] = -diff[0];
                });
            });
            text = this.dmp.patch_apply(redoPatchList, this[vditor.currentMode].lastText)[0];
        } else {
            text = this.dmp.patch_apply(state, this[vditor.currentMode].lastText)[0];
        }

        this[vditor.currentMode].lastText = text;
        vditor[vditor.currentMode].element.innerHTML = text;
        if (vditor.currentMode !== "sv") {
            vditor[vditor.currentMode].element.querySelectorAll(`.vditor-${vditor.currentMode}__preview[data-render='2']`)
                .forEach((blockElement: HTMLElement) => {
                    processCodeRender(blockElement, vditor);
                });
        }

        if (!vditor[vditor.currentMode].element.querySelector("wbr")) {
            // Safari 第一次输入没有光标，需手动定位到结尾
            const range = getSelection().getRangeAt(0);
            range.setEndBefore(vditor[vditor.currentMode].element);
            range.collapse(false);
        } else {
            setRangeByWbr(
                vditor[vditor.currentMode].element, vditor[vditor.currentMode].element.ownerDocument.createRange());
            scrollCenter(vditor);
        }

        renderToc(vditor);

        execAfterRender(vditor, {
            enableAddUndoStack: false,
            enableHint: false,
            enableInput: true,
        });
        highlightToolbar(vditor);

        vditor[vditor.currentMode].element.querySelectorAll(`.vditor-${vditor.currentMode}__preview[data-render='2']`)
            .forEach((item: HTMLElement) => {
                processCodeRender(item, vditor);
            });

        if (this[vditor.currentMode].undoStack.length > 1) {
            enableToolbar(vditor.toolbar.elements, ["undo"]);
        } else {
            disableToolbar(vditor.toolbar.elements, ["undo"]);
        }

        if (this[vditor.currentMode].redoStack.length !== 0) {
            enableToolbar(vditor.toolbar.elements, ["redo"]);
        } else {
            disableToolbar(vditor.toolbar.elements, ["redo"]);
        }
    }

    private resetStack() {
        this.ir = {
            hasUndo: false,
            lastText: "",
            redoStack: [],
            undoStack: [],
        };
        this.sv = {
            hasUndo: false,
            lastText: "",
            redoStack: [],
            undoStack: [],
        };
        this.wysiwyg = {
            hasUndo: false,
            lastText: "",
            redoStack: [],
            undoStack: [],
        };
    }

    private addCaret(vditor: IVditor, setFocus = false) {
        let cloneRange: Range;
        if (getSelection().rangeCount !== 0 && !vditor[vditor.currentMode].element.querySelector("wbr")) {
            const range = getSelection().getRangeAt(0);
            if (vditor[vditor.currentMode].element.contains(range.startContainer)) {
                cloneRange = range.cloneRange();
                const wbrElement = document.createElement("span");
                wbrElement.className = "vditor-wbr";
                range.insertNode(wbrElement);
            }
        }
        // 移除数学公式、echart 渲染 https://github.com/siyuan-note/siyuan/issues/537
        const cloneElement = vditor.ir.element.cloneNode(true) as HTMLElement;
        cloneElement.querySelectorAll(`.vditor-${vditor.currentMode}__preview[data-render='1']`)
            .forEach((item: HTMLElement) => {
                if (item.firstElementChild.classList.contains("language-echarts") ||
                item.firstElementChild.classList.contains("language-plantuml") ||
                    item.firstElementChild.classList.contains("language-mindmap")) {
                    item.firstElementChild.removeAttribute("_echarts_instance_");
                    item.firstElementChild.removeAttribute("data-processed");
                    item.firstElementChild.innerHTML = item.previousElementSibling.firstElementChild.innerHTML;
                    item.setAttribute("data-render", "2");
                }
                if (item.firstElementChild.classList.contains("language-math")) {
                    item.setAttribute("data-render", "2");
                    item.firstElementChild.textContent = item.firstElementChild.getAttribute("data-math");
                    item.firstElementChild.removeAttribute("data-math");
                }
            });
        const text = vditor[vditor.currentMode].element.innerHTML;
        vditor[vditor.currentMode].element.querySelectorAll(".vditor-wbr").forEach((item) => {
            item.remove();
            // 使用 item.outerHTML = "" 会产生 https://github.com/Vanessa219/vditor/pull/686;
        });
        if (setFocus && cloneRange) {
            setSelectionFocus(cloneRange);
        }
        return text.replace('<span class="vditor-wbr"></span>', "<wbr>");
    }
}

export {Undo};
