/// <reference types="./types" />
export declare class Preview {
    element: HTMLElement;
    private mdTimeoutId;
    constructor(vditor: IVditor);
    render(vditor: IVditor, value?: string): void;
    private afterRender;
    private copyToX;
}
