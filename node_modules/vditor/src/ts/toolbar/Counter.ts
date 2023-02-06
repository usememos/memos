export class Counter {
    public element: HTMLElement;

    constructor(vditor: IVditor) {
        this.element = document.createElement("span");
        this.element.className = "vditor-counter vditor-tooltipped vditor-tooltipped__nw";

        this.render(vditor, "");

    }

    public render(vditor: IVditor, mdText: string) {
        let length = mdText.endsWith("\n") ? mdText.length - 1 : mdText.length;
        if (vditor.options.counter.type === "text" && vditor[vditor.currentMode]) {
            const tempElement = vditor[vditor.currentMode].element.cloneNode(true) as HTMLElement;
            tempElement.querySelectorAll(".vditor-wysiwyg__preview").forEach((item) => {
                item.remove();
            });
            length = tempElement.textContent.length;
        }
        if (typeof vditor.options.counter.max === "number") {
            if (length > vditor.options.counter.max) {
                this.element.className = "vditor-counter vditor-counter--error";
            } else {
                this.element.className = "vditor-counter";
            }
            this.element.innerHTML = `${length}/${vditor.options.counter.max}`;
        } else {
            this.element.innerHTML = `${length}`;
        }
        this.element.setAttribute("aria-label", vditor.options.counter.type);
        if (vditor.options.counter.after) {
            vditor.options.counter.after(length, {
                enable: vditor.options.counter.enable,
                max: vditor.options.counter.max,
                type: vditor.options.counter.type,
            });
        }
    }
}
