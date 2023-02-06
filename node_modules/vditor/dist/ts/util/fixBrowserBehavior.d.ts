/// <reference types="./types" />
export declare const fixGSKeyBackspace: (event: KeyboardEvent, vditor: IVditor, startContainer: Node) => boolean;
export declare const fixCJKPosition: (range: Range, vditor: IVditor, event: KeyboardEvent) => void;
export declare const fixCursorDownInlineMath: (range: Range, key: string) => void;
export declare const insertEmptyBlock: (vditor: IVditor, position: InsertPosition) => void;
export declare const isFirstCell: (cellElement: HTMLElement) => false | HTMLTableElement;
export declare const isLastCell: (cellElement: HTMLElement) => false | HTMLTableElement;
export declare const insertAfterBlock: (vditor: IVditor, event: KeyboardEvent, range: Range, element: HTMLElement, blockElement: HTMLElement) => boolean;
export declare const insertBeforeBlock: (vditor: IVditor, event: KeyboardEvent, range: Range, element: HTMLElement, blockElement: HTMLElement) => boolean;
export declare const listToggle: (vditor: IVditor, range: Range, type: string, cancel?: boolean) => void;
export declare const listIndent: (vditor: IVditor, liElement: HTMLElement, range: Range) => void;
export declare const listOutdent: (vditor: IVditor, liElement: HTMLElement, range: Range, topListElement: HTMLElement) => void;
export declare const setTableAlign: (tableElement: HTMLTableElement, type: string) => void;
export declare const isHrMD: (text: string) => boolean;
export declare const isHeadingMD: (text: string) => boolean;
export declare const execAfterRender: (vditor: IVditor, options?: {
    enableAddUndoStack: boolean;
    enableHint: boolean;
    enableInput: boolean;
}) => void;
export declare const fixList: (range: Range, vditor: IVditor, pElement: HTMLElement | false, event: KeyboardEvent) => boolean;
export declare const fixTab: (vditor: IVditor, range: Range, event: KeyboardEvent) => boolean;
export declare const fixMarkdown: (event: KeyboardEvent, vditor: IVditor, pElement: HTMLElement | false, range: Range) => boolean;
export declare const insertRow: (vditor: IVditor, range: Range, cellElement: HTMLElement) => void;
export declare const insertRowAbove: (vditor: IVditor, range: Range, cellElement: HTMLElement) => void;
export declare const insertColumn: (vditor: IVditor, tableElement: HTMLTableElement, cellElement: HTMLElement, type?: InsertPosition) => void;
export declare const deleteRow: (vditor: IVditor, range: Range, cellElement: HTMLElement) => void;
export declare const deleteColumn: (vditor: IVditor, range: Range, tableElement: HTMLTableElement, cellElement: HTMLElement) => void;
export declare const fixTable: (vditor: IVditor, event: KeyboardEvent, range: Range) => boolean;
export declare const fixCodeBlock: (vditor: IVditor, event: KeyboardEvent, codeRenderElement: HTMLElement, range: Range) => boolean;
export declare const fixBlockquote: (vditor: IVditor, range: Range, event: KeyboardEvent, pElement: HTMLElement | false) => boolean;
export declare const fixTask: (vditor: IVditor, range: Range, event: KeyboardEvent) => boolean;
export declare const fixDelete: (vditor: IVditor, range: Range, event: KeyboardEvent, pElement: HTMLElement | false) => boolean;
export declare const fixHR: (range: Range) => void;
export declare const fixFirefoxArrowUpTable: (event: KeyboardEvent, blockElement: false | HTMLElement, range: Range) => boolean;
export declare const paste: (vditor: IVditor, event: (ClipboardEvent | DragEvent) & {
    target: HTMLElement;
}, callback: {
    pasteCode(code: string): void;
}) => Promise<void>;
