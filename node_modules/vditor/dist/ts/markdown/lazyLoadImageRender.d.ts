declare global {
    interface Window {
        vditorImageIntersectionObserver: IntersectionObserver;
    }
}
export declare const lazyLoadImageRender: (element?: (HTMLElement | Document)) => boolean;
