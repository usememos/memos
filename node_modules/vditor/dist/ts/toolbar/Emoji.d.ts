/// <reference types="./types" />
import { MenuItem } from "./MenuItem";
export declare class Emoji extends MenuItem {
    element: HTMLElement;
    constructor(vditor: IVditor, menuItem: IMenuItem);
    private bindEvent;
}
