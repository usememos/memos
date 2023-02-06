declare global {
    interface Window {
        vditorImageIntersectionObserver: IntersectionObserver;
    }
}

export const lazyLoadImageRender = (element: (HTMLElement | Document) = document) => {
    const loadImg = (it: HTMLImageElement) => {
        const testImage = document.createElement("img");
        testImage.src = it.getAttribute("data-src");
        testImage.addEventListener("load", () => {
            if (!it.getAttribute("style") && !it.getAttribute("class") &&
                !it.getAttribute("width") && !it.getAttribute("height")) {
                if (testImage.naturalHeight > testImage.naturalWidth &&
                    testImage.naturalWidth / testImage.naturalHeight <
                    document.querySelector(".vditor-reset").clientWidth / (window.innerHeight - 40) &&
                    testImage.naturalHeight > (window.innerHeight - 40)) {
                    it.style.height = (window.innerHeight - 40) + "px";
                }
            }

            it.src = testImage.src;
        });
        it.removeAttribute("data-src");
    };

    if (!("IntersectionObserver" in window)) {
        element.querySelectorAll("img").forEach((imgElement: HTMLImageElement) => {
            if (imgElement.getAttribute("data-src")) {
                loadImg(imgElement);
            }
        });
        return false;
    }

    if (window.vditorImageIntersectionObserver) {
        window.vditorImageIntersectionObserver.disconnect();
        element.querySelectorAll("img").forEach((imgElement) => {
            window.vditorImageIntersectionObserver.observe(imgElement);
        });
    } else {
        window.vditorImageIntersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach((entrie: IntersectionObserverEntry & { target: HTMLImageElement }) => {
                if ((typeof entrie.isIntersecting === "undefined"
                    ? entrie.intersectionRatio !== 0
                    : entrie.isIntersecting)
                    && entrie.target.getAttribute("data-src")) {
                    loadImg(entrie.target);
                }
            });
        });
        element.querySelectorAll("img").forEach((imgElement) => {
            window.vditorImageIntersectionObserver.observe(imgElement);
        });
    }
};
