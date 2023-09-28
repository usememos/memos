import { Divider, Select, Tooltip, Option, IconButton } from "@mui/joy";
import copy from "copy-to-clipboard";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link, useParams } from "react-router-dom";
import FloatingNavButton from "@/components/FloatingNavButton";
import Icon from "@/components/Icon";
import MemoContent from "@/components/MemoContent";
import showMemoEditorDialog from "@/components/MemoEditor/MemoEditorDialog";
import MemoRelationListView from "@/components/MemoRelationListView";
import MemoResourceListView from "@/components/MemoResourceListView";
import showShareMemoDialog from "@/components/ShareMemoDialog";
import UserAvatar from "@/components/UserAvatar";
import { VISIBILITY_SELECTOR_ITEMS } from "@/helpers/consts";
import { getDateTimeString } from "@/helpers/datetime";
import useCurrentUser from "@/hooks/useCurrentUser";
import useNavigateTo from "@/hooks/useNavigateTo";
import { useGlobalStore, useMemoStore } from "@/store/module";
import { useUserV1Store } from "@/store/v1";
import { User } from "@/types/proto/api/v2/user_service";
import { useTranslate } from "@/utils/i18n";

const MemoDetail = () => {
  const params = useParams();
  const navigateTo = useNavigateTo();
  const t = useTranslate();
  const globalStore = useGlobalStore();
  const memoStore = useMemoStore();
  const userV1Store = useUserV1Store();
  const currentUser = useCurrentUser();
  const [user, setUser] = useState<User>();
  const { systemStatus } = globalStore.state;
  const memoId = Number(params.memoId);
  const memo = memoStore.state.memos.find((memo) => memo.id === memoId);
  const allowEdit = memo?.creatorUsername === currentUser?.username;

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

  const handleMemoVisibilityOptionChanged = async (value: string) => {
    const visibilityValue = value as Visibility;
    await memoStore.patchMemo({
      id: memo.id,
      visibility: visibilityValue,
    });
  };

  const handleEditMemoClick = () => {
    showMemoEditorDialog({
      memoId: memo.id,
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
            <UserAvatar className="!w-20 h-auto mb-2 drop-shadow" avatarUrl={systemStatus.customizedProfile.logoUrl} />
            <p className="text-3xl text-black opacity-80 dark:text-gray-200">{systemStatus.customizedProfile.name}</p>
          </div>
          <div className="relative flex-grow max-w-2xl w-full min-h-full flex flex-col justify-start items-start px-4">
            <div className="w-full mb-4 flex flex-row justify-start items-center mr-1">
              <span className="text-gray-400 select-none">{getDateTimeString(memo.displayTs)}</span>
            </div>
            <MemoContent content={memo.content} />
            <MemoResourceListView resourceList={memo.resourceList} />
            <MemoRelationListView relationList={memo.relationList} />
            <Divider className="!my-6" />
            <div className="w-full flex flex-col sm:flex-row justify-start sm:justify-between sm:items-center gap-2">
              <div className="flex flex-row justify-start items-center">
                <Tooltip title={"The identifier of memo"} placement="top">
                  <span className="text-sm text-gray-500 dark:text-gray-400">#{memo.id}</span>
                </Tooltip>
                <Icon.Dot className="w-4 h-auto text-gray-400 dark:text-zinc-400" />
                <Link className="flex flex-row justify-start items-center" to={`/u/${encodeURIComponent(memo.creatorUsername)}`}>
                  <UserAvatar className="!w-5 !h-auto mr-1" avatarUrl={user?.avatarUrl} />
                  <span className="text-sm text-gray-600 max-w-[8em] truncate dark:text-gray-400">{user?.nickname}</span>
                </Link>
                {allowEdit && (
                  <>
                    <Icon.Dot className="w-4 h-auto text-gray-400 dark:text-zinc-400" />
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
                        {VISIBILITY_SELECTOR_ITEMS.map((item) => (
                          <Option key={item.value} value={item.value} className="whitespace-nowrap">
                            {item.text}
                          </Option>
                        ))}
                      </Select>
                    </Tooltip>
                  </>
                )}
              </div>
              <div className="flex flex-row sm:justify-end items-center">
                {allowEdit && (
                  <Tooltip title={"Edit"} placement="top">
                    <IconButton size="sm" onClick={handleEditMemoClick}>
                      <Icon.Edit3 className="w-4 h-auto text-gray-600 dark:text-gray-400" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={"Copy link"} placement="top">
                  <IconButton size="sm" onClick={handleCopyLinkBtnClick}>
                    <Icon.Link className="w-4 h-auto text-gray-600 dark:text-gray-400" />
                  </IconButton>
                </Tooltip>
                <Tooltip title={"Share"} placement="top">
                  <IconButton size="sm" onClick={() => showShareMemoDialog(memo)}>
                    <Icon.Share className="w-4 h-auto text-gray-600 dark:text-gray-400" />
                  </IconButton>
                </Tooltip>
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
