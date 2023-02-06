import {Constants} from "../constants";
import {addStyle} from "../util/addStyle";

export const setCodeTheme = (codeTheme: string, cdn = Constants.CDN) => {
    if (!Constants.CODE_THEME.includes(codeTheme)) {
        codeTheme = "github";
    }
    const vditorHljsStyle = document.getElementById("vditorHljsStyle") as HTMLLinkElement;
    const href = `${cdn}/dist/js/highlight.js/styles/${codeTheme}.css`;
    if (!vditorHljsStyle) {
        addStyle(href, "vditorHljsStyle");
    } else if (vditorHljsStyle.href !== href) {
        vditorHljsStyle.remove();
        addStyle(href, "vditorHljsStyle");
    }
};
