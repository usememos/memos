import { cn } from "@/lib/utils";
import InkIllustration, { type InkScene } from "./InkIllustration";

interface PlaceholderProps {
  scene: InkScene;
  message: string;
  className?: string;
}

const Placeholder = ({ scene, message, className }: PlaceholderProps) => (
  <div className={cn("mx-auto flex max-w-md flex-col items-center justify-center px-4 py-8 text-center", className)}>
    <div className="w-full max-w-80 shrink-0">
      <InkIllustration scene={scene} />
    </div>
    <p className="mt-1 text-sm text-muted-foreground">{message}</p>
  </div>
);

export default Placeholder;
