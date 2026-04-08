import { createElement } from "react";
import { isTrustedIframeSrc } from "./constants";

export const TrustedIframe = (props: React.ComponentProps<"iframe">) => {
  if (typeof props.src !== "string" || !isTrustedIframeSrc(props.src)) {
    return null;
  }

  return createElement("iframe", props);
};
