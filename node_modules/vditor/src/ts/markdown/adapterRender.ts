export const mathRenderAdapter = {
    getCode: (mathElement: Element) => mathElement.textContent,
    getElements: (element: HTMLElement) => element.querySelectorAll(".language-math"),
};
export const mermaidRenderAdapter = {
    /** 不仅要返回code，并且需要将 code 设置为 el 的 innerHTML */
    getCode: (el: Element) => el.textContent,
    getElements: (element: HTMLElement) => element.querySelectorAll(".language-mermaid"),
};
export const markmapRenderAdapter = {
    getCode: (el: Element) => el.textContent,
    getElements: (element: HTMLElement) => element.querySelectorAll(".language-markmap"),
};
export const mindmapRenderAdapter = {
    getCode: (el: Element) => el.getAttribute("data-code"),
    getElements: (el: HTMLElement | Document) => el.querySelectorAll(".language-mindmap"),
};
export const chartRenderAdapter = {
    getCode: (el: HTMLElement) => el.innerText,
    getElements: (el: HTMLElement | Document) => el.querySelectorAll(".language-echarts"),
};
export const abcRenderAdapter = {
    getCode: (el: Element) => el.textContent,
    getElements: (el: HTMLElement | Document) => el.querySelectorAll(".language-abc"),
};
export const graphvizRenderAdapter = {
    getCode: (el: Element) => el.textContent,
    getElements: (el: HTMLElement | Document) => el.querySelectorAll(".language-graphviz"),
};
export const flowchartRenderAdapter = {
    getCode: (el: Element) => el.textContent,
    getElements: (el: HTMLElement | Document) => el.querySelectorAll(".language-flowchart"),
};
export const plantumlRenderAdapter = {
    getCode: (el: Element) => el.textContent,
    getElements: (el: HTMLElement | Document) => el.querySelectorAll(".language-plantuml"),
};
