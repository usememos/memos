import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { ANIMATION_DURATION } from "../../helpers/consts";
import store from "../../store";
import { useDialogStore } from "../../store/module";
import { CssVarsProvider } from "@mui/joy";
import theme from "../../theme";
import "../../less/base-dialog.less";

interface DialogConfig {
  dialogName: string;
  className?: string;
  clickSpaceDestroy?: boolean;
}

interface Props extends DialogConfig, DialogProps {
  children: React.ReactNode;
}

const BaseDialog: React.FC<Props> = (props: Props) => {
  const { children, className, clickSpaceDestroy, dialogName, destroy } = props;
  const dialogStore = useDialogStore();
  const dialogContainerRef = useRef<HTMLDivElement>(null);
  const dialogIndex = dialogStore.state.dialogStack.findIndex((item) => item === dialogName);

  useEffect(() => {
    dialogStore.pushDialogStack(dialogName);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        if (dialogName === dialogStore.topDialogStack()) {
          destroy();
        }
      }
    };

    document.body.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.removeEventListener("keydown", handleKeyDown);
      dialogStore.removeDialog(dialogName);
    };
  }, []);

  useEffect(() => {
    if (dialogIndex > 0 && dialogContainerRef.current) {
      dialogContainerRef.current.style.marginTop = `${dialogIndex * 16}px`;
    }
  }, [dialogIndex]);

  const handleSpaceClicked = () => {
    if (clickSpaceDestroy) {
      destroy();
    }
  };

  return (
    <div className={`dialog-wrapper ${className ?? ""}`} onMouseDown={handleSpaceClicked}>
      <div ref={dialogContainerRef} className="dialog-container" onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

export function generateDialog<T extends DialogProps>(
  config: DialogConfig,
  DialogComponent: React.FC<T>,
  props?: Omit<T, "destroy">
): DialogCallback {
  const tempDiv = document.createElement("div");
  const dialog = createRoot(tempDiv);
  document.body.append(tempDiv);

  setTimeout(() => {
    tempDiv.firstElementChild?.classList.add("showup");
  }, 0);

  const cbs: DialogCallback = {
    destroy: () => {
      tempDiv.firstElementChild?.classList.remove("showup");
      tempDiv.firstElementChild?.classList.add("showoff");
      setTimeout(() => {
        dialog.unmount();
        tempDiv.remove();
      }, ANIMATION_DURATION);
    },
  };

  const dialogProps = {
    ...props,
    destroy: cbs.destroy,
  } as T;

  const Fragment = (
    <Provider store={store}>
      <CssVarsProvider theme={theme}>
        <BaseDialog destroy={cbs.destroy} clickSpaceDestroy={true} {...config}>
          <DialogComponent {...dialogProps} />
        </BaseDialog>
      </CssVarsProvider>
    </Provider>
  );

  dialog.render(Fragment);

  return cbs;
}
