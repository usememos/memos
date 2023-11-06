import { Tooltip } from "@mui/joy";
import classNames from "classnames";
import { useRef, useState, useEffect } from "react";

interface Props {
  children: React.ReactNode;
  className?: string;
}

const OverflowTip = ({ children, className }: Props) => {
  const [isOverflowed, setIsOverflow] = useState(false);
  const textElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!textElementRef.current) {
      return;
    }

    setIsOverflow(textElementRef.current.scrollWidth > textElementRef.current.clientWidth);
  }, []);

  return (
    <Tooltip title={children} placement="top" arrow disableHoverListener={!isOverflowed}>
      <div ref={textElementRef} className={classNames("truncate", className)}>
        {children}
      </div>
    </Tooltip>
  );
};

export default OverflowTip;
