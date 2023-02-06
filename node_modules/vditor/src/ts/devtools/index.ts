import {getMarkdown} from "../markdown/getMarkdown";
import {addScript} from "../util/addScript";

declare const echarts: {
    init(element: HTMLElement): IEChart;
};

export class DevTools {
    public element: HTMLDivElement;
    private ASTChart: IEChart;

    constructor() {
        this.element = document.createElement("div");
        this.element.className = "vditor-devtools";
        this.element.innerHTML = '<div class="vditor-reset--error"></div><div style="height: 100%;"></div>';
    }

    public renderEchart(vditor: IVditor) {
        if (vditor.devtools.element.style.display !== "block") {
            return;
        }

        addScript(`${vditor.options.cdn}/dist/js/echarts/echarts.min.js`, "vditorEchartsScript").then(() => {
            if (!this.ASTChart) {
                this.ASTChart = echarts.init(vditor.devtools.element.lastElementChild as HTMLDivElement);
            }
            try {
                (this.element.lastElementChild as HTMLElement).style.display = "block";
                this.element.firstElementChild.innerHTML = "";
                this.ASTChart.setOption({
                    series: [
                        {
                            data: JSON.parse(vditor.lute.RenderEChartsJSON(getMarkdown(vditor))),
                            initialTreeDepth: -1,
                            label: {
                                align: "left",
                                backgroundColor: "rgba(68, 77, 86, .68)",
                                borderRadius: 3,
                                color: "#d1d5da",
                                fontSize: 12,
                                lineHeight: 12,
                                offset: [9, 12],
                                padding: [2, 4, 2, 4],
                                position: "top",
                                verticalAlign: "middle",
                            },
                            lineStyle: {
                                color: "#4285f4",
                                type: "curve",
                                width: 1,
                            },
                            orient: "vertical",
                            roam: true,
                            type: "tree",
                        },
                    ],
                    toolbox: {
                        bottom: 25,
                        emphasis: {
                            iconStyle: {
                                color: "#4285f4",
                            },
                        },
                        feature: {
                            restore: {
                                show: true,
                            },
                            saveAsImage: {
                                show: true,
                            },
                        },
                        right: 15,
                        show: true,
                    },
                });
                this.ASTChart.resize();
            } catch (e) {
                (this.element.lastElementChild as HTMLElement).style.display = "none";
                this.element.firstElementChild.innerHTML = e;
            }
        });
    }
}
