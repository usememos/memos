import { useEffect } from 'react';

export default function useScrollTop(threshold = 400, onVisibilityChange?: (isVisible: boolean) => void) {
    useEffect(() => {
        const handleScroll = () => {
            const shouldShow = window.scrollY > threshold;
            onVisibilityChange?.(shouldShow);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [threshold, onVisibilityChange]);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    return { scrollToTop };
}