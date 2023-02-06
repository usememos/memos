import {Constants} from "../constants";
import {addScript} from "../util/addScript";
import {mindmapRenderAdapter} from "./adapterRender";

declare const echarts: {
    init(element: HTMLElement, theme?: string): IEChart;
};

export const mindmapRender = (element: (HTMLElement | Document) = document, cdn = Constants.CDN, theme: string) => {
    const mindmapElements = mindmapRenderAdapter.getElements(element);
    if (mindmapElements.length > 0) {
        addScript(`${cdn}/dist/js/echarts/echarts.min.js`, "vditorEchartsScript").then(() => {
            mindmapElements.forEach((e: HTMLDivElement) => {
                if (e.parentElement.classList.contains("vditor-wysiwyg__pre") ||
                    e.parentElement.classList.contains("vditor-ir__marker--pre")) {
                    return;
                }
                const text = mindmapRenderAdapter.getCode(e);
                if (!text) {
                    return;
                }
                try {
                    if (e.getAttribute("data-processed") === "true") {
                        return;
                    }
                    echarts.init(e, theme === "dark" ? "dark" : undefined).setOption({
                        series: [
                            {
                                data: [JSON.parse(decodeURIComponent(text))],
                                initialTreeDepth: -1,
                                itemStyle: {
                                    borderWidth: 0,
                                    color: "#4285f4",
                                },
                                label: {
                                    backgroundColor: "#f6f8fa",
                                    borderColor: "#d1d5da",
                                    borderRadius: 5,
                                    borderWidth: 0.5,
                                    color: "#586069",
                                    lineHeight: 20,
                                    offset: [-5, 0],
                                    padding: [0, 5],
                                    position: "insideRight",
                                },
                                lineStyle: {
                                    color: "#d1d5da",
                                    width: 1,
                                },
                                roam: true,
                                symbol: (value: number, params: { data?: { children?: object } }) => {
                                    if (params?.data?.children) {
                                        return "circle";
                                    } else {
                                        return "path://";
                                    }
                                },
                                type: "tree",
                            },
                        ],
                        tooltip: {
                            trigger: "item",
                            triggerOn: "mousemove",
                        },
                    });
                    e.setAttribute("data-processed", "true");
                } catch (error) {
                    e.className = "vditor-reset--error";
                    e.innerHTML = `mindmap render error: <br>${error}`;
                }
            });
        });
    }
};
