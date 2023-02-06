/// <reference types="./types" />
declare global {
    interface Window {
        vditorSpeechRange: Range;
    }
}
export declare const speechRender: (element: HTMLElement, lang?: keyof II18n) => void;
