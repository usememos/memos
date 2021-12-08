import convertResourceToDataURL from "./convertResourceToDataURL";

async function getCloneStyledElement(element: HTMLElement) {
  const clonedElementContainer = document.createElement(element.tagName);
  clonedElementContainer.innerHTML = element.innerHTML;

  const applyStyles = async (sourceElement: HTMLElement, clonedElement: HTMLElement) => {
    if (!sourceElement || !clonedElement) {
      return;
    }

    const sourceStyles = window.getComputedStyle(sourceElement);

    if (sourceElement.tagName === "IMG") {
      try {
        const url = await convertResourceToDataURL(sourceElement.getAttribute("src") ?? "");
        (clonedElement as HTMLImageElement).src = url;
      } catch (error) {
        // do nth
      }
    }

    for (const item of sourceStyles) {
      clonedElement.style.setProperty(item, sourceStyles.getPropertyValue(item), sourceStyles.getPropertyPriority(item));
    }

    for (let i = 0; i < clonedElement.childElementCount; i++) {
      await applyStyles(sourceElement.children[i] as HTMLElement, clonedElement.children[i] as HTMLElement);
    }
  };

  await applyStyles(element, clonedElementContainer);

  return clonedElementContainer;
}

export default getCloneStyledElement;
