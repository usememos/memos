import { createElement } from "react";
import { cn } from "@/lib/utils";
import { isTrustedIframeSrc } from "./constants";

export const TrustedIframe = (props: React.ComponentProps<"iframe">) => {
  if (typeof props.src !== "string" || !isTrustedIframeSrc(props.src)) {
    return null;
  }

  return createElement("iframe", {
    ...props,
    className: cn("max-w-full rounded-lg border border-border", props.className),
  });
};
