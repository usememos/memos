import { memoService } from "../../services";
import utils from "../../helpers/utils";
import toastHelper from "../Toast";
import "../../less/settings/preferences-section.less";

interface Props {}

const PreferencesSection: React.FC<Props> = () => {
  const handleExportBtnClick = async () => {
    const formatedMemos = memoService.getState().memos.map((m) => {
      return {
        content: m.content,
        createdTs: m.createdTs,
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
          const memoList = JSON.parse(event.target?.result as string) as Memo[];
          if (!Array.isArray(memoList)) {
            toastHelper.error("Unexpected data type.");
          }

          let succeedAmount = 0;

          for (const memo of memoList) {
            const content = memo.content || "";
            const createdTs = (memo as any).createdAt || memo.createdTs || Date.now();

            try {
              await memoService.importMemo(content, createdTs);
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
    <div className="section-container preferences-section-container">
      <p className="title-text">Others</p>
      <div className="btns-container">
        <button className="btn" onClick={handleExportBtnClick}>
          Export data as JSON
        </button>
        <button className="btn" onClick={handleImportBtnClick}>
          Import from JSON
        </button>
      </div>
    </div>
  );
};

export default PreferencesSection;
