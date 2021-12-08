/**
 * 实现一个简易版的 markdown 解析
 * - 列表解析；
 * - 代码块；
 * - 加粗/斜体；
 * - TODO;
 */
import Prism from "prismjs";

const CODE_BLOCK_REG = /```([\s\S]*?)```/g;
const BOLD_TEXT_REG = /\*\*(.+?)\*\*/g;
const EM_TEXT_REG = /\*(.+?)\*/g;
const TODO_BLOCK_REG = /\[ \] /g;
const DONE_BLOCK_REG = /\[x\] /g;
const DOT_LI_REG = /[*] /g;
const NUM_LI_REG = /(\d+)\. /g;

const getCodeLanguage = (codeStr: string): string => {
  const execRes = /^\w+/g.exec(codeStr);

  if (execRes !== null) {
    return execRes[0];
  }

  return "javascript";
};

const parseCodeToPrism = (codeStr: string): string => {
  return codeStr.replace(CODE_BLOCK_REG, (_, matchedStr): string => {
    const lang = getCodeLanguage(matchedStr);
    let convertedStr = matchedStr
      .replace(lang, "")
      .replace(/<p>/g, "")
      .replace(/<\/p>/g, "\r\n")
      .replace(/<br>/g, "\r\n")
      .replace(/&nbsp;/g, " ");

    // 特定语言处理
    switch (lang) {
      case "html":
        convertedStr = convertedStr.replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    }

    try {
      const resultStr = Prism.highlight(convertedStr, Prism.languages[lang], lang);
      return `<pre>${resultStr}</pre>`;
    } catch (error) {
      // do nth
    }

    return `<pre>${codeStr}</pre>`;
  });
};

const parseMarkedToHtml = (markedStr: string): string => {
  const htmlText = parseCodeToPrism(markedStr)
    .replace(DOT_LI_REG, "<span class='counter-block'>•</span>")
    .replace(NUM_LI_REG, "<span class='counter-block'>$1.</span>")
    .replace(TODO_BLOCK_REG, "<span class='todo-block' data-type='todo'>⬜</span>")
    .replace(DONE_BLOCK_REG, "<span class='todo-block' data-type='done'>✅</span>")
    .replace(BOLD_TEXT_REG, "<strong>$1</strong>")
    .replace(EM_TEXT_REG, "<em>$1</em>");

  return htmlText;
};

const parseHtmlToRawText = (htmlStr: string): string => {
  const tempEl = document.createElement("div");
  tempEl.className = "memo-content-text";
  tempEl.innerHTML = htmlStr;
  const text = tempEl.innerText;
  return text;
};

const parseRawTextToHtml = (rawTextStr: string): string => {
  const htmlText = rawTextStr.replace(/\n/g, "<br>");
  return htmlText;
};

const encodeHtml = (htmlStr: string): string => {
  const t = document.createElement("div");
  t.textContent = htmlStr;
  return t.innerHTML;
};

export { encodeHtml, parseMarkedToHtml, parseHtmlToRawText, parseRawTextToHtml };
