/**
 * HTML to Image
 *
 * References:
 * 1. html-to-image: https://github.com/bubkoo/html-to-image
 * 2. <foreignObject>: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/foreignObject
 */
import getCloneStyledElement from "./getCloneStyledElement";
import getFontsStyleElement from "./getFontsStyleElement";

type Options = Partial<{
  backgroundColor: string;
  pixelRatio: number;
}>;

const getElementSize = (element: HTMLElement) => {
  const { width, height } = window.getComputedStyle(element);

  return {
    width: parseInt(width.replace("px", "")),
    height: parseInt(height.replace("px", "")),
  };
};

const convertSVGToDataURL = (svg: SVGElement): string => {
  const xml = new XMLSerializer().serializeToString(svg);
  const url = encodeURIComponent(xml);
  return `data:image/svg+xml;charset=utf-8,${url}`;
};

const generateSVGElement = (width: number, height: number, element: HTMLElement): SVGSVGElement => {
  const xmlNS = "http://www.w3.org/2000/svg";
  const svgElement = document.createElementNS(xmlNS, "svg");

  svgElement.setAttribute("width", `${width}`);
  svgElement.setAttribute("height", `${height}`);
  svgElement.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const foreignObject = document.createElementNS(xmlNS, "foreignObject");

  foreignObject.setAttribute("width", "100%");
  foreignObject.setAttribute("height", "100%");
  foreignObject.setAttribute("x", "0");
  foreignObject.setAttribute("y", "0");
  foreignObject.setAttribute("externalResourcesRequired", "true");

  foreignObject.appendChild(element);
  svgElement.appendChild(foreignObject);

  return svgElement;
};

export const toSVG = async (element: HTMLElement, options?: Options) => {
  const { width, height } = getElementSize(element);

  const clonedElement = await getCloneStyledElement(element);

  if (options?.backgroundColor) {
    clonedElement.style.backgroundColor = options.backgroundColor;
  }

  const svg = generateSVGElement(width, height, clonedElement);
  svg.prepend(await getFontsStyleElement(element));

  const url = convertSVGToDataURL(svg);

  return url;
};

export const toCanvas = async (element: HTMLElement, options?: Options): Promise<HTMLCanvasElement> => {
  const url = await toSVG(element, options);

  const imageEl = new Image();
  imageEl.src = url;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d")!;
  const ratio = options?.pixelRatio || 1;
  const { width, height } = getElementSize(element);

  canvas.width = width * ratio;
  canvas.height = height * ratio;

  canvas.style.width = `${width}`;
  canvas.style.height = `${height}`;

  if (options?.backgroundColor) {
    context.fillStyle = options.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  return new Promise((resolve) => {
    imageEl.onload = () => {
      context.drawImage(imageEl, 0, 0, canvas.width, canvas.height);

      resolve(canvas);
    };
  });
};

const toImage = async (element: HTMLElement, options?: Options) => {
  const canvas = await toCanvas(element, options);

  return canvas.toDataURL();
};

export default toImage;
