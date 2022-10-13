export const isNullorUndefined = (value: any) => {
  return value === null || value === undefined;
};

export function getNowTimeStamp(): number {
  return Date.now();
}

export function getOSVersion(): "Windows" | "MacOS" | "Linux" | "Unknown" {
  const appVersion = navigator.userAgent;
  let detectedOS: "Windows" | "MacOS" | "Linux" | "Unknown" = "Unknown";

  if (appVersion.indexOf("Win") != -1) {
    detectedOS = "Windows";
  } else if (appVersion.indexOf("Mac") != -1) {
    detectedOS = "MacOS";
  } else if (appVersion.indexOf("Linux") != -1) {
    detectedOS = "Linux";
  }

  return detectedOS;
}

export function getTimeStampByDate(t: Date | number | string): number {
  if (typeof t === "string") {
    t = t.replaceAll("-", "/");
  }
  const d = new Date(t);

  return d.getTime();
}

export function getDateStampByDate(t: Date | number | string): number {
  const d = new Date(getTimeStampByDate(t));

  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function getDateString(t: Date | number | string): string {
  const d = new Date(getTimeStampByDate(t));

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();

  return `${year}/${month}/${date}`;
}

export function getTimeString(t: Date | number | string): string {
  const d = new Date(getTimeStampByDate(t));

  const hours = d.getHours();
  const mins = d.getMinutes();

  const hoursStr = hours < 10 ? "0" + hours : hours;
  const minsStr = mins < 10 ? "0" + mins : mins;

  return `${hoursStr}:${minsStr}`;
}

// For example: 2021-4-8 17:52:17
export function getDateTimeString(t: Date | number | string): string {
  const d = new Date(getTimeStampByDate(t));

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const hours = d.getHours();
  const mins = d.getMinutes();
  const secs = d.getSeconds();

  const monthStr = month < 10 ? "0" + month : month;
  const dateStr = date < 10 ? "0" + date : date;
  const hoursStr = hours < 10 ? "0" + hours : hours;
  const minsStr = mins < 10 ? "0" + mins : mins;
  const secsStr = secs < 10 ? "0" + secs : secs;

  return `${year}/${monthStr}/${dateStr} ${hoursStr}:${minsStr}:${secsStr}`;
}

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

    if (window.getComputedStyle(element).getPropertyValue("position") === "fixed") {
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

export const parseHTMLToRawText = (htmlStr: string): string => {
  const tempEl = document.createElement("div");
  tempEl.className = "memo-content-text";
  tempEl.innerHTML = htmlStr;
  const text = tempEl.innerText;
  return text;
};

export function closeSidebar() {
  const sidebarEl = document.body.querySelector(".sidebar-wrapper") as HTMLDivElement;
  const maskEl = document.body.querySelector(".mask") as HTMLDivElement;
  sidebarEl.classList.replace("open-sidebar", "close-sidebar");
  maskEl.classList.replace("show-mask", "hide-mask");
}
