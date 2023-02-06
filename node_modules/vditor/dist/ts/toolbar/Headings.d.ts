/// <reference types="./types" />
import { MenuItem } from "./MenuItem";
export declare class Headings extends MenuItem {
    element: HTMLElement;
    constructor(vditor: IVditor, menuItem: IMenuItem);
    _bindEvent(vditor: IVditor, panelElement: HTMLElement): void;
}
