/// <reference types="./types" />
declare global {
    interface Window {
        visualViewport: HTMLElement;
    }
}
export declare const initUI: (vditor: IVditor) => void;
export declare const setPadding: (vditor: IVditor) => void;
export declare const setTypewriterPosition: (vditor: IVditor) => void;
export declare function UIUnbindListener(): void;
