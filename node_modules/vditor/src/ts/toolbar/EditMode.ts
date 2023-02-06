import {Constants} from "../constants";
import {processAfterRender} from "../ir/process";
import {getMarkdown} from "../markdown/getMarkdown";
import {mathRender} from "../markdown/mathRender";
import {processAfterRender as processSVAfterRender, processSpinVditorSVDOM} from "../sv/process";
import {setPadding, setTypewriterPosition} from "../ui/initUI";
import {getEventName, updateHotkeyTip} from "../util/compatibility";
import {highlightToolbar} from "../util/highlightToolbar";
import {processCodeRender} from "../util/processCode";
import {renderToc} from "../util/toc";
import {renderDomByMd} from "../wysiwyg/renderDomByMd";
import {MenuItem} from "./MenuItem";
import {
    disableToolbar,
    enableToolbar,
    hidePanel,
    hideToolbar,
    removeCurrentToolbar,
    showToolbar, toggleSubMenu,
} from "./setToolbar";

export const setEditMode = (vditor: IVditor, type: string, event: Event | string) => {
    let markdownText;
    if (typeof event !== "string") {
        hidePanel(vditor, ["subToolbar", "hint"]);
        event.preventDefault();
        markdownText = getMarkdown(vditor);
    } else {
        markdownText = event;
    }
    if (vditor.currentMode === type && typeof event !== "string") {
        return;
    }
    if (vditor.devtools) {
        vditor.devtools.renderEchart(vditor);
    }
    if (vditor.options.preview.mode === "both" && type === "sv") {
        vditor.preview.element.style.display = "block";
    } else {
        vditor.preview.element.style.display = "none";
    }

    enableToolbar(vditor.toolbar.elements, Constants.EDIT_TOOLBARS);
    removeCurrentToolbar(vditor.toolbar.elements, Constants.EDIT_TOOLBARS);
    disableToolbar(vditor.toolbar.elements, ["outdent", "indent"]);

    if (type === "ir") {
        hideToolbar(vditor.toolbar.elements, ["both"]);
        showToolbar(vditor.toolbar.elements, ["outdent", "indent", "outline", "insert-before", "insert-after"]);
        vditor.sv.element.style.display = "none";
        vditor.wysiwyg.element.parentElement.style.display = "none";
        vditor.ir.element.parentElement.style.display = "block";

        vditor.lute.SetVditorIR(true);
        vditor.lute.SetVditorWYSIWYG(false);
        vditor.lute.SetVditorSV(false);

        vditor.currentMode = "ir";
        vditor.ir.element.innerHTML = vditor.lute.Md2VditorIRDOM(markdownText);
        processAfterRender(vditor, {
            enableAddUndoStack: true,
            enableHint: false,
            enableInput: false,
        });

        setPadding(vditor);

        vditor.ir.element.querySelectorAll(".vditor-ir__preview[data-render='2']").forEach((item: HTMLElement) => {
            processCodeRender(item, vditor);
        });
        vditor.ir.element.querySelectorAll(".vditor-toc").forEach((item: HTMLElement) => {
            mathRender(item, {
                cdn: vditor.options.cdn,
                math: vditor.options.preview.math,
            });
        });
    } else if (type === "wysiwyg") {
        hideToolbar(vditor.toolbar.elements, ["both"]);
        showToolbar(vditor.toolbar.elements, ["outdent", "indent", "outline", "insert-before", "insert-after"]);
        vditor.sv.element.style.display = "none";
        vditor.wysiwyg.element.parentElement.style.display = "block";
        vditor.ir.element.parentElement.style.display = "none";

        vditor.lute.SetVditorIR(false);
        vditor.lute.SetVditorWYSIWYG(true);
        vditor.lute.SetVditorSV(false);

        vditor.currentMode = "wysiwyg";

        setPadding(vditor);
        renderDomByMd(vditor, markdownText, {
            enableAddUndoStack: true,
            enableHint: false,
            enableInput: false,
        });
        vditor.wysiwyg.element.querySelectorAll(".vditor-toc").forEach((item: HTMLElement) => {
            mathRender(item, {
                cdn: vditor.options.cdn,
                math: vditor.options.preview.math,
            });
        });
        vditor.wysiwyg.popover.style.display = "none";
    } else if (type === "sv") {
        showToolbar(vditor.toolbar.elements, ["both"]);
        hideToolbar(vditor.toolbar.elements, ["outdent", "indent", "outline", "insert-before", "insert-after"]);
        vditor.wysiwyg.element.parentElement.style.display = "none";
        vditor.ir.element.parentElement.style.display = "none";
        if (vditor.options.preview.mode === "both") {
            vditor.sv.element.style.display = "block";
        } else if (vditor.options.preview.mode === "editor") {
            vditor.sv.element.style.display = "block";
        }

        vditor.lute.SetVditorIR(false);
        vditor.lute.SetVditorWYSIWYG(false);
        vditor.lute.SetVditorSV(true);

        vditor.currentMode = "sv";
        let svHTML = processSpinVditorSVDOM(markdownText, vditor);
        if (svHTML === "<div data-block='0'></div>") {
            // https://github.com/Vanessa219/vditor/issues/654 SV 模式 Placeholder 显示问题
            svHTML = "";
        }
        vditor.sv.element.innerHTML = svHTML;
        processSVAfterRender(vditor, {
            enableAddUndoStack: true,
            enableHint: false,
            enableInput: false,
        });
        setPadding(vditor);
    }
    vditor.undo.resetIcon(vditor);
    if (typeof event !== "string") {
        // 初始化不 focus
        vditor[vditor.currentMode].element.focus();
        highlightToolbar(vditor);
    }
    renderToc(vditor);
    setTypewriterPosition(vditor);

    if (vditor.toolbar.elements["edit-mode"]) {
        vditor.toolbar.elements["edit-mode"].querySelectorAll("button").forEach((item) => {
            item.classList.remove("vditor-menu--current");
        });
        vditor.toolbar.elements["edit-mode"].querySelector(`button[data-mode="${vditor.currentMode}"]`).classList.add("vditor-menu--current");
    }

    vditor.outline.toggle(vditor, vditor.currentMode !== "sv" && vditor.options.outline.enable, typeof event !== "string");
};

