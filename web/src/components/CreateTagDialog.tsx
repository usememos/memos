import { Button, Input } from "@mui/joy";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getTagSuggestionList } from "@/helpers/api";
import { matcher } from "@/labs/marked/matcher";
import Tag from "@/labs/marked/parser/Tag";
import { useTagStore } from "@/store/module";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";

type Props = DialogProps;

const validateTagName = (tagName: string): boolean => {
  const matchResult = matcher(`#${tagName}`, Tag.regexp);
  if (!matchResult || matchResult[1] !== tagName) {
    return false;
  }
  return true;
};

const CreateTagDialog: React.FC<Props> = (props: Props) => {
  const { destroy } = props;
  const tagStore = useTagStore();
  const t = useTranslate();
  const [tagName, setTagName] = useState<string>("");
  const [suggestTagNameList, setSuggestTagNameList] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState<boolean>(false);
  const tagNameList = tagStore.state.tags;
  const shownSuggestTagNameList = suggestTagNameList.filter((tag) => !tagNameList.includes(tag));

  useEffect(() => {
    getTagSuggestionList().then(({ data }) => {
      setSuggestTagNameList(data.filter((tag) => validateTagName(tag)));
    });
  }, [tagNameList]);

  const handleTagNameInputKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleSaveBtnClick();
    }
  };

  const handleTagNameChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    const tagName = event.target.value;
    setTagName(tagName.trim());
  };

  const handleUpsertTag = async (tagName: string) => {
    await tagStore.upsertTag(tagName);
  };

  const handleToggleShowSuggestionTags = () => {
    setShowTagSuggestions((state) => !state);
  };

  const handleSaveBtnClick = async () => {
    if (!validateTagName(tagName)) {
      toast.error("Invalid tag name");
      return;
    }

    try {
      await tagStore.upsertTag(tagName);
      setTagName("");
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
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
        <p className="title-text">{t("tag-list.create-tag")}</p>
        <button className="btn close-btn" onClick={() => destroy()}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container !w-80">
        <Input
          className="mb-2"
          size="md"
          placeholder={t("tag-list.tag-name")}
          value={tagName}
          onChange={handleTagNameChanged}
          onKeyDown={handleTagNameInputKeyDown}
          fullWidth
          startDecorator={<Icon.Hash className="w-4 h-auto" />}
          endDecorator={<Icon.Check onClick={handleSaveBtnClick} className="w-4 h-auto cursor-pointer hover:opacity-80" />}
        />
        {tagNameList.length > 0 && (
          <>
            <p className="w-full mt-2 mb-1 text-sm text-gray-400">{t("tag-list.all-tags")}</p>
            <div className="w-full flex flex-row justify-start items-start flex-wrap">
              {Array.from(tagNameList)
                .sort()
                .map((tag) => (
                  <span
                    className="max-w-[120px] text-sm mr-2 mt-1 font-mono cursor-pointer truncate dark:text-gray-300 hover:opacity-60 hover:line-through"
                    key={tag}
                    onClick={() => handleDeleteTag(tag)}
                  >
                    #{tag}
                  </span>
                ))}
            </div>
          </>
        )}

        {shownSuggestTagNameList.length > 0 && (
          <>
            <div className="mt-4 mb-1 text-sm w-full flex flex-row justify-start items-center">
              <span className="text-gray-400 mr-2">Tag suggestions</span>
              <Button size="sm" variant="outlined" onClick={handleToggleShowSuggestionTags}>
                {showTagSuggestions ? "hide" : "show"}
              </Button>
            </div>
            {showTagSuggestions && (
              <>
                <div className="w-full flex flex-row justify-start items-start flex-wrap mb-2">
                  {shownSuggestTagNameList.map((tag) => (
                    <span
                      className="max-w-[120px] text-sm mr-2 mt-1 font-mono cursor-pointer truncate dark:text-gray-300 hover:opacity-60"
                      key={tag}
                      onClick={() => handleUpsertTag(tag)}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                <Button size="sm" onClick={handleSaveSuggestTagList}>
                  Save all
                </Button>
              </>
            )}
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
