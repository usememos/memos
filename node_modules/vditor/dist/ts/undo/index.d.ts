/// <reference types="./types" />
declare class Undo {
    private stackSize;
    private dmp;
    private wysiwyg;
    private ir;
    private sv;
    constructor();
    clearStack(vditor: IVditor): void;
    resetIcon(vditor: IVditor): void;
    undo(vditor: IVditor): void;
    redo(vditor: IVditor): void;
    recordFirstPosition(vditor: IVditor, event: KeyboardEvent): void;
    addToUndoStack(vditor: IVditor): void;
    private renderDiff;
    private resetStack;
    private addCaret;
}
export { Undo };
