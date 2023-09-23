import { Divider, Select, Tooltip, Option, IconButton } from "@mui/joy";
import copy from "copy-to-clipboard";
import { toLower } from "lodash-es";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useParams } from "react-router-dom";
import FloatingNavButton from "@/components/FloatingNavButton";
import Icon from "@/components/Icon";
import MemoContent from "@/components/MemoContent";
import MemoRelationListView from "@/components/MemoRelationListView";
import MemoResourceListView from "@/components/MemoResourceListView";
import showShareMemoDialog from "@/components/ShareMemoDialog";
import UserAvatar from "@/components/UserAvatar";
import { VISIBILITY_SELECTOR_ITEMS } from "@/helpers/consts";
import { getDateTimeString } from "@/helpers/datetime";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useMemoStore } from "@/store/module";
import { useUserV1Store } from "@/store/v1";
import { User } from "@/types/proto/api/v2/user_service";
import { useTranslate } from "@/utils/i18n";

const MemoDetail = () => {
  const params = useParams();
  const navigateTo = useNavigateTo();
  const t = useTranslate();
  const memoStore = useMemoStore();
  const userV1Store = useUserV1Store();
  const [user, setUser] = useState<User>();
  const memoId = Number(params.memoId);
  const memo = memoStore.state.memos.find((memo) => memo.id === memoId);

  useEffect(() => {
    if (memoId && !isNaN(memoId)) {
      memoStore
        .fetchMemoById(memoId)
        .then(async (memo) => {
          const user = await userV1Store.getOrFetchUserByUsername(memo.creatorUsername);
          setUser(user);
        })
        .catch((error) => {
          console.error(error);
          toast.error(error.response.data.message);
        });
    } else {
      navigateTo("/404");
    }
  }, [memoId]);

  if (!memo) {
    return null;
  }

  const memoVisibilityOptionSelectorItems = VISIBILITY_SELECTOR_ITEMS.map((item) => {
    return {
      value: item.value,
      text: t(`memo.visibility.${toLower(item.value) as Lowercase<typeof item.value>}`),
    };
  });

  const handleMemoVisibilityOptionChanged = async (value: string) => {
    const visibilityValue = value as Visibility;
    await memoStore.patchMemo({
      id: memo.id,
      visibility: visibilityValue,
    });
  };

  const handleCopyLinkBtnClick = () => {
    copy(`${window.location.origin}/m/${memo.id}`);
    toast.success(t("message.succeed-copy-link"));
  };

  return (
    <>
      <section className="relative top-0 w-full min-h-full overflow-x-hidden bg-white dark:bg-zinc-800">
        <div className="relative w-full min-h-full mx-auto flex flex-col justify-start items-center pb-6">
          <div className="w-full flex flex-col justify-start items-center py-8">
            <UserAvatar className="!w-20 h-auto mb-4 drop-shadow" avatarUrl={user?.avatarUrl} />
            <div>
              <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{user?.nickname}</p>
            </div>
          </div>
          <div className="relative flex-grow max-w-2xl w-full min-h-full flex flex-col justify-start items-start px-4">
            <MemoContent content={memo.content} />
            <MemoResourceListView resourceList={memo.resourceList} />
            <MemoRelationListView relationList={memo.relationList} />
            <Divider className="!my-6" />
            <div className="w-full flex flex-col sm:flex-row justify-start sm:justify-between sm:items-center gap-2">
              <div className="flex flex-row justify-start items-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">{getDateTimeString(memo.displayTs)}</span>
                <span className="mx-1 font-mono opacity-80 text-gray-400">·</span>
                <Tooltip title={"The identifier of memo"} placement="top">
                  <span className="text-sm text-gray-500 dark:text-gray-400">#{memo.id}</span>
                </Tooltip>
                <span className="mx-1 font-mono opacity-80 text-gray-400">·</span>
                <Tooltip title={"The visibility of memo"} placement="top">
                  <Select
                    className="w-auto text-sm"
                    variant="plain"
                    value={memo.visibility}
                    onChange={(_, visibility) => {
                      if (visibility) {
                        handleMemoVisibilityOptionChanged(visibility);
                      }
                    }}
                  >
                    {memoVisibilityOptionSelectorItems.map((item) => (
                      <Option key={item.value} value={item.value} className="whitespace-nowrap">
                        {item.text}
                      </Option>
                    ))}
                  </Select>
                </Tooltip>
              </div>
              <div className="flex flex-row sm:justify-end items-center">
                <IconButton size="sm" onClick={handleCopyLinkBtnClick}>
                  <Icon.Link className="w-4 h-auto text-gray-600 dark:text-gray-400" />
                </IconButton>
                <IconButton size="sm" onClick={() => showShareMemoDialog(memo)}>
                  <Icon.Share className="w-4 h-auto text-gray-600 dark:text-gray-400" />
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      <FloatingNavButton />
    </>
  );
};

export default MemoDetail;
