import convertResourceToDataURL from "./convertResourceToDataURL";

const getFontsStyleElement = async (element: HTMLElement) => {
  const styleSheets = element.ownerDocument.styleSheets;
  const fontFamilyStyles: CSSStyleDeclaration[] = [];

  for (const sheet of styleSheets) {
    for (const rule of sheet.cssRules) {
      if (rule.constructor.name === "CSSFontFaceRule") {
        fontFamilyStyles.push((rule as CSSFontFaceRule).style);
      }
    }
  }

  const styleElement = document.createElement("style");

  for (const f of fontFamilyStyles) {
    const fontFamily = f.getPropertyValue("font-family");
    const fontWeight = f.getPropertyValue("font-weight");
    const src = f.getPropertyValue("src");
    const resourceUrls = src.split(",").map((s) => {
      return s.replace(/url\("?(.+?)"?\)/, "$1");
    });
    let base64Urls = [];

    for (const url of resourceUrls) {
      try {
        const base64Url = await convertResourceToDataURL(url);
        base64Urls.push(`url("${base64Url}")`);
      } catch (error) {
        // do nth
      }
    }

    styleElement.innerHTML += `
      @font-face {
        font-family: "${fontFamily}";
        src: ${base64Urls.join(",")};
        font-weight: ${fontWeight};
      }`;
  }

  return styleElement;
};

export default getFontsStyleElement;
