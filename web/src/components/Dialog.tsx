import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import store from "../store";
import { ANIMATION_DURATION } from "../helpers/consts";
import "../less/dialog.less";

interface DialogConfig {
  className: string;
  useAppContext?: boolean;
  clickSpaceDestroy?: boolean;
}

interface Props extends DialogConfig, DialogProps {
  children: React.ReactNode;
}

const BaseDialog: React.FC<Props> = (props: Props) => {
  const { children, className, clickSpaceDestroy, destroy } = props;

  const handleSpaceClicked = () => {
    if (clickSpaceDestroy) {
      destroy();
    }
  };

  return (
    <div className={`dialog-wrapper ${className}`} onClick={handleSpaceClicked}>
      <div className="dialog-container" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};

export function showDialog<T extends DialogProps>(
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

  let Fragment = (
    <BaseDialog destroy={cbs.destroy} clickSpaceDestroy={true} {...config}>
      <DialogComponent {...dialogProps} />
    </BaseDialog>
  );

  if (config.useAppContext) {
    Fragment = <Provider store={store}>{Fragment}</Provider>;
  }

  dialog.render(Fragment);

  return cbs;
}
