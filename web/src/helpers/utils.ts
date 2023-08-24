export const isNullorUndefined = (value: any) => {
  return value === null || value === undefined;
};

export const getElementBounding = (element: HTMLElement, relativeEl?: HTMLElement) => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || document.body.scrollLeft;

  relativeEl = relativeEl || document.body;

  const elementRect = element.getBoundingClientRect();
  const relativeElRect = relativeEl.getBoundingClientRect();
  const relativeElPosition = window.getComputedStyle(relativeEl).getPropertyValue("position");

  const bounding = {
    width: elementRect.width,
    height: elementRect.height,
  };

  if ((relativeEl.tagName !== "BODY" && relativeElPosition === "relative") || relativeElPosition === "sticky") {
    return Object.assign(bounding, {
      top: elementRect.top - relativeElRect.top,
      left: elementRect.left - relativeElRect.left,
    });
  }

  const isElementFixed = (element: HTMLElement): boolean => {
    const parentNode = element.parentNode;

    if (!parentNode || parentNode.nodeName === "HTML") {
      return false;
    }

    const position = window.getComputedStyle(element).getPropertyValue("position");
    if (position === "fixed" || position === "static") {
      return true;
    }

    return isElementFixed(parentNode as HTMLElement);
  };

  if (isElementFixed(element)) {
    return Object.assign(bounding, {
      top: elementRect.top,
      left: elementRect.left,
    });
  }

  return Object.assign(bounding, {
    top: elementRect.top + scrollTop,
    left: elementRect.left + scrollLeft,
  });
};

export function absolutifyLink(rel: string): string {
  const anchor = document.createElement("a");
  anchor.setAttribute("href", rel);
  return anchor.href;
}

export function getSystemColorScheme() {
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  } else {
    return "light";
  }
}

export function convertFileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result?.toString() || "");
    reader.onerror = (error) => reject(error);
  });
}

export const formatBytes = (bytes: number) => {
  if (bytes <= 0) return "0 Bytes";
  const k = 1024,
    dm = 2,
    sizes = ["Bytes", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"],
    i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

export const clearContentQueryParam = () => {
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.delete("content");
  let url = window.location.pathname;
  if (urlParams.toString()) {
    url += `?${urlParams.toString()}`;
  }
  window.history.replaceState({}, "", url);
};
