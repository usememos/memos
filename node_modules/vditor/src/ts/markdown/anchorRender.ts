export const anchorRender = (type: number) => {
    document.querySelectorAll(".vditor-anchor").forEach((anchor: HTMLLinkElement) => {
        if (type === 1) {
            anchor.classList.add("vditor-anchor--left");
        }
        anchor.onclick = () => {
            const id = anchor.getAttribute("href").substr(1);
            const top = document.getElementById("vditorAnchor-" + id).offsetTop;
            document.querySelector("html").scrollTop = top;
        };
    });

    window.onhashchange = () => {
        const element = document.getElementById("vditorAnchor-" + decodeURIComponent(window.location.hash.substr(1)));
        if (element) {
            document.querySelector("html").scrollTop = element.offsetTop;
        }
    };
};
