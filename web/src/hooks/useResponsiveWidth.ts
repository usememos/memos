import useWindowSize from "react-use/lib/useWindowSize";

enum TailwindResponsiveWidth {
  sm = 640,
  md = 768,
  lg = 1024,
}

const useResponsiveWidth = () => {
  const { width } = useWindowSize();
  return {
    sm: width >= TailwindResponsiveWidth.sm,
    md: width >= TailwindResponsiveWidth.md,
    lg: width >= TailwindResponsiveWidth.lg,
  };
};

export default useResponsiveWidth;
