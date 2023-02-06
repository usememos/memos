import {abcRender} from "../markdown/abcRender";
import {chartRender} from "../markdown/chartRender";
import {codeRender} from "../markdown/codeRender";
import {flowchartRender} from "../markdown/flowchartRender";
import {graphvizRender} from "../markdown/graphvizRender";
import {highlightRender} from "../markdown/highlightRender";
import {mathRender} from "../markdown/mathRender";
import {mermaidRender} from "../markdown/mermaidRender";
import {markmapRender} from "../markdown/markmapRender";
import {mindmapRender} from "../markdown/mindmapRender";
import {plantumlRender} from "../markdown/plantumlRender";

export const processPasteCode = (html: string, text: string, type = "sv") => {
    const tempElement = document.createElement("div");
    tempElement.innerHTML = html;
    let isCode = false;
    if (tempElement.childElementCount === 1 &&
        (tempElement.lastElementChild as HTMLElement).style.fontFamily.indexOf("monospace") > -1) {
        // VS Code
        isCode = true;
    }
    const pres = tempElement.querySelectorAll("pre");
    if (tempElement.childElementCount === 1 && pres.length === 1
        && pres[0].className !== "vditor-wysiwyg"
        && pres[0].className !== "vditor-sv") {
        // IDE
        isCode = true;
    }
    if (html.indexOf('\n<p class="p1">') === 0) {
        // Xcode
        isCode = true;
    }
    if (tempElement.childElementCount === 1 && tempElement.firstElementChild.tagName === "TABLE" &&
        tempElement.querySelector(".line-number") && tempElement.querySelector(".line-content")) {
        // 网页源码
        isCode = true;
    }

    if (isCode) {
        const code = text || html;
        if (/\n/.test(code) || pres.length === 1) {
            if (type === "wysiwyg") {
                return `<div class="vditor-wysiwyg__block" data-block="0" data-type="code-block"><pre><code>${
                    code.replace(/&/g, "&amp;").replace(/</g, "&lt;")}<wbr></code></pre></div>`;
            }
            return "\n```\n" + code.replace(/&/g, "&amp;").replace(/</g, "&lt;") + "\n```";
        } else {
            if (type === "wysiwyg") {
                return `<code>${code.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code><wbr>`;
            }
            return `\`${code}\``;
        }
    }
    return false;
};

export const processCodeRender = (previewPanel: HTMLElement, vditor: IVditor) => {
    if (!previewPanel) {
        return;
    }
    if (previewPanel.parentElement.getAttribute("data-type") === "html-block") {
        previewPanel.setAttribute("data-render", "1");
        return;
    }
    const language = previewPanel.firstElementChild.className.replace("language-", "");
    if (!language) {
        return;
    }
    if (language === "abc") {
        abcRender(previewPanel, vditor.options.cdn);
    } else if (language === "mermaid") {
        mermaidRender(previewPanel, vditor.options.cdn, vditor.options.theme);
    } else if (language === "markmap") {
        markmapRender(previewPanel, vditor.options.cdn, vditor.options.theme);
    } else if (language === "flowchart") {
        flowchartRender(previewPanel, vditor.options.cdn);
    } else if (language === "echarts") {
        chartRender(previewPanel, vditor.options.cdn, vditor.options.theme);
    } else if (language === "mindmap") {
        mindmapRender(previewPanel, vditor.options.cdn, vditor.options.theme);
    } else if (language === "plantuml") {
        plantumlRender(previewPanel, vditor.options.cdn);
    } else if (language === "graphviz") {
        graphvizRender(previewPanel, vditor.options.cdn);
    } else if (language === "math") {
        mathRender(previewPanel, {cdn: vditor.options.cdn, math: vditor.options.preview.math});
    } else {
        highlightRender(Object.assign({}, vditor.options.preview.hljs), previewPanel, vditor.options.cdn);
        codeRender(previewPanel);
    }

    previewPanel.setAttribute("data-render", "1");
};
