import { TextField } from "@mui/joy";
import { useEffect, useState } from "react";
import { useTagStore } from "../store/module";
import { getTagSuggestionList } from "../helpers/api";
import Tag from "../labs/marked/parser/Tag";
import Icon from "./Icon";
import toastHelper from "./Toast";
import { generateDialog } from "./Dialog";

type Props = DialogProps;

const validateTagName = (tagName: string): boolean => {
  const matchResult = Tag.matcher(`#${tagName}`);
  if (!matchResult || matchResult[1] !== tagName) {
    return false;
  }
  return true;
};

const CreateTagDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const tagStore = useTagStore();
  const [tagName, setTagName] = useState<string>("");
  const [suggestTagNameList, setSuggestTagNameList] = useState<string[]>([]);
  const tagNameList = tagStore.state.tags;

  useEffect(() => {
    getTagSuggestionList().then(({ data }) => {
      setSuggestTagNameList(data.data.filter((tag) => !tagNameList.includes(tag) && validateTagName(tag)));
    });
  }, [tagNameList]);

  const handleTagNameChanged = (e: React.ChangeEvent<HTMLInputElement>) => {
    const tagName = e.target.value as string;
    setTagName(tagName.trim());
  };

  const handleRemoveSuggestTag = (tag: string) => {
    setSuggestTagNameList(suggestTagNameList.filter((item) => item !== tag));
  };

  const handleSaveBtnClick = async () => {
    if (!validateTagName(tagName)) {
      toastHelper.error("Invalid tag name");
      return;
    }

    try {
      await tagStore.upsertTag(tagName);
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }
  };

  const handleDeleteTag = async (tag: string) => {
    await tagStore.deleteTag(tag);
  };

  const handleSaveSuggestTagList = async () => {
    for (const tagName of suggestTagNameList) {
      if (validateTagName(tagName)) {
        await tagStore.upsertTag(tagName);
      }
    }
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">Create Tag</p>
        <button className="btn close-btn" onClick={() => destroy()}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container !w-80">
        <TextField
          className="mb-2"
          placeholder="TAG_NAME"
          value={tagName}
          onChange={handleTagNameChanged}
          fullWidth
          startDecorator={<Icon.Hash className="w-4 h-auto" />}
          endDecorator={<Icon.CheckCircle onClick={handleSaveBtnClick} className="w-4 h-auto" />}
        />
        {tagNameList.length > 0 && (
          <>
            <p className="w-full mt-2 mb-1 text-sm text-gray-400">All tags</p>
            <div className="w-full flex flex-row justify-start items-start flex-wrap">
              {tagNameList.map((tag) => (
                <span
                  className="text-sm mr-2 mt-1 font-mono cursor-pointer truncate hover:opacity-60 hover:line-through"
                  key={tag}
                  onClick={() => handleDeleteTag(tag)}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </>
        )}

        {suggestTagNameList.length > 0 && (
          <>
            <p className="w-full mt-2 mb-1 text-sm text-gray-400">Tag suggestions</p>
            <div className="w-full flex flex-row justify-start items-start flex-wrap">
              {suggestTagNameList.map((tag) => (
                <span
                  className="text-sm mr-2 mt-1 font-mono cursor-pointer truncate hover:opacity-60 hover:line-through"
                  key={tag}
                  onClick={() => handleRemoveSuggestTag(tag)}
                >
                  #{tag}
                </span>
              ))}
            </div>
            <button
              className="mt-2 text-sm border px-2 leading-6 rounded cursor-pointer hover:opacity-80 hover:shadow"
              onClick={handleSaveSuggestTagList}
            >
              Save all
            </button>
          </>
        )}
      </div>
    </>
  );
};

function showCreateTagDialog() {
  generateDialog(
    {
      className: "create-tag-dialog",
      dialogName: "create-tag-dialog",
    },
    CreateTagDialog
  );
}

export default showCreateTagDialog;
