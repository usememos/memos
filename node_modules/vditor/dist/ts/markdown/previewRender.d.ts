/// <reference types="./types" />
export declare const md2html: (mdText: string, options?: IPreviewOptions) => Promise<string>;
export declare const previewRender: (previewElement: HTMLDivElement, markdown: string, options?: IPreviewOptions) => Promise<void>;
