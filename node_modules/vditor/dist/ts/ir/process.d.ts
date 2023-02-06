/// <reference types="./types" />
export declare const processHint: (vditor: IVditor) => void;
export declare const processAfterRender: (vditor: IVditor, options?: {
    enableAddUndoStack: boolean;
    enableHint: boolean;
    enableInput: boolean;
}) => void;
export declare const processHeading: (vditor: IVditor, value: string) => void;
export declare const processToolbar: (vditor: IVditor, actionBtn: Element, prefix: string, suffix: string) => void;
