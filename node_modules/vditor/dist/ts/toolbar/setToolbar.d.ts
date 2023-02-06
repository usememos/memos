/// <reference types="./types" />
export declare const removeCurrentToolbar: (toolbar: {
    [key: string]: HTMLElement;
}, names: string[]) => void;
export declare const setCurrentToolbar: (toolbar: {
    [key: string]: HTMLElement;
}, names: string[]) => void;
export declare const enableToolbar: (toolbar: {
    [key: string]: HTMLElement;
}, names: string[]) => void;
export declare const disableToolbar: (toolbar: {
    [key: string]: HTMLElement;
}, names: string[]) => void;
export declare const hideToolbar: (toolbar: {
    [key: string]: HTMLElement;
}, names: string[]) => void;
export declare const showToolbar: (toolbar: {
    [key: string]: HTMLElement;
}, names: string[]) => void;
export declare const hidePanel: (vditor: IVditor, panels: string[], exceptElement?: HTMLElement) => void;
export declare const toggleSubMenu: (vditor: IVditor, panelElement: HTMLElement, actionBtn: Element, level: number) => void;
