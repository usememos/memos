import { CssVarsProvider } from "@mui/joy";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { ANIMATION_DURATION } from "@/helpers/consts";
import store from "@/store";
import { useDialogStore } from "@/store/module";
import theme from "@/theme";
import "@/less/base-dialog.less";

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
    document.body.classList.add("overflow-hidden");
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
      if (dialogStore.state.dialogStack.length === 0) {
        document.body.classList.remove("overflow-hidden");
      }
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
  props?: Omit<T, "destroy" | "hide">
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
    hide: () => {
      tempDiv.firstElementChild?.classList.remove("showup");
      tempDiv.firstElementChild?.classList.add("showoff");
    },
  };

  const dialogProps = {
    ...props,
    destroy: cbs.destroy,
    hide: cbs.hide,
  } as T;

  const Fragment = (
    <Provider store={store}>
      <CssVarsProvider theme={theme}>
        <BaseDialog destroy={cbs.destroy} hide={cbs.hide} clickSpaceDestroy={true} {...config}>
          <DialogComponent {...dialogProps} />
        </BaseDialog>
      </CssVarsProvider>
    </Provider>
  );

  dialog.render(Fragment);

  return cbs;
}
