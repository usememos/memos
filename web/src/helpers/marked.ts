const CODE_BLOCK_REG = /```([\s\S]*?)```/g;
const BOLD_TEXT_REG = /\*\*(.+?)\*\*/g;
const EM_TEXT_REG = /\*(.+?)\*/g;
export const TODO_BLOCK_REG = /- \[ \] /g;
export const DONE_BLOCK_REG = /- \[x\] /g;
const DOT_LI_REG = /[*-] /g;
const NUM_LI_REG = /(\d+)\. /g;

const parseMarkedToHtml = (markedStr: string): string => {
  const htmlText = markedStr
    .replace(/([\u4e00-\u9fa5])([A-Za-z0-9?.,;[\]]+)/g, "$1 $2")
    .replace(/([A-Za-z0-9?.,;[\]]+)([\u4e00-\u9fa5])/g, "$1 $2")
    .replace(CODE_BLOCK_REG, "<pre lang=''>$1</pre>")
    .replace(TODO_BLOCK_REG, "<span class='todo-block' data-value='TODO'>⬜</span>")
    .replace(DONE_BLOCK_REG, "<span class='todo-block' data-value='DONE'>✅</span>")
    .replace(DOT_LI_REG, "<span class='counter-block'>•</span>")
    .replace(NUM_LI_REG, "<span class='counter-block'>$1.</span>")
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

export { parseMarkedToHtml, parseHtmlToRawText };
