import {Constants} from "../constants";
import {getEventName} from "../util/compatibility";

export const removeCurrentToolbar = (toolbar: { [key: string]: HTMLElement }, names: string[]) => {
    names.forEach((name) => {
        if (!toolbar[name]) {
            return;
        }
        const itemElement = toolbar[name].children[0];
        if (itemElement && itemElement.classList.contains("vditor-menu--current")) {
            itemElement.classList.remove("vditor-menu--current");
        }
    });
};

export const setCurrentToolbar = (toolbar: { [key: string]: HTMLElement }, names: string[]) => {
    names.forEach((name) => {
        if (!toolbar[name]) {
            return;
        }
        const itemElement = toolbar[name].children[0];
        if (itemElement && !itemElement.classList.contains("vditor-menu--current")) {
            itemElement.classList.add("vditor-menu--current");
        }
    });
};

export const enableToolbar = (toolbar: { [key: string]: HTMLElement }, names: string[]) => {
    names.forEach((name) => {
        if (!toolbar[name]) {
            return;
        }
        const itemElement = toolbar[name].children[0];
        if (itemElement && itemElement.classList.contains(Constants.CLASS_MENU_DISABLED)) {
            itemElement.classList.remove(Constants.CLASS_MENU_DISABLED);
        }
    });
};

export const disableToolbar = (toolbar: { [key: string]: HTMLElement }, names: string[]) => {
    names.forEach((name) => {
        if (!toolbar[name]) {
            return;
        }
        const itemElement = toolbar[name].children[0];
        if (itemElement && !itemElement.classList.contains(Constants.CLASS_MENU_DISABLED)) {
            itemElement.classList.add(Constants.CLASS_MENU_DISABLED);
        }
    });
};

export const hideToolbar = (toolbar: { [key: string]: HTMLElement }, names: string[]) => {
    names.forEach((name) => {
        if (!toolbar[name]) {
            return;
        }
        if (toolbar[name]) {
            toolbar[name].style.display = "none";
        }
    });
};

export const showToolbar = (toolbar: { [key: string]: HTMLElement }, names: string[]) => {
    names.forEach((name) => {
        if (!toolbar[name]) {
            return;
        }
        if (toolbar[name]) {
            toolbar[name].style.display = "block";
        }
    });
};

// "subToolbar", "hint", "popover"
export const hidePanel = (vditor: IVditor, panels: string[], exceptElement?: HTMLElement) => {
    if (panels.includes("subToolbar")) {
        vditor.toolbar.element.querySelectorAll(".vditor-hint").forEach((item: HTMLElement) => {
            if (exceptElement && item.isEqualNode(exceptElement)) {
                return;
            }
            item.style.display = "none";
        });
        if (vditor.toolbar.elements.emoji) {
            (vditor.toolbar.elements.emoji.lastElementChild as HTMLElement).style.display = "none";
        }
    }
    if (panels.includes("hint")) {
        vditor.hint.element.style.display = "none";
    }
    if (vditor.wysiwyg.popover && panels.includes("popover")) {
        vditor.wysiwyg.popover.style.display = "none";
    }
};

export const toggleSubMenu = (vditor: IVditor, panelElement: HTMLElement, actionBtn: Element, level: number) => {
    actionBtn.addEventListener(getEventName(), (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (actionBtn.classList.contains(Constants.CLASS_MENU_DISABLED)) {
            return;
        }
        vditor.toolbar.element.querySelectorAll(".vditor-hint--current").forEach((item) => {
            item.classList.remove("vditor-hint--current");
        });
        if (panelElement.style.display === "block") {
            panelElement.style.display = "none";
        } else {
            hidePanel(vditor, ["subToolbar", "hint", "popover"], actionBtn.parentElement.parentElement);
            if (!actionBtn.classList.contains("vditor-tooltipped")) {
                actionBtn.classList.add("vditor-hint--current");
            }
            panelElement.style.display = "block";
            if (vditor.toolbar.element.getBoundingClientRect().right - actionBtn.getBoundingClientRect().right < 250) {
                panelElement.classList.add("vditor-panel--left");
            } else {
                panelElement.classList.remove("vditor-panel--left");
            }
        }
    });
};
