import {setPadding, setTypewriterPosition} from "../ui/initUI";
import {getEventName} from "../util/compatibility";
import {MenuItem} from "./MenuItem";

export class Fullscreen extends MenuItem {
    constructor(vditor: IVditor, menuItem: IMenuItem) {
        super(vditor, menuItem);
        this._bindEvent(vditor, menuItem);
    }

    public _bindEvent(vditor: IVditor, menuItem: IMenuItem) {
        this.element.children[0].addEventListener(getEventName(), function(event) {
            event.preventDefault();
            if (vditor.element.className.includes("vditor--fullscreen")) {
                if (!menuItem.level) {
                    this.innerHTML = menuItem.icon;
                }
                vditor.element.style.zIndex = "";
                document.body.style.overflow = "";
                vditor.element.classList.remove("vditor--fullscreen");
                Object.keys(vditor.toolbar.elements).forEach((key) => {
                    const svgElement = vditor.toolbar.elements[key].firstChild as HTMLElement;
                    if (svgElement) {
                        svgElement.className = svgElement.className.replace("__s", "__n");
                    }
                });
                if (vditor.counter) {
                    vditor.counter.element.className = vditor.counter.element.className.replace("__s", "__n");
                }
            } else {
                if (!menuItem.level) {
                    this.innerHTML = '<svg><use xlink:href="#vditor-icon-contract"></use></svg>';
                }
                vditor.element.style.zIndex = vditor.options.fullscreen.index.toString();
                document.body.style.overflow = "hidden";
                vditor.element.classList.add("vditor--fullscreen");
                Object.keys(vditor.toolbar.elements).forEach((key) => {
                    const svgElement = vditor.toolbar.elements[key].firstChild as HTMLElement;
                    if (svgElement) {
                        svgElement.className = svgElement.className.replace("__n", "__s");
                    }
                });
                if (vditor.counter) {
                    vditor.counter.element.className = vditor.counter.element.className.replace("__n", "__s");
                }
            }

            if (vditor.devtools) {
                vditor.devtools.renderEchart(vditor);
            }

            if (menuItem.click) {
                menuItem.click(event, vditor);
            }

            setPadding(vditor);

            setTypewriterPosition(vditor);
        });
    }
}
