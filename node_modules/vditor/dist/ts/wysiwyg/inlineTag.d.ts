/// <reference types="./types" />
export declare const previoueIsEmptyA: (node: Node) => false | HTMLElement;
export declare const nextIsCode: (range: Range) => boolean;
export declare const getNextHTML: (node: Node) => string;
export declare const getPreviousHTML: (node: Node) => string;
export declare const getRenderElementNextNode: (blockCodeElement: HTMLElement) => ChildNode;
export declare const splitElement: (range: Range) => {
    afterHTML: string;
    beforeHTML: string;
};
export declare const modifyPre: (vditor: IVditor, range: Range) => void;
