import { globalService, memoService, userService } from "../../services";
import * as utils from "../../helpers/utils";
import { useAppSelector } from "../../store";
import Only from "../common/OnlyWhen";
import toastHelper from "../Toast";
import Selector from "../common/Selector";
import "../../less/settings/preferences-section.less";

interface Props {}

const localeSelectorItems = [
  {
    text: "English",
    value: "en",
  },
  {
    text: "中文",
    value: "zh",
  },
];

const PreferencesSection: React.FC<Props> = () => {
  const { setting } = useAppSelector((state) => state.user.user as User);

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
              const memoCreate = {
                content,
                createdTs: Math.floor(utils.getTimeStampByDate(createdTs) / 1000),
              };
              await memoService.createMemo(memoCreate);
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

  const handleLocaleChanged = async (value: string) => {
    globalService.setLocale(value as Locale);
    await userService.upsertUserSetting("locale", value);
  };

  return (
    <div className="section-container preferences-section-container">
      {/* Hide export/import buttons */}
      <label className="form-label">
        <span className="normal-text">Language:</span>
        <Selector className="ml-2 w-28" value={setting.locale} dataSource={localeSelectorItems} handleValueChanged={handleLocaleChanged} />
      </label>
      <Only when={false}>
        <p className="title-text">Others</p>
        <div className="btns-container">
          <button className="btn" onClick={handleExportBtnClick}>
            Export data as JSON
          </button>
          <button className="btn" onClick={handleImportBtnClick}>
            Import from JSON
          </button>
        </div>
      </Only>
    </div>
  );
};

export default PreferencesSection;
