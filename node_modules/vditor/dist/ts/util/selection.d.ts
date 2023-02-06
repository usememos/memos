/// <reference types="./types" />
export declare const getEditorRange: (vditor: IVditor) => Range;
export declare const getCursorPosition: (editor: HTMLElement) => {
    left: number;
    top: number;
};
export declare const selectIsEditor: (editor: HTMLElement, range?: Range) => boolean;
export declare const setSelectionFocus: (range: Range) => void;
export declare const getSelectPosition: (selectElement: HTMLElement, editorElement: HTMLElement, range?: Range) => {
    end: number;
    start: number;
};
export declare const setSelectionByPosition: (start: number, end: number, editor: HTMLElement) => Range;
export declare const setRangeByWbr: (element: HTMLElement, range: Range) => void;
export declare const insertHTML: (html: string, vditor: IVditor) => void;
