import {removeCurrentToolbar} from "../toolbar/setToolbar";
import {setCurrentToolbar} from "../toolbar/setToolbar";

export const setPreviewMode = (mode: "both" | "editor", vditor: IVditor) => {
    if (vditor.options.preview.mode === mode) {
        return;
    }
    vditor.options.preview.mode = mode;

    switch (mode) {
        case "both":
            vditor.sv.element.style.display = "block";
            vditor.preview.element.style.display = "block";
            vditor.preview.render(vditor);

            setCurrentToolbar(vditor.toolbar.elements, ["both"]);
            break;
        case "editor":
            vditor.sv.element.style.display = "block";
            vditor.preview.element.style.display = "none";

            removeCurrentToolbar(vditor.toolbar.elements, ["both"]);
            break;
        default:
            break;
    }

    if (vditor.devtools) {
        vditor.devtools.renderEchart(vditor);
    }
};
