/// <reference types="./types" />
export declare const renderToc: (vditor: IVditor) => void;
export declare const clickToc: (event: MouseEvent & {
    target: HTMLElement;
}, vditor: IVditor) => void;
export declare const keydownToc: (blockElement: HTMLElement, vditor: IVditor, event: KeyboardEvent, range: Range) => boolean;
