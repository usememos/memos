import { useContext } from "react";
import appContext from "../stores/appContext";
import { globalStateService, memoService } from "../services";
import utils from "../helpers/utils";
import { formatMemoContent } from "./Memo";
import toastHelper from "./Toast";
import "../less/preferences-section.less";

interface Props {}

const PreferencesSection: React.FC<Props> = () => {
  const { globalState } = useContext(appContext);
  const { shouldHideImageUrl, shouldSplitMemoWord, shouldUseMarkdownParser } = globalState;

  const demoMemoContent = "👋 Hiya, welcome to memos!\n* ✨ **Open source project**;\n* 😋 What do you think;\n* 📑 Tell me something plz;";

  const handleSplitWordsValueChanged = () => {
    globalStateService.setAppSetting({
      shouldSplitMemoWord: !shouldSplitMemoWord,
    });
  };

  const handleHideImageUrlValueChanged = () => {
    globalStateService.setAppSetting({
      shouldHideImageUrl: !shouldHideImageUrl,
    });
  };

  const handleUseMarkdownParserChanged = () => {
    globalStateService.setAppSetting({
      shouldUseMarkdownParser: !shouldUseMarkdownParser,
    });
  };

  const handleExportBtnClick = async () => {
    const formatedMemos = memoService.getState().memos.map((m) => {
      return {
        content: m.content,
        createdAt: m.createdAt,
      };
    });

    const jsonStr = JSON.stringify(formatedMemos);
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/json;charset=utf-8," + encodeURIComponent(jsonStr));
    element.setAttribute("download", `memos-${utils.getDateTimeString(Date.now())}.json`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleImportBtnClick = async () => {
    const fileInputEl = document.createElement("input");
    fileInputEl.type = "file";
    fileInputEl.accept = "application/JSON";
    fileInputEl.onchange = () => {
      if (fileInputEl.files?.length && fileInputEl.files.length > 0) {
        const reader = new FileReader();
        reader.readAsText(fileInputEl.files[0]);
        reader.onload = async (event) => {
          const memoList = JSON.parse(event.target?.result as string) as Model.Memo[];
          if (!Array.isArray(memoList)) {
            toastHelper.error("Unexpected data type.");
          }

          let succeedAmount = 0;

          for (const memo of memoList) {
            const content = memo.content || "";
            const createdAt = memo.createdAt || utils.getDateTimeString(Date.now());

            try {
              await memoService.importMemo(content, createdAt);
              succeedAmount++;
            } catch (error) {
              // do nth
            }
          }

          await memoService.fetchAllMemos();
          toastHelper.success(`${succeedAmount} memos successfully imported.`);
        };
      }
    };
    fileInputEl.click();
  };

  return (
    <>
      <div className="section-container preferences-section-container">
        <p className="title-text">Memo Display</p>
        <div
          className="demo-content-container memo-content-text"
          dangerouslySetInnerHTML={{ __html: formatMemoContent(demoMemoContent) }}
        ></div>
        <label className="form-label checkbox-form-label hidden" onClick={handleSplitWordsValueChanged}>
          <span className="normal-text">Auto-space in English and Chinese</span>
          <img className="icon-img" src={shouldSplitMemoWord ? "/icons/checkbox-active.svg" : "/icons/checkbox.svg"} />
        </label>
        <label className="form-label checkbox-form-label" onClick={handleUseMarkdownParserChanged}>
          <span className="normal-text">Partial markdown format parsing</span>
          <img className="icon-img" src={shouldUseMarkdownParser ? "/icons/checkbox-active.svg" : "/icons/checkbox.svg"} />
        </label>
        <label className="form-label checkbox-form-label" onClick={handleHideImageUrlValueChanged}>
          <span className="normal-text">Hide image url</span>
          <img className="icon-img" src={shouldHideImageUrl ? "/icons/checkbox-active.svg" : "/icons/checkbox.svg"} />
        </label>
      </div>
      <div className="section-container">
        <p className="title-text">Others</p>
        <div className="w-full flex flex-row justify-start items-center">
          <button className="px-2 py-1 border rounded text-base hover:opacity-80" onClick={handleExportBtnClick}>
            Export data as JSON
          </button>
          <button className="ml-2 px-2 py-1 border rounded text-base hover:opacity-80" onClick={handleImportBtnClick}>
            Import from JSON
          </button>
        </div>
      </div>
    </>
  );
};

export default PreferencesSection;
