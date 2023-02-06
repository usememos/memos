import {Constants} from "../constants";
import {addScript} from "../util/addScript";
import {mermaidRenderAdapter} from "./adapterRender";

declare const mermaid: {
    initialize(options: any): void,
    init(options: any, element: Element): void,
};

export const mermaidRender = (element: HTMLElement, cdn = Constants.CDN, theme: string) => {
    const mermaidElements = mermaidRenderAdapter.getElements(element);
    if (mermaidElements.length === 0) {
        return;
    }
    addScript(`${cdn}/dist/js/mermaid/mermaid.min.js`, "vditorMermaidScript").then(() => {
        const config: any = {
            securityLevel: "loose", // 升级后无 https://github.com/siyuan-note/siyuan/issues/3587，可使用该选项
            altFontFamily: "sans-serif",
            fontFamily: "sans-serif",
            startOnLoad: false,
            flowchart: {
                htmlLabels: true,
                useMaxWidth: !0
            },
            sequence: {
                useMaxWidth: true,
                diagramMarginX: 8,
                diagramMarginY: 8,
                boxMargin: 8
            },
            gantt: {
                leftPadding: 75,
                rightPadding: 20
            }
        };
        if (theme === "dark") {
            config.theme = "dark";
        }
        mermaid.initialize(config);
        mermaidElements.forEach((item) => {
            const code = mermaidRenderAdapter.getCode(item);
            if (item.getAttribute("data-processed") === "true" || code.trim() === "") {
                return;
            }
            mermaid.init(undefined, item);
            item.setAttribute("data-processed", "true");
        });
    });
};
