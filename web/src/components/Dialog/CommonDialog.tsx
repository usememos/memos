import { Button } from "@mui/joy";
import { DefaultColorPalette } from "@mui/joy/styles/types";
import { useTranslate } from "@/utils/i18n";
import Icon from "../Icon";
import { generateDialog } from "./BaseDialog";
import "@/less/common-dialog.less";

interface Props extends DialogProps {
  title: string;
  content: string;
  style?: DefaultColorPalette;
  closeBtnText?: string;
  confirmBtnText?: string;
  onClose?: () => void;
  onConfirm?: () => void;
}

const defaultProps = {
  title: "",
  content: "",
  style: "neutral",
  closeBtnText: "common.close",
  confirmBtnText: "common.confirm",
  onClose: () => null,
  onConfirm: () => null,
} as const;

const CommonDialog: React.FC<Props> = (props: Props) => {
  const t = useTranslate();
  const { title, content, destroy, closeBtnText, confirmBtnText, onClose, onConfirm, style } = {
    ...defaultProps,
    closeBtnText: t(defaultProps.closeBtnText),
    confirmBtnText: t(defaultProps.confirmBtnText),
    ...props,
  };

  const handleCloseBtnClick = () => {
    onClose();
    destroy();
  };

  const handleConfirmBtnClick = async () => {
    onConfirm();
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">{title}</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <p className="content-text">{content}</p>
        <div className="mt-4 w-full flex flex-row justify-end items-center gap-2">
          <Button color="neutral" variant="plain" onClick={handleCloseBtnClick}>
            {closeBtnText}
          </Button>
          <Button color={style} onClick={handleConfirmBtnClick}>
            {confirmBtnText}
          </Button>
        </div>
      </div>
    </>
  );
};

interface CommonDialogProps {
  title: string;
  content: string;
  className?: string;
  style?: DefaultColorPalette;
  dialogName: string;
  closeBtnText?: string;
  confirmBtnText?: string;
  onClose?: () => void;
  onConfirm?: () => void;
}

export const showCommonDialog = (props: CommonDialogProps) => {
  generateDialog(
    {
      className: `common-dialog ${props?.className ?? ""}`,
      dialogName: `common-dialog ${props?.className ?? ""}`,
    },
    CommonDialog,
    props
  );
};
