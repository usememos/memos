/**
 * HTML to Image
 *
 * References:
 * 1. html-to-image: https://github.com/bubkoo/html-to-image
 * 2. <foreignObject>: https://developer.mozilla.org/en-US/docs/Web/SVG/Element/foreignObject
 */
import convertResourceToDataURL from "./convertResourceToDataURL";
import getCloneStyledElement from "./getCloneStyledElement";

type Options = Partial<{
  backgroundColor: string;
  pixelRatio: number;
}>;

function getElementSize(element: HTMLElement) {
  const { width, height } = window.getComputedStyle(element);

  return {
    width: parseInt(width.replace("px", "")),
    height: parseInt(height.replace("px", "")),
  };
}

function convertSVGToDataURL(svg: SVGElement): string {
  const xml = new XMLSerializer().serializeToString(svg);
  const url = encodeURIComponent(xml);
  return `data:image/svg+xml;charset=utf-8,${url}`;
}

function generateSVGElement(width: number, height: number, element: HTMLElement): SVGSVGElement {
  const xmlns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(xmlns, "svg");

  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  const foreignObject = document.createElementNS(xmlns, "foreignObject");

  foreignObject.setAttribute("width", "100%");
  foreignObject.setAttribute("height", "100%");
  foreignObject.setAttribute("x", "0");
  foreignObject.setAttribute("y", "0");
  foreignObject.setAttribute("externalResourcesRequired", "true");

  foreignObject.appendChild(element);
  svg.appendChild(foreignObject);

  return svg;
}

// TODO need rethink how to get the needed font-family
async function getFontsStyleElement() {
  const styleElement = document.createElement("style");

  const fonts = [
    {
      name: "DINPro",
      url: "/fonts/DINPro-Regular.otf",
      weight: "normal",
    },
    {
      name: "DINPro",
      url: "/fonts/DINPro-Bold.otf",
      weight: "bold",
    },
    {
      name: "ubuntu-mono",
      url: "/fonts/UbuntuMono.ttf",
      weight: "normal",
    },
  ];

  for (const f of fonts) {
    const base64Url = await convertResourceToDataURL(f.url);
    styleElement.innerHTML += `
      @font-face {
        font-family: "${f.name}";
        src: url("${base64Url}");
        font-weight: ${f.weight};
      }`;
  }

  return styleElement;
}

export async function toSVG(element: HTMLElement, options?: Options) {
  const { width, height } = getElementSize(element);

  const clonedElement = await getCloneStyledElement(element);

  if (options?.backgroundColor) {
    clonedElement.style.backgroundColor = options.backgroundColor;
  }

  const svg = generateSVGElement(width, height, clonedElement);
  svg.prepend(await getFontsStyleElement());

  const url = convertSVGToDataURL(svg);

  return url;
}

export async function toCanvas(element: HTMLElement, options?: Options): Promise<HTMLCanvasElement> {
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
}

async function toImage(element: HTMLElement, options?: Options) {
  const canvas = await toCanvas(element, options);

  return canvas.toDataURL();
}

export default toImage;
