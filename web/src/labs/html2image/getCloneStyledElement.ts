import convertResourceToDataURL from "./convertResourceToDataURL";

const applyStyles = async (sourceElement: HTMLElement, clonedElement: HTMLElement) => {
  if (!sourceElement || !clonedElement) {
    return;
  }

  if (sourceElement.tagName === "IMG") {
    const url = sourceElement.getAttribute("src") ?? "";
    let covertFailed = false;
    try {
      (clonedElement as HTMLImageElement).src = await convertResourceToDataURL(url);
    } catch (error) {
      covertFailed = true;
    }
    if (covertFailed) {
      throw new Error(`Failed to convert image to data URL: ${url}`);
    }
  }

  const sourceStyles = window.getComputedStyle(sourceElement);
  for (const item of sourceStyles) {
    clonedElement.style.setProperty(item, sourceStyles.getPropertyValue(item), sourceStyles.getPropertyPriority(item));
  }

  for (let i = 0; i < clonedElement.childElementCount; i++) {
    await applyStyles(sourceElement.children[i] as HTMLElement, clonedElement.children[i] as HTMLElement);
  }
};

const getCloneStyledElement = async (element: HTMLElement) => {
  const clonedElementContainer = document.createElement(element.tagName);
  clonedElementContainer.innerHTML = element.innerHTML;

  await applyStyles(element, clonedElementContainer);

  return clonedElementContainer;
};

export default getCloneStyledElement;
