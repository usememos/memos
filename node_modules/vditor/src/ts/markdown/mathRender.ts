import {Constants} from "../constants";
import {addScript, addScriptSync} from "../util/addScript";
import {addStyle} from "../util/addStyle";
import {code160to32} from "../util/code160to32";
import {mathRenderAdapter} from "./adapterRender";

declare const katex: {
    renderToString(math: string, option: {
        displayMode: boolean;
        output: string;
    }): string;
};

declare global {
    interface Window {
        MathJax: any;
    }
}

export const mathRender = (element: HTMLElement, options?: { cdn?: string, math?: IMath }) => {
    const mathElements = mathRenderAdapter.getElements(element);

    if (mathElements.length === 0) {
        return;
    }

    const defaultOptions = {
        cdn: Constants.CDN,
        math: {
            engine: "KaTeX",
            inlineDigit: false,
            macros: {},
        },
    };

    if (options && options.math) {
        options.math =
            Object.assign({}, defaultOptions.math, options.math);
    }
    options = Object.assign({}, defaultOptions, options);

    if (options.math.engine === "KaTeX") {
        addStyle(`${options.cdn}/dist/js/katex/katex.min.css`, "vditorKatexStyle");
        addScript(`${options.cdn}/dist/js/katex/katex.min.js`, "vditorKatexScript").then(() => {
            addScript(`${options.cdn}/dist/js/katex/mhchem.min.js`, "vditorKatexChemScript").then(() => {
                mathElements.forEach((mathElement) => {
                    if (mathElement.parentElement.classList.contains("vditor-wysiwyg__pre") ||
                        mathElement.parentElement.classList.contains("vditor-ir__marker--pre")) {
                        return;
                    }
                    if (mathElement.getAttribute("data-math")) {
                        return;
                    }
                    const math = code160to32(mathRenderAdapter.getCode(mathElement));
                    mathElement.setAttribute("data-math", math);
                    try {
                        mathElement.innerHTML = katex.renderToString(math, {
                            displayMode: mathElement.tagName === "DIV",
                            output: "html",
                        });
                    } catch (e) {
                        mathElement.innerHTML = e.message;
                        mathElement.className = "language-math vditor-reset--error";
                    }

                    mathElement.addEventListener("copy", (event: ClipboardEvent) => {
                        event.stopPropagation();
                        event.preventDefault();
                        const vditorMathElement = (event.currentTarget as HTMLElement).closest(".language-math");
                        event.clipboardData.setData("text/html", vditorMathElement.innerHTML);
                        event.clipboardData.setData("text/plain",
                            vditorMathElement.getAttribute("data-math"));
                    });
                });
            });
        });
    } else if (options.math.engine === "MathJax") {
        const chainAsync = (fns: any) => {
            if (fns.length === 0) {
                return;
            }
            let curr = 0;
            const last = fns[fns.length - 1];
            const next = () => {
                const fn = fns[curr++];
                fn === last ? fn() : fn(next);
            };
            next();
        };
        if (!window.MathJax) {
            window.MathJax = {
                loader: {
                    paths: {mathjax: `${options.cdn}/dist/js/mathjax`},
                },
                startup: {
                    typeset: false,
                },
                tex: {
                    macros: options.math.macros,
                },
            };
        }
        // 循环加载会抛异常
        addScriptSync(`${options.cdn}/dist/js/mathjax/tex-svg-full.js`, "protyleMathJaxScript");
        const renderMath = (mathElement: Element, next?: () => void) => {
            const math = code160to32(mathElement.textContent).trim();
            const mathOptions = window.MathJax.getMetricsFor(mathElement);
            mathOptions.display = mathElement.tagName === "DIV";
            window.MathJax.tex2svgPromise(math, mathOptions).then((node: Element) => {
                mathElement.innerHTML = "";
                mathElement.setAttribute("data-math", math);
                mathElement.append(node);
                window.MathJax.startup.document.clear();
                window.MathJax.startup.document.updateDocument();
                const errorTextElement = node.querySelector('[data-mml-node="merror"]');
                if (errorTextElement && errorTextElement.textContent.trim() !== "") {
                    mathElement.innerHTML = errorTextElement.textContent.trim();
                    mathElement.className = "vditor-reset--error";
                }
                if (next) {
                    next();
                }
            });
        };
        window.MathJax.startup.promise.then(() => {
            const chains: any[] = [];
            for (let i = 0; i < mathElements.length; i++) {
                const mathElement = mathElements[i];
                if (!mathElement.parentElement.classList.contains("vditor-wysiwyg__pre") &&
                    !mathElement.parentElement.classList.contains("vditor-ir__marker--pre") &&
                    !mathElement.getAttribute("data-math") && code160to32(mathElement.textContent).trim()) {
                    chains.push((next: () => void) => {
                        if (i === mathElements.length - 1) {
                            renderMath(mathElement);
                        } else {
                            renderMath(mathElement, next);
                        }
                    });
                }
            }
            chainAsync(chains);
        });
    }
};
