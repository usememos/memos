import {addStyle} from "../util/addStyle";

export const setContentTheme = (contentTheme: string, path: string) => {
    if (!contentTheme || !path) {
        return;
    }
    const vditorContentTheme = document.getElementById("vditorContentTheme") as HTMLLinkElement;
    const cssPath = `${path}/${contentTheme}.css`;
    if (!vditorContentTheme) {
        addStyle(cssPath, "vditorContentTheme");
    } else if (vditorContentTheme.getAttribute("href") !== cssPath) {
        vditorContentTheme.remove();
        addStyle(cssPath, "vditorContentTheme");
    }
};
