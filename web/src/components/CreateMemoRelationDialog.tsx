import { Autocomplete, AutocompleteOption, Button, Checkbox, Chip, IconButton } from "@mui/joy";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import useDebounce from "react-use/lib/useDebounce";
import { memoServiceClient } from "@/grpcweb";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import { getDateTimeString } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import { Memo } from "@/types/proto/api/v1/memo_service";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";

interface Props extends DialogProps {
  onConfirm: (memos: Memo[], embedded?: boolean) => void;
}

const CreateMemoRelationDialog: React.FC<Props> = (props: Props) => {
  const { destroy, onConfirm } = props;
  const t = useTranslate();
  const user = useCurrentUser();
  const [searchText, setSearchText] = useState<string>("");
  const [isFetching, setIsFetching] = useState<boolean>(true);
  const [fetchedMemos, setFetchedMemos] = useState<Memo[]>([]);
  const [selectedMemos, setSelectedMemos] = useState<Memo[]>([]);
  const [embedded, setEmbedded] = useState<boolean>(true);
  const filteredMemos = fetchedMemos.filter((memo) => !selectedMemos.includes(memo));

  useDebounce(
    async () => {
      setIsFetching(true);
      try {
        const filters = [`creator == "${user.name}"`, `row_status == "NORMAL"`, `include_comments == true`];
        if (searchText) {
          filters.push(`content_search == [${JSON.stringify(searchText)}]`);
        }
        const { memos } = await memoServiceClient.listMemos({
          pageSize: DEFAULT_LIST_MEMOS_PAGE_SIZE,
          filter: filters.length > 0 ? filters.join(" && ") : undefined,
        });
        setFetchedMemos(memos);
      } catch (error: any) {
        console.error(error);
        toast.error(error.response.data.message);
      }
      setIsFetching(false);
    },
    300,
    [searchText],
  );

  const getHighlightedContent = (content: string) => {
    const index = content.toLowerCase().indexOf(searchText.toLowerCase());
    if (index === -1) {
      return content;
    }
    let before = content.slice(0, index);
    if (before.length > 20) {
      before = "..." + before.slice(before.length - 20);
    }
    const highlighted = content.slice(index, index + searchText.length);
    let after = content.slice(index + searchText.length);
    if (after.length > 20) {
      after = after.slice(0, 20) + "...";
    }

    return (
      <>
        {before}
        <mark className="font-medium">{highlighted}</mark>
        {after}
      </>
    );
  };

  const handleCloseDialog = () => {
    destroy();
  };

  const handleConfirmBtnClick = async () => {
    onConfirm(selectedMemos, embedded);
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container !w-96">
        <p className="title-text">{t("reference.add-references")}</p>
        <IconButton size="sm" onClick={() => destroy()}>
          <Icon.X className="w-5 h-auto" />
        </IconButton>
      </div>
      <div className="dialog-content-container max-w-[24rem]">
        <Autocomplete
          className="w-full"
          size="md"
          clearOnBlur
          disableClearable
          placeholder={t("reference.search-placeholder")}
          noOptionsText={t("reference.no-memos-found")}
          options={filteredMemos}
          loading={isFetching}
          inputValue={searchText}
          value={selectedMemos}
          multiple
          onInputChange={(_, value) => setSearchText(value.trim())}
          getOptionKey={(option) => option.name}
          getOptionLabel={(option) => option.content}
          isOptionEqualToValue={(option, value) => option.name === value.name}
          renderOption={(props, option) => (
            <AutocompleteOption {...props}>
              <div className="w-full flex flex-col justify-start items-start">
                <p className="text-xs text-gray-400 select-none">{getDateTimeString(option.displayTime)}</p>
                <p className="mt-0.5 text-sm leading-5 line-clamp-2">
                  {searchText ? getHighlightedContent(option.content) : option.content}
                </p>
              </div>
            </AutocompleteOption>
          )}
          renderTags={(memos) =>
            memos.map((memo) => (
              <Chip key={memo.name} className="!max-w-full !rounded" variant="outlined" color="neutral">
                <div className="w-full flex flex-col justify-start items-start">
                  <p className="text-xs text-gray-400 select-none">{getDateTimeString(memo.displayTime)}</p>
                  <span className="w-full text-sm leading-5 truncate">{memo.content}</span>
                </div>
              </Chip>
            ))
          }
          onChange={(_, value) => setSelectedMemos(value)}
        />
        <div className="mt-3">
          <Checkbox label={t("reference.embedded-usage")} checked={embedded} onChange={(e) => setEmbedded(e.target.checked)} />
        </div>
        <div className="mt-4 w-full flex flex-row justify-end items-center space-x-1">
          <Button variant="plain" color="neutral" onClick={handleCloseDialog}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleConfirmBtnClick} disabled={selectedMemos.length === 0}>
            {t("common.confirm")}
          </Button>
        </div>
      </div>
    </>
  );
};

function showCreateMemoRelationDialog(props: Omit<Props, "destroy">) {
  generateDialog(
    {
      className: "create-memo-relation-dialog",
      dialogName: "create-memo-relation-dialog",
    },
    CreateMemoRelationDialog,
    props,
  );
}

export default showCreateMemoRelationDialog;
