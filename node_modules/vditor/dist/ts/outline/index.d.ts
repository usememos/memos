/// <reference types="./types" />
export declare class Outline {
    element: HTMLElement;
    constructor(outlineLabel: string);
    render(vditor: IVditor): string;
    toggle(vditor: IVditor, show?: boolean, focus?: boolean): void;
}
