import { useEffect } from "react";
import { createRoot, Root } from "react-dom/client";
import "../less/toast.less";

type ToastType = "normal" | "success" | "info" | "error";

type ToastConfig = {
  type: ToastType;
  content: string;
  duration: number;
};

type ToastItemProps = {
  type: ToastType;
  content: string;
  duration: number;
  destroy: FunctionType;
};

const Toast: React.FC<ToastItemProps> = (props: ToastItemProps) => {
  const { destroy, duration } = props;

  useEffect(() => {
    if (duration > 0) {
      setTimeout(() => {
        destroy();
      }, duration);
    }
  }, []);

  return (
    <div className="toast-container" onClick={destroy}>
      <p className="content-text">{props.content}</p>
    </div>
  );
};

// toast animation duration.
const TOAST_ANIMATION_DURATION = 400;

const initialToastHelper = () => {
  const shownToastContainers: [Root, HTMLDivElement][] = [];
  let shownToastAmount = 0;

  const wrapperClassName = "toast-list-container";
  const tempDiv = document.createElement("div");
  tempDiv.className = wrapperClassName;
  document.body.appendChild(tempDiv);
  const toastWrapper = tempDiv;

  const showToast = (config: ToastConfig) => {
    const tempDiv = document.createElement("div");
    const toast = createRoot(tempDiv);
    tempDiv.className = `toast-wrapper ${config.type}`;
    toastWrapper.appendChild(tempDiv);
    shownToastAmount++;
    shownToastContainers.push([toast, tempDiv]);

    const cbs = {
      destroy: () => {
        tempDiv.classList.add("destroy");

        setTimeout(() => {
          if (!tempDiv.parentElement) {
            return;
          }

          shownToastAmount--;
          if (shownToastAmount === 0) {
            for (const [root, tempDiv] of shownToastContainers) {
              root.unmount();
              tempDiv.remove();
            }
            shownToastContainers.splice(0, shownToastContainers.length);
          }
        }, TOAST_ANIMATION_DURATION);
      },
    };

    toast.render(<Toast {...config} destroy={cbs.destroy} />);

    setTimeout(() => {
      tempDiv.classList.add("showup");
    }, 10);

    return cbs;
  };

  const info = (content: string, duration = 3000) => {
    return showToast({ type: "normal", content, duration });
  };

  const success = (content: string, duration = 3000) => {
    return showToast({ type: "success", content, duration });
  };

  const error = (content: string, duration = -1) => {
    return showToast({ type: "error", content, duration });
  };

  return {
    info,
    success,
    error,
  };
};

const toastHelper = initialToastHelper();

export default toastHelper;
