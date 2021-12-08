const cachedResource = new Map<string, string>();

function convertResourceToDataURL(url: string, useCache = true): Promise<string> {
  if (useCache && cachedResource.has(url)) {
    return Promise.resolve(cachedResource.get(url) as string);
  }

  return new Promise(async (resolve) => {
    const res = await fetch(url);
    const blob = await res.blob();
    var reader = new FileReader();
    reader.onloadend = () => {
      const base64Url = reader.result as string;
      cachedResource.set(url, base64Url);
      resolve(base64Url);
    };
    reader.readAsDataURL(blob);
  });
}

export default convertResourceToDataURL;
