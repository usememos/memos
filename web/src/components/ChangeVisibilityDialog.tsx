import { Button, IconButton } from "@mui/joy";
import { toast } from "react-hot-toast";
import { UNKNOWN_ID } from "@/helpers/consts";
import { useMemoStore } from "@/store/v1";
import { Visibility } from "@/types/proto/api/v2/memo_service";
import { useTranslate } from "@/utils/i18n";
import { generateDialog } from "./Dialog";
import Icon from "./Icon";

interface Props extends DialogProps {
  memoId: number;
  onConfirm?: (memoId: number) => void;
  copyLink?: (visibility: Visibility) => void;
}

const ChangeVisibilityDialog: React.FC<Props> = (props: Props) => {
  const { memoId, onConfirm, destroy, copyLink } = props;
  const t = useTranslate();
  const visibility = Visibility.PUBLIC;
  const memoStore = useMemoStore();

  const updateVisibility = async (visibility: Visibility) => {
    if (memoId && memoId !== UNKNOWN_ID) {
      const prevMemo = await memoStore.getOrFetchMemoById(memoId ?? UNKNOWN_ID);
      if (prevMemo) {
        const memo = await memoStore.updateMemo(
          {
            id: prevMemo.id,
            visibility: visibility,
          },
          ["visibility"],
        );
        await memoStore.getOrFetchMemoById(memo.id, { skipCache: true });
        if (onConfirm) {
          onConfirm(memo.id);
        }
        return memo;
      }
    }
    return null;
  };

  const handleCloseBtnClick = () => {
    memoStore.getOrFetchMemoById(memoId).then((memo) => {
      if (memo) {
        copyLink?.(memo.visibility);
      }
    });
    destroy();
  };

  const handleChangeBtnClick = async () => {
    try {
      const memo = await updateVisibility(visibility);
      if (memo) {
        toast.success(t("common.changed"));
        handleCloseBtnClick();
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response.data.message);
    }
  };

  return (
    <>
      <div className="dialog-header-container !w-64">
        <p className="title-text">{t("memo.change-visibility.title")}</p>
        <IconButton size="sm" onClick={handleCloseBtnClick}>
          <Icon.X className="w-5 h-auto" />
        </IconButton>
      </div>
      <div className="dialog-content-container">
        <div className="w-full flex flex-row justify-end items-center pt-4 space-x-2">
          <Button color="neutral" variant="plain" onClick={handleCloseBtnClick}>
            {t("common.cancel")}
          </Button>
          <Button color="primary" onClick={handleChangeBtnClick}>
            {t("memo.change-visibility.public")}
          </Button>
        </div>
      </div>
    </>
  );
};

function showChangeVisibilityDialog(props: Pick<Props, "memoId" | "copyLink"> = { memoId: -1 }) {
  generateDialog(
    {
      className: "change-visibility-dialog",
      dialogName: "change-visibility-dialog",
    },
    ChangeVisibilityDialog,
    props,
  );
}

export default showChangeVisibilityDialog;
