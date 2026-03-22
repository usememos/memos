import { useEffect, useRef } from "react";

interface Props {
  children: React.ReactNode;
  baseSide?: "width" | "height";
  className?: string;
}

const SquareDiv: React.FC<Props> = (props: Props) => {
  const { children, className } = props;
  const baseSide = props.baseSide || "width";
  const squareDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const adjustSquareSize = () => {
      if (!squareDivRef.current) {
        return;
      }

      if (baseSide === "width") {
        const width = squareDivRef.current.clientWidth;
        squareDivRef.current.style.height = width + "px";
      } else {
        const height = squareDivRef.current.clientHeight;
        squareDivRef.current.style.width = height + "px";
      }
    };

    adjustSquareSize();

    window.addEventListener("resize", adjustSquareSize);

    return () => {
      window.removeEventListener("resize", adjustSquareSize);
    };
  }, []);

  return (
    <div ref={squareDivRef} className={`${[baseSide === "width" ? "w-full" : "h-full", className ?? ""].join(" ")}`}>
      {children}
    </div>
  );
};

export default SquareDiv;
