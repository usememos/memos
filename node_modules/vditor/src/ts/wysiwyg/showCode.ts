import {scrollCenter} from "../util/editorCommonEvent";
import {setSelectionFocus} from "../util/selection";

export const showCode = (previewElement: HTMLElement, vditor: IVditor, first = true) => {
    const previousElement = previewElement.previousElementSibling as HTMLElement;
    const range = previousElement.ownerDocument.createRange();
    if (previousElement.tagName === "CODE") {
        previousElement.style.display = "inline-block";
        if (first) {
            range.setStart(previousElement.firstChild, 1);
        } else {
            range.selectNodeContents(previousElement);
        }
    } else {
        previousElement.style.display = "block";

        if (!previousElement.firstChild.firstChild) {
            previousElement.firstChild.appendChild(document.createTextNode(""));
        }
        range.selectNodeContents(previousElement.firstChild);
    }
    if (first) {
        range.collapse(true);
    } else {
        range.collapse(false);
    }
    setSelectionFocus(range);
    if (previewElement.firstElementChild.classList.contains("language-mindmap")) {
        return;
    }
    scrollCenter(vditor);
};
