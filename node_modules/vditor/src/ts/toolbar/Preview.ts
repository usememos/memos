import {Constants} from "../constants";
import {setPadding} from "../ui/initUI";
import {getEventName} from "../util/compatibility";
import {MenuItem} from "./MenuItem";
import {disableToolbar, enableToolbar, hidePanel} from "./setToolbar";

export class Preview extends MenuItem {
    constructor(vditor: IVditor, menuItem: IMenuItem) {
        super(vditor, menuItem);
        this._bindEvent(vditor);
    }

    public _bindEvent(vditor: IVditor) {
        this.element.children[0].addEventListener(getEventName(), (event) => {
            event.preventDefault();
            const btnElement = this.element.firstElementChild;
            if (btnElement.classList.contains(Constants.CLASS_MENU_DISABLED)) {
                return;
            }

            const toolbars = Constants.EDIT_TOOLBARS.concat(["both", "edit-mode", "devtools"]);
            if (btnElement.classList.contains("vditor-menu--current")) {
                btnElement.classList.remove("vditor-menu--current");
                if (vditor.currentMode === "sv") {
                    vditor.sv.element.style.display = "block";
                    if (vditor.options.preview.mode === "both") {
                        vditor.preview.element.style.display = "block";
                    } else {
                        vditor.preview.element.style.display = "none";
                    }
                } else {
                    vditor[vditor.currentMode].element.parentElement.style.display = "block";
                    vditor.preview.element.style.display = "none";
                }
                enableToolbar(vditor.toolbar.elements, toolbars);
                vditor.outline.render(vditor);
            } else {
                disableToolbar(vditor.toolbar.elements, toolbars);
                vditor.preview.element.style.display = "block";
                if (vditor.currentMode === "sv") {
                    vditor.sv.element.style.display = "none";
                } else {
                    vditor[vditor.currentMode].element.parentElement.style.display = "none";
                }
                vditor.preview.render(vditor);
                btnElement.classList.add("vditor-menu--current");
                hidePanel(vditor, ["subToolbar", "hint", "popover"]);
                setTimeout(() => {
                    vditor.outline.render(vditor);
                }, vditor.options.preview.delay + 10);
            }
            setPadding(vditor);
        });
    }
}
