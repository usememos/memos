import {Constants} from "../constants";
import {processToolbar} from "../ir/process";
import {processToolbar as processToolbarSV} from "../sv/process";
import {getEventName} from "../util/compatibility";
import {updateHotkeyTip} from "../util/compatibility";
import {toolbarEvent} from "../wysiwyg/toolbarEvent";

export class MenuItem {
    public element: HTMLElement;

    constructor(vditor: IVditor, menuItem: IMenuItem) {
        this.element = document.createElement("div");
        if (menuItem.className) {
            this.element.classList.add(...menuItem.className.split(" "));
        }

        let hotkey = menuItem.hotkey ? ` <${updateHotkeyTip(menuItem.hotkey)}>` : "";
        if (menuItem.level === 2) {
            hotkey = menuItem.hotkey ? ` &lt;${updateHotkeyTip(menuItem.hotkey)}&gt;` : "";
        }
        const tip = menuItem.tip ? menuItem.tip + hotkey : `${window.VditorI18n[menuItem.name]}${hotkey}`;
        const tagName = menuItem.name === "upload" ? "div" : "button";
        if (menuItem.level === 2) {
            this.element.innerHTML = `<${tagName} data-type="${menuItem.name}">${tip}</${tagName}>`;
        } else {
            this.element.classList.add("vditor-toolbar__item");
            const iconElement = document.createElement(tagName);
            iconElement.setAttribute("data-type", menuItem.name);
            iconElement.className = `vditor-tooltipped vditor-tooltipped__${menuItem.tipPosition}`;
            iconElement.setAttribute("aria-label", tip);
            iconElement.innerHTML = menuItem.icon;
            this.element.appendChild(iconElement);
        }

        if (!menuItem.prefix) {
            return;
        }
        this.element.children[0].addEventListener(getEventName(), (event) => {
            event.preventDefault();
            if (this.element.firstElementChild.classList.contains(Constants.CLASS_MENU_DISABLED)) {
                return;
            }
            if (vditor.currentMode === "wysiwyg") {
                toolbarEvent(vditor, this.element.children[0], event);
            } else if (vditor.currentMode === "ir") {
                processToolbar(vditor, this.element.children[0],
                    menuItem.prefix || "", menuItem.suffix || "");
            } else {
                processToolbarSV(vditor, this.element.children[0],
                    menuItem.prefix || "", menuItem.suffix || "");
            }
        });
    }
}
