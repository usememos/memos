export class Divider {
    public element: HTMLElement;

    constructor() {
        this.element = document.createElement("div");
        this.element.className = "vditor-toolbar__divider";
    }
}
