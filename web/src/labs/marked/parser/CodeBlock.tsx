import copy from "copy-to-clipboard";
import hljs from "highlight.js";
import { useTranslation } from "react-i18next";
import { matcher } from "../matcher";
import toastHelper from "../../../components/Toast";

export const CODE_BLOCK_REG = /^```(\S*?)\s([\s\S]*?)```/;

const renderer = (rawStr: string) => {
  const { t } = useTranslation();
  const matchResult = matcher(rawStr, CODE_BLOCK_REG);
  if (!matchResult) {
    return <>{rawStr}</>;
  }

  const language = matchResult[1] || "plaintext";
  let highlightedCode = hljs.highlightAuto(matchResult[2]).value;

  try {
    const temp = hljs.highlight(matchResult[2], {
      language,
    }).value;
    highlightedCode = temp;
  } catch (error) {
    // do nth
  }

  const handleCopyButtonClick = () => {
    copy(matchResult[2]);
    toastHelper.success(t("message.succeed-copy-code"));
  };

  return (
    <pre>
      <button
        className="text-xs font-mono italic absolute top-0 right-0 px-2 leading-6 border btn-text rounded opacity-60"
        onClick={handleCopyButtonClick}
      >
        copy
      </button>
      <code className={`language-${language}`} dangerouslySetInnerHTML={{ __html: highlightedCode }}></code>
    </pre>
  );
};

export default {
  name: "code block",
  regexp: CODE_BLOCK_REG,
  renderer,
};
