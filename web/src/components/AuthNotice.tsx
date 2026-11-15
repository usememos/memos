import { CircleAlertIcon, InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// A line inside the card that the visitor should read before acting: why a form failed, or why they landed here.
const AuthNotice = ({ tone = "info", children, className }: { tone?: "info" | "error"; children: React.ReactNode; className?: string }) => {
  const Icon = tone === "error" ? CircleAlertIcon : InfoIcon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-mu-md px-2.5 py-2 mu-caption",
        tone === "error" ? "bg-mu-danger-soft text-mu-danger" : "bg-mu-hover text-mu-text-secondary",
        className,
      )}
    >
      <Icon className="mu-icon-sm mt-0.5 shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
};

export default AuthNotice;