export class EditMode extends MenuItem {
    public element: HTMLElement;

    constructor(vditor: IVditor, menuItem: IMenuItem) {
        super(vditor, menuItem);

        const panelElement = document.createElement("div");
        panelElement.className = `vditor-hint${menuItem.level === 2 ? "" : " vditor-panel--arrow"}`;
        panelElement.innerHTML = `<button data-mode="wysiwyg">${window.VditorI18n.wysiwyg} &lt;${updateHotkeyTip("⌥⌘7")}></button>
<button data-mode="ir">${window.VditorI18n.instantRendering} &lt;${updateHotkeyTip("⌥⌘8")}></button>
<button data-mode="sv">${window.VditorI18n.splitView} &lt;${updateHotkeyTip("⌥⌘9")}></button>`;

        this.element.appendChild(panelElement);

        this._bindEvent(vditor, panelElement, menuItem);
    }

    public _bindEvent(vditor: IVditor, panelElement: HTMLElement, menuItem: IMenuItem) {
        const actionBtn = this.element.children[0] as HTMLElement;
        toggleSubMenu(vditor, panelElement, actionBtn, menuItem.level);

        panelElement.children.item(0).addEventListener(getEventName(), (event: Event) => {
            // wysiwyg
            setEditMode(vditor, "wysiwyg", event);
            event.preventDefault();
            event.stopPropagation();
        });

        panelElement.children.item(1).addEventListener(getEventName(), (event: Event) => {
            // ir
            setEditMode(vditor, "ir", event);
            event.preventDefault();
            event.stopPropagation();
        });

        panelElement.children.item(2).addEventListener(getEventName(), (event: Event) => {
            // markdown
            setEditMode(vditor, "sv", event);
            event.preventDefault();
            event.stopPropagation();
        });
    }
}
