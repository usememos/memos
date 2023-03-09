import React from "react";
import { toast } from "react-hot-toast";
import copy from "copy-to-clipboard";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";

interface Props extends DialogProps {
  memoId: MemoId;
}

const EmbedMemoDialog: React.FC<Props> = (props: Props) => {
  const { memoId, destroy } = props;

  const memoEmbeddedCode = () => {
    return `<iframe style="width:100%;height:auto;min-width:256px;" src="${window.location.origin}/m/${memoId}/embed" frameBorder="0"></iframe>`;
  };

  const handleCopyCode = () => {
    copy(memoEmbeddedCode());
    toast.success("Succeed to copy code to clipboard.");
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">Embed Memo</p>
        <button className="btn close-btn" onClick={() => destroy()}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container !w-80">
        <p className="text-base leading-6 mb-2">Copy and paste the below codes into your blog or website.</p>
        <pre className="w-full font-mono text-sm p-3 border rounded-lg">
          <code className="w-full break-all whitespace-pre-wrap">{memoEmbeddedCode()}</code>
        </pre>
        <p className="w-full text-sm leading-6 flex flex-row justify-between items-center mt-2">
          <span className="italic opacity-80">* Only the public memo supports.</span>
          <span className="btn-primary" onClick={handleCopyCode}>
            Copy
          </span>
        </p>
      </div>
    </>
  );
};

function showEmbedMemoDialog(memoId: MemoId) {
  generateDialog(
    {
      className: "embed-memo-dialog",
      dialogName: "embed-memo-dialog",
    },
    EmbedMemoDialog,
    {
      memoId,
    }
  );
}

export default showEmbedMemoDialog;
