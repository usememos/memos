import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { cn } from "@/lib/utils";
import dialogStore from "@/store/v2/dialog";

interface DialogConfig {
  dialogName: string;
  className?: string;
  clickSpaceDestroy?: boolean;
}

interface Props extends DialogConfig, DialogProps {
  children: React.ReactNode;
}

const BaseDialog = observer((props: Props) => {
  const { children, className, clickSpaceDestroy, dialogName, destroy } = props;
  const dialogContainerRef = useRef<HTMLDivElement>(null);
  const dialogIndex = dialogStore.state.stack.findIndex((item) => item === dialogName);

  useEffect(() => {
    dialogStore.pushDialog(dialogName);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        if (dialogName === dialogStore.topDialog) {
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
    <div
      className={cn(
        "fixed top-0 left-0 flex flex-col justify-start items-center w-full h-full pt-16 pb-8 px-4 z-1000 overflow-x-hidden overflow-y-scroll transition-all hide-scrollbar bg-black/60",
        className,
      )}
      onMouseDown={handleSpaceClicked}
    >
      <div ref={dialogContainerRef} onMouseDown={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
});

export function generateDialog<T extends DialogProps>(
  config: DialogConfig,
  DialogComponent: React.FC<T>,
  props?: Omit<T, "destroy">,
): DialogCallback {
  const tempDiv = document.createElement("div");
  const dialog = createRoot(tempDiv);
  document.body.append(tempDiv);
  document.body.style.overflow = "hidden";

  const cbs: DialogCallback = {
    destroy: () => {
      document.body.style.removeProperty("overflow");
      dialog.unmount();
      tempDiv.remove();
    },
  };

  const dialogProps = {
    ...props,
    destroy: cbs.destroy,
  } as T;

  const Fragment = observer(() => (
    <BaseDialog destroy={cbs.destroy} clickSpaceDestroy={true} {...config}>
      <DialogComponent {...dialogProps} />
    </BaseDialog>
  ));

  dialog.render(<Fragment />);

  return cbs;
}
