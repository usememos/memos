import {getEventName} from "../util/compatibility";
import {execAfterRender} from "../util/fixBrowserBehavior";
import {hasClosestByTag} from "../util/hasClosestByHeadings";
import {getEditorRange, insertHTML, setSelectionFocus} from "../util/selection";
import {MenuItem} from "./MenuItem";
import {toggleSubMenu} from "./setToolbar";

export class Emoji extends MenuItem {
    public element: HTMLElement;

    constructor(vditor: IVditor, menuItem: IMenuItem) {
        super(vditor, menuItem);
        const panelElement = document.createElement("div");
        panelElement.className = "vditor-panel vditor-panel--arrow";

        let commonEmojiHTML = "";
        Object.keys(vditor.options.hint.emoji).forEach((key) => {
            const emojiValue = vditor.options.hint.emoji[key];
            if (emojiValue.indexOf(".") > -1) {
                commonEmojiHTML += `<button data-value=":${key}: " data-key=":${key}:"><img
data-value=":${key}: " data-key=":${key}:" class="vditor-emojis__icon" src="${emojiValue}"/></button>`;
            } else {
                commonEmojiHTML += `<button data-value="${emojiValue} "
 data-key="${key}"><span class="vditor-emojis__icon">${emojiValue}</span></button>`;
            }
        });
        panelElement.innerHTML = `<div class="vditor-emojis" style="max-height: ${
            vditor.options.height === "auto" ? "auto" : vditor.options.height as number - 80
        }px">${commonEmojiHTML}</div><div class="vditor-emojis__tail">
    <span class="vditor-emojis__tip"></span><span>${vditor.options.hint.emojiTail || ""}</span>
</div>`;

        this.element.appendChild(panelElement);

        toggleSubMenu(vditor, panelElement, this.element.firstElementChild, menuItem.level);
        this.bindEvent(vditor);
    }

    private bindEvent(vditor: IVditor) {
        this.element.lastElementChild.addEventListener(getEventName(), (event: Event & { target: Element }) => {
            const btnElement = hasClosestByTag(event.target, "BUTTON");
            if (btnElement) {
                event.preventDefault();
                const value = btnElement.getAttribute("data-value");
                const range = getEditorRange(vditor);
                let html = value;
                if (vditor.currentMode === "wysiwyg") {
                    html = vditor.lute.SpinVditorDOM(value);
                } else if (vditor.currentMode === "ir") {
                    html = vditor.lute.SpinVditorIRDOM(value);
                }
                if (value.indexOf(":") > -1 && vditor.currentMode !== "sv") {
                    const tempElement = document.createElement("div");
                    tempElement.innerHTML = html;
                    html = tempElement.firstElementChild.firstElementChild.outerHTML + " ";
                    insertHTML(html, vditor);
                } else {
                    range.extractContents();
                    range.insertNode(document.createTextNode(value));
                }
                range.collapse(false);
                setSelectionFocus(range);
                (this.element.lastElementChild as HTMLElement).style.display = "none";
                execAfterRender(vditor);
            }
        });
        this.element.lastElementChild.addEventListener("mouseover", (event: Event & { target: Element }) => {
            const btnElement = hasClosestByTag(event.target, "BUTTON");
            if (btnElement) {
                this.element.querySelector(".vditor-emojis__tip").innerHTML = btnElement.getAttribute("data-key");
            }
        });
    }
}
