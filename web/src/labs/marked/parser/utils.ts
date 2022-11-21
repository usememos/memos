export const renderWithHighlightWord = (result: string, highlightWord: string | undefined) => {
  if (highlightWord) {
    const highlightReg = RegExp(highlightWord, "g");
    result = result.replace(highlightReg, `<span class="highlight-word">${highlightWord}</span>`);
  }
  return result;
};
