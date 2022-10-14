import { escape } from "lodash-es";
import hljs from "highlight.js";

export const CODE_BLOCK_REG = /^```(\S*?)\s([\s\S]*?)```(\n?)/;

const renderer = (rawStr: string): string => {
  const matchResult = rawStr.match(CODE_BLOCK_REG);
  if (!matchResult) {
    return rawStr;
  }

  const language = escape(matchResult[1]) || "plaintext";
  let highlightedCode = hljs.highlightAuto(matchResult[2]).value;

  try {
    const temp = hljs.highlight(matchResult[2], {
      language,
    }).value;
    highlightedCode = temp;
  } catch (error) {
    // do nth
  }

  return `<pre><code class="language-${language}">${highlightedCode}</code></pre>${matchResult[3]}`;
};

export default {
  name: "code block",
  regex: CODE_BLOCK_REG,
  renderer,
};
