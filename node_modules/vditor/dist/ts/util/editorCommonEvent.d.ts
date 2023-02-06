/// <reference types="./types" />
export declare const focusEvent: (vditor: IVditor, editorElement: HTMLElement) => void;
export declare const dblclickEvent: (vditor: IVditor, editorElement: HTMLElement) => void;
export declare const blurEvent: (vditor: IVditor, editorElement: HTMLElement) => void;
export declare const dropEvent: (vditor: IVditor, editorElement: HTMLElement) => void;
export declare const copyEvent: (vditor: IVditor, editorElement: HTMLElement, copy: (event: ClipboardEvent, vditor: IVditor) => void) => void;
export declare const cutEvent: (vditor: IVditor, editorElement: HTMLElement, copy: (event: ClipboardEvent, vditor: IVditor) => void) => void;
export declare const scrollCenter: (vditor: IVditor) => void;
export declare const hotkeyEvent: (vditor: IVditor, editorElement: HTMLElement) => void;
export declare const selectEvent: (vditor: IVditor, editorElement: HTMLElement) => void;
