import {Constants} from "../constants";
import {addScript} from "../util/addScript";
import {markmapRenderAdapter} from "./adapterRender";

declare const window: any;
const enabled: Record<string, boolean> = {};

const transform = (transformer: any,content: string)=>{
    const result = transformer.transform(content);
    const keys = Object.keys(result.features).filter((key) => !enabled[key]);
    keys.forEach((key) => {
        enabled[key] = true;
    });
    const { styles, scripts } = transformer.getAssets(keys);
    const { markmap } = window;
    if (styles) markmap.loadCSS(styles);
    if (scripts) markmap.loadJS(scripts);
    return result;
}

const init = (el: HTMLElement,code: string) => {
    const { Transformer, Markmap, deriveOptions , globalCSS} = window.markmap;
    const transformer = new Transformer();
    el.innerHTML = '<svg style="width:100%"></svg>';
    const svg = el.firstChild as SVGElement;
    const mm = Markmap.create(svg, null);
    const { root, frontmatter } = transform(transformer, code);
    const markmapOptions = frontmatter?.markmap;
    const frontmatterOptions = deriveOptions(markmapOptions);
    mm.setData(root, frontmatterOptions);
    mm.fit();
  }


export const markmapRender = (element: HTMLElement, cdn = Constants.CDN, theme: string) => {
    const markmapElements = markmapRenderAdapter.getElements(element);
    if (markmapElements.length === 0) {
        return;
    }
    addScript(`${cdn}/src/js/markmap/markmap.min.js`, "vditorMermaidScript").then(() => {
        markmapElements.forEach((item) => {
            const code = markmapRenderAdapter.getCode(item);
            if (item.getAttribute("data-processed") === "true" || code.trim() === "") {
                return;
            }
            const render = document.createElement("div")
            render.className = "language-markmap"
            item.parentNode.appendChild(render)
            init(render,code)
    
            if(item.parentNode.childNodes[0].nodeName == "CODE"){
                item.parentNode.removeChild(item.parentNode.childNodes[0])
            }
        });
    });

};