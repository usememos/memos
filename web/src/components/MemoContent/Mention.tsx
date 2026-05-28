import type { Element } from "hast";
import { cn } from "@/lib/utils";

interface MentionProps extends React.HTMLAttributes<HTMLSpanElement> {
  node?: Element;
  "data-mention"?: string;
  children?: React.ReactNode;
  resolved?: boolean;
}

export const Mention: React.FC<MentionProps> = ({
  "data-mention": dataMention,
  children,
  className,
  node: _node,
  resolved = false,
  ...props
}) => {
  const username = dataMention || "";

  if (!resolved) {
    return (
      <span data-mention={username} title={`@${username}`} className={className} {...props}>
        {children}
      </span>
    );
  }

  return (
    <a
      href={`/u/${username}`}
      className={cn("text-blue-600 underline-offset-2 hover:underline dark:text-blue-400", className)}
      data-mention={username}
      title={`@${username}`}
      {...props}
    >
      {children}
    </a>
  );
};
