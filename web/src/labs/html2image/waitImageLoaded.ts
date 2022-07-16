const waitImageLoaded = (image: HTMLImageElement, url: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    image.loading = "eager";
    image.onload = () => {
      // NOTE: There is image loading problem in Safari, fix it with some trick
      setTimeout(() => {
        resolve();
      }, 200);
    };
    image.onerror = () => {
      reject("Image load failed");
    };
    image.src = url;
  });
};

export default waitImageLoaded;
