/// <reference types="./types" />
declare global {
    interface Window {
        MathJax: any;
    }
}
export declare const mathRender: (element: HTMLElement, options?: {
    cdn?: string;
    math?: IMath;
}) => void;
