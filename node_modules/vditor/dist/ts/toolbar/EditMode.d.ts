/// <reference types="./types" />
import { MenuItem } from "./MenuItem";
export declare const setEditMode: (vditor: IVditor, type: string, event: Event | string) => void;
export declare class EditMode extends MenuItem {
    element: HTMLElement;
    constructor(vditor: IVditor, menuItem: IMenuItem);
    _bindEvent(vditor: IVditor, panelElement: HTMLElement, menuItem: IMenuItem): void;
}
