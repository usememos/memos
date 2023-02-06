import {Constants} from "../constants";
import {setContentTheme} from "../ui/setContentTheme";
import {addScript, addScriptSync} from "../util/addScript";
import {hasClosestByClassName, hasClosestByMatchTag} from "../util/hasClosest";
import {merge} from "../util/merge";
import {abcRender} from "./abcRender";
import {anchorRender} from "./anchorRender";
import {chartRender} from "./chartRender";
import {codeRender} from "./codeRender";
import {flowchartRender} from "./flowchartRender";
import {graphvizRender} from "./graphvizRender";
import {highlightRender} from "./highlightRender";
import {lazyLoadImageRender} from "./lazyLoadImageRender";
import {mathRender} from "./mathRender";
import {mediaRender} from "./mediaRender";
import {mermaidRender} from "./mermaidRender";
import {markmapRender} from "../markdown/markmapRender";
import {mindmapRender} from "./mindmapRender";
import {plantumlRender} from "./plantumlRender";
import {setLute} from "./setLute";
import {speechRender} from "./speechRender";

const mergeOptions = (options?: IPreviewOptions) => {
    const defaultOption: IPreviewOptions = {
        anchor: 0,
        cdn: Constants.CDN,
        customEmoji: {},
        emojiPath: `${
            (options && options.emojiPath) || Constants.CDN
        }/dist/images/emoji`,
        hljs: Constants.HLJS_OPTIONS,
        icon: "ant",
        lang: "zh_CN",
        markdown: Constants.MARKDOWN_OPTIONS,
        math: Constants.MATH_OPTIONS,
        mode: "light",
        speech: {
            enable: false,
        },
        theme: Constants.THEME_OPTIONS,
    };
    return merge(defaultOption, options);
};

export const md2html = (mdText: string, options?: IPreviewOptions) => {
    const mergedOptions = mergeOptions(options);
    return addScript(`${mergedOptions.cdn}/dist/js/lute/lute.min.js`, "vditorLuteScript").then(() => {
        const lute = setLute({
            autoSpace: mergedOptions.markdown.autoSpace,
            codeBlockPreview: mergedOptions.markdown.codeBlockPreview,
            emojiSite: mergedOptions.emojiPath,
            emojis: mergedOptions.customEmoji,
            fixTermTypo: mergedOptions.markdown.fixTermTypo,
            footnotes: mergedOptions.markdown.footnotes,
            headingAnchor: mergedOptions.anchor !== 0,
            inlineMathDigit: mergedOptions.math.inlineDigit,
            lazyLoadImage: mergedOptions.lazyLoadImage,
            linkBase: mergedOptions.markdown.linkBase,
            linkPrefix: mergedOptions.markdown.linkPrefix,
            listStyle: mergedOptions.markdown.listStyle,
            mark: mergedOptions.markdown.mark,
            mathBlockPreview: mergedOptions.markdown.mathBlockPreview,
            paragraphBeginningSpace: mergedOptions.markdown.paragraphBeginningSpace,
            sanitize: mergedOptions.markdown.sanitize,
            toc: mergedOptions.markdown.toc,
        });
        if (options?.renderers) {
            lute.SetJSRenderers({
                renderers: {
                    Md2HTML: options.renderers,
                },
            });
        }
        lute.SetHeadingID(true);
        return lute.Md2HTML(mdText);
    });
};

export const previewRender = async (previewElement: HTMLDivElement, markdown: string, options?: IPreviewOptions) => {
    const mergedOptions: IPreviewOptions = mergeOptions(options);
    let html = await md2html(markdown, mergedOptions);
    if (mergedOptions.transform) {
        html = mergedOptions.transform(html);
    }
    previewElement.innerHTML = html;
    previewElement.classList.add("vditor-reset");

    if (!mergedOptions.i18n) {
        if (!["en_US", "ja_JP", "ko_KR", "ru_RU", "zh_CN", "zh_TW"].includes(mergedOptions.lang)) {
            throw new Error(
                "options.lang error, see https://ld246.com/article/1549638745630#options",
            );
        } else {
            const i18nScriptPrefix = "vditorI18nScript";
            const i18nScriptID = i18nScriptPrefix + mergedOptions.lang;
            document.querySelectorAll(`head script[id^="${i18nScriptPrefix}"]`).forEach((el) => {
                if (el.id !== i18nScriptID) {
                    document.head.removeChild(el);
                }
            });
            await addScript(`${mergedOptions.cdn}/dist/js/i18n/${mergedOptions.lang}.js`, i18nScriptID);
        }
    } else {
        window.VditorI18n = mergedOptions.i18n;
    }

    if (mergedOptions.icon) {
        await addScript(`${mergedOptions.cdn}/dist/js/icons/${mergedOptions.icon}.js`, "vditorIconScript");
    }

    setContentTheme(mergedOptions.theme.current, mergedOptions.theme.path);
    if (mergedOptions.anchor === 1) {
        previewElement.classList.add("vditor-reset--anchor");
    }
    codeRender(previewElement);
    highlightRender(mergedOptions.hljs, previewElement, mergedOptions.cdn);
    mathRender(previewElement, {
        cdn: mergedOptions.cdn,
        math: mergedOptions.math,
    });
    mermaidRender(previewElement, mergedOptions.cdn, mergedOptions.mode);
    markmapRender(previewElement, mergedOptions.cdn, mergedOptions.mode);
    flowchartRender(previewElement, mergedOptions.cdn);
    graphvizRender(previewElement, mergedOptions.cdn);
    chartRender(previewElement, mergedOptions.cdn, mergedOptions.mode);
    mindmapRender(previewElement, mergedOptions.cdn, mergedOptions.mode);
    plantumlRender(previewElement, mergedOptions.cdn);
    abcRender(previewElement, mergedOptions.cdn);
    mediaRender(previewElement);
    if (mergedOptions.speech.enable) {
        speechRender(previewElement);
    }
    if (mergedOptions.anchor !== 0) {
        anchorRender(mergedOptions.anchor);
    }
    if (mergedOptions.after) {
        mergedOptions.after();
    }
    if (mergedOptions.lazyLoadImage) {
        lazyLoadImageRender(previewElement);
    }
    previewElement.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
        const spanElement = hasClosestByMatchTag(event.target, "SPAN");
        if (spanElement && hasClosestByClassName(spanElement, "vditor-toc")) {
            const headingElement =
                previewElement.querySelector("#" + spanElement.getAttribute("data-target-id")) as HTMLElement;
            if (headingElement) {
                window.scrollTo(window.scrollX, headingElement.offsetTop);
            }
            return;
        }
    });
};
