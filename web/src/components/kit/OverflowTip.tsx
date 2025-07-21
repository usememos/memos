import { useRef, useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div ref={textElementRef} className={cn("truncate", className)}>
            {children}
          </div>
        </TooltipTrigger>
        {isOverflowed && (
          <TooltipContent>
            <p>{children}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
};

export default OverflowTip;
