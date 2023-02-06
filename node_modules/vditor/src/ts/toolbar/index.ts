import {getEventName} from "../util/compatibility";
import {Both} from "./Both";
import {Br} from "./Br";
import {CodeTheme} from "./CodeTheme";
import {ContentTheme} from "./ContentTheme";
import {Counter} from "./Counter";
import {Custom} from "./Custom";
import {Devtools} from "./Devtools";
import {Divider} from "./Divider";
import {EditMode} from "./EditMode";
import {Emoji} from "./Emoji";
import {Export} from "./Export";
import {Fullscreen} from "./Fullscreen";
import {Headings} from "./Headings";
import {Help} from "./Help";
import {Indent} from "./Indent";
import {Info} from "./Info";
import {InsertAfter} from "./InsertAfter";
import {InsertBefore} from "./InsertBefore";
import {MenuItem} from "./MenuItem";
import {Outdent} from "./Outdent";
import {Outline} from "./Outline";
import {Preview} from "./Preview";
import {Record} from "./Record";
import {Redo} from "./Redo";
import {toggleSubMenu} from "./setToolbar";
import {Undo} from "./Undo";
import {Upload} from "./Upload";

export class Toolbar {
    public elements: { [key: string]: HTMLElement };
    public element: HTMLElement;

    constructor(vditor: IVditor) {
        const options = vditor.options;
        this.elements = {};

        this.element = document.createElement("div");
        this.element.className = "vditor-toolbar";

        options.toolbar.forEach((menuItem: IMenuItem, i: number) => {
            const itemElement = this.genItem(vditor, menuItem, i);
            this.element.appendChild(itemElement);
            if (menuItem.toolbar) {
                const panelElement = document.createElement("div");
                panelElement.className = "vditor-hint vditor-panel--arrow";
                panelElement.addEventListener(getEventName(), (event) => {
                    panelElement.style.display = "none";
                });
                menuItem.toolbar.forEach((subMenuItem: IMenuItem, subI: number) => {
                    subMenuItem.level = 2;
                    panelElement.appendChild(this.genItem(vditor, subMenuItem, i + subI));
                });
                itemElement.appendChild(panelElement);
                toggleSubMenu(vditor, panelElement, itemElement.children[0], 2);
            }
        });

        if (vditor.options.toolbarConfig.hide) {
            this.element.classList.add("vditor-toolbar--hide");
        }
        if (vditor.options.toolbarConfig.pin) {
            this.element.classList.add("vditor-toolbar--pin");
        }

        if (vditor.options.counter.enable) {
            vditor.counter = new Counter(vditor);
            this.element.appendChild(vditor.counter.element);
        }
    }

    private genItem(vditor: IVditor, menuItem: IMenuItem, index: number) {
        let menuItemObj;
        switch (menuItem.name) {
            case "bold":
            case "italic":
            case "more":
            case "strike":
            case "line":
            case "quote":
            case "list":
            case "ordered-list":
            case "check":
            case "code":
            case "inline-code":
            case "link":
            case "table":
                menuItemObj = new MenuItem(vditor, menuItem);
                break;
            case "emoji":
                menuItemObj = new Emoji(vditor, menuItem);
                break;
            case "headings":
                menuItemObj = new Headings(vditor, menuItem);
                break;
            case "|":
                menuItemObj = new Divider();
                break;
            case "br":
                menuItemObj = new Br();
                break;
            case "undo":
                menuItemObj = new Undo(vditor, menuItem);
                break;
            case "redo":
                menuItemObj = new Redo(vditor, menuItem);
                break;
            case "help":
                menuItemObj = new Help(vditor, menuItem);
                break;
            case "both":
                menuItemObj = new Both(vditor, menuItem);
                break;
            case "preview":
                menuItemObj = new Preview(vditor, menuItem);
                break;
            case "fullscreen":
                menuItemObj = new Fullscreen(vditor, menuItem);
                break;
            case "upload":
                menuItemObj = new Upload(vditor, menuItem);
                break;
            case "record":
                menuItemObj = new Record(vditor, menuItem);
                break;
            case "info":
                menuItemObj = new Info(vditor, menuItem);
                break;
            case "edit-mode":
                menuItemObj = new EditMode(vditor, menuItem);
                break;
            case "devtools":
                menuItemObj = new Devtools(vditor, menuItem);
                break;
            case "outdent":
                menuItemObj = new Outdent(vditor, menuItem);
                break;
            case "indent":
                menuItemObj = new Indent(vditor, menuItem);
                break;
            case "outline":
                menuItemObj = new Outline(vditor, menuItem);
                break;
            case "insert-after":
                menuItemObj = new InsertAfter(vditor, menuItem);
                break;
            case "insert-before":
                menuItemObj = new InsertBefore(vditor, menuItem);
                break;
            case "code-theme":
                menuItemObj = new CodeTheme(vditor, menuItem);
                break;
            case "content-theme":
                menuItemObj = new ContentTheme(vditor, menuItem);
                break;
            case "export":
                menuItemObj = new Export(vditor, menuItem);
                break;
            default:
                menuItemObj = new Custom(vditor, menuItem);
                break;
        }

        if (!menuItemObj) {
            return;
        }
        let key = menuItem.name;
        if (key === "br" || key === "|") {
            key = key + index;
        }

        this.elements[key] = menuItemObj.element;
        return menuItemObj.element;
    }
}
