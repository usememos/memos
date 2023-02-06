/// <reference types="./types" />
declare class Upload {
    element: HTMLElement;
    isUploading: boolean;
    range: Range;
    constructor();
}
declare const uploadFiles: (vditor: IVditor, files: FileList | DataTransferItemList | File[], element?: HTMLInputElement) => Promise<void>;
export { Upload, uploadFiles };
