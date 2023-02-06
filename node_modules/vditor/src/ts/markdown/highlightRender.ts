import {Constants} from "../constants";
import {addScript} from "../util/addScript";
import {addStyle} from "../util/addStyle";

declare const hljs: {
  highlightElement(element: Element): void;
};

export const highlightRender = (hljsOption?: IHljs, element: HTMLElement | Document = document,
                                cdn = Constants.CDN) => {
  let style = hljsOption.style;
  if (!Constants.CODE_THEME.includes(style)) {
    style = "github";
  }
  const vditorHljsStyle = document.getElementById("vditorHljsStyle") as HTMLLinkElement;
  const href = `${cdn}/dist/js/highlight.js/styles/${style}.css`;
  if (vditorHljsStyle && vditorHljsStyle.href !== href) {
    vditorHljsStyle.remove();
  }
  addStyle(`${cdn}/dist/js/highlight.js/styles/${style}.css`, "vditorHljsStyle");

  if (hljsOption.enable === false) {
    return;
  }

  const codes = element.querySelectorAll("pre > code");
  if (codes.length === 0) {
    return;
  }

  addScript(`${cdn}/dist/js/highlight.js/highlight.pack.js`, "vditorHljsScript").then(() => {
    addScript(`${cdn}/dist/js/highlight.js/solidity.min.js`, "vditorHljsSolidityScript").then(() => {
      addScript(`${cdn}/dist/js/highlight.js/yul.min.js`, "vditorHljsYulScript").then(() => {
        element.querySelectorAll("pre > code").forEach((block) => {
          // ir & wysiwyg 区域不渲染
          if (block.parentElement.classList.contains("vditor-ir__marker--pre") ||
            block.parentElement.classList.contains("vditor-wysiwyg__pre")) {
            return;
          }

          if (block.classList.contains("language-mermaid") || block.classList.contains("language-flowchart") ||
            block.classList.contains("language-echarts") || block.classList.contains("language-mindmap") ||
            block.classList.contains("language-plantuml") ||
            block.classList.contains("language-abc") || block.classList.contains("language-graphviz") ||
            block.classList.contains("language-math")) {
            return;
          }
          hljs.highlightElement(block);

          if (!hljsOption.lineNumber) {
            return;
          }

          block.classList.add("vditor-linenumber");
          let linenNumberTemp: HTMLDivElement = block.querySelector(".vditor-linenumber__temp");
          if (!linenNumberTemp) {
            linenNumberTemp = document.createElement("div");
            linenNumberTemp.className = "vditor-linenumber__temp";
            block.insertAdjacentElement("beforeend", linenNumberTemp);
          }
          const whiteSpace = getComputedStyle(block).whiteSpace;
          let isSoftWrap = false;
          if (whiteSpace === "pre-wrap" || whiteSpace === "pre-line") {
            isSoftWrap = true;
          }
          let lineNumberHTML = "";
          const lineList = block.textContent.split(/\r\n|\r|\n/g);
          lineList.pop();
          lineList.map((line) => {
            let lineHeight = "";
            if (isSoftWrap) {
              linenNumberTemp.textContent = line || "\n";
              lineHeight = ` style="height:${linenNumberTemp.getBoundingClientRect().height}px"`;
            }
            lineNumberHTML += `<span${lineHeight}></span>`;
          });

          linenNumberTemp.style.display = "none";
          lineNumberHTML = `<span class="vditor-linenumber__rows">${lineNumberHTML}</span>`;
          block.insertAdjacentHTML("beforeend", lineNumberHTML);
        });
      })
    })
  });

};
