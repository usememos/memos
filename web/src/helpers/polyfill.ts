(() => {
  if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (str: any, newStr: any) {
      // If a regex pattern
      if (Object.prototype.toString.call(str).toLowerCase() === "[object regexp]") {
        return this.replace(str, newStr);
      }

      // If a string
      return this.replace(new RegExp(str, "g"), newStr);
    };
  }
})();

export default null;
