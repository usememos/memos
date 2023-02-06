/// <reference types="./types" />
import { MenuItem } from "./MenuItem";
export declare class Record extends MenuItem {
    constructor(vditor: IVditor, menuItem: IMenuItem);
    _bindEvent(vditor: IVditor): void;
}
