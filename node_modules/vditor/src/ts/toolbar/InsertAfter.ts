import {Constants} from "../constants";
import {getEventName} from "../util/compatibility";
import {insertEmptyBlock} from "../util/fixBrowserBehavior";
import {MenuItem} from "./MenuItem";

export class InsertAfter extends MenuItem {
    constructor(vditor: IVditor, menuItem: IMenuItem) {
        super(vditor, menuItem);
        this.element.children[0].addEventListener(getEventName(), (event) => {
            event.preventDefault();
            if (this.element.firstElementChild.classList.contains(Constants.CLASS_MENU_DISABLED) ||
                vditor.currentMode === "sv") {
                return;
            }
            insertEmptyBlock(vditor, "afterend");
        });
    }
}
