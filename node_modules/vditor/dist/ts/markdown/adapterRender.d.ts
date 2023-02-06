export declare const mathRenderAdapter: {
    getCode: (mathElement: Element) => string;
    getElements: (element: HTMLElement) => NodeListOf<Element>;
};
export declare const mermaidRenderAdapter: {
    /** 不仅要返回code，并且需要将 code 设置为 el 的 innerHTML */
    getCode: (el: Element) => string;
    getElements: (element: HTMLElement) => NodeListOf<Element>;
};
export declare const markmapRenderAdapter: {
    getCode: (el: Element) => string;
    getElements: (element: HTMLElement) => NodeListOf<Element>;
};
export declare const mindmapRenderAdapter: {
    getCode: (el: Element) => string;
    getElements: (el: HTMLElement | Document) => NodeListOf<Element>;
};
export declare const chartRenderAdapter: {
    getCode: (el: HTMLElement) => string;
    getElements: (el: HTMLElement | Document) => NodeListOf<Element>;
};
export declare const abcRenderAdapter: {
    getCode: (el: Element) => string;
    getElements: (el: HTMLElement | Document) => NodeListOf<Element>;
};
export declare const graphvizRenderAdapter: {
    getCode: (el: Element) => string;
    getElements: (el: HTMLElement | Document) => NodeListOf<Element>;
};
export declare const flowchartRenderAdapter: {
    getCode: (el: Element) => string;
    getElements: (el: HTMLElement | Document) => NodeListOf<Element>;
};
export declare const plantumlRenderAdapter: {
    getCode: (el: Element) => string;
    getElements: (el: HTMLElement | Document) => NodeListOf<Element>;
};
