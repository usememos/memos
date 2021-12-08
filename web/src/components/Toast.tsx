import { useEffect } from "react";
import ReactDOM from "react-dom";
import { TOAST_ANIMATION_DURATION } from "../helpers/consts";
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
  destory: FunctionType;
};

const Toast: React.FC<ToastItemProps> = (props: ToastItemProps) => {
  const { destory, duration } = props;

  useEffect(() => {
    if (duration > 0) {
      setTimeout(() => {
        destory();
      }, duration);
    }
  }, []);

  return (
    <div className="toast-container" onClick={destory}>
      <p className="content-text">{props.content}</p>
    </div>
  );
};

class ToastHelper {
  private shownToastAmount = 0;
  private toastWrapper: HTMLDivElement;
  private shownToastContainers: HTMLDivElement[] = [];

  constructor() {
    const wrapperClassName = "toast-list-container";
    const tempDiv = document.createElement("div");
    tempDiv.className = wrapperClassName;
    document.body.appendChild(tempDiv);
    this.toastWrapper = tempDiv;
  }

  public info = (content: string, duration = 3000) => {
    return this.showToast({ type: "normal", content, duration });
  };

  public success = (content: string, duration = 3000) => {
    return this.showToast({ type: "success", content, duration });
  };

  public error = (content: string, duration = 3000) => {
    return this.showToast({ type: "error", content, duration });
  };

  private showToast = (config: ToastConfig) => {
    const tempDiv = document.createElement("div");
    tempDiv.className = `toast-wrapper ${config.type}`;
    this.toastWrapper.appendChild(tempDiv);
    this.shownToastAmount++;
    this.shownToastContainers.push(tempDiv);

    setTimeout(() => {
      tempDiv.classList.add("showup");
    }, 0);

    const cbs = {
      destory: () => {
        tempDiv.classList.add("destory");

        setTimeout(() => {
          if (!tempDiv.parentElement) {
            return;
          }

          this.shownToastAmount--;
          if (this.shownToastAmount === 0) {
            for (const d of this.shownToastContainers) {
              ReactDOM.unmountComponentAtNode(d);
              d.remove();
            }
            this.shownToastContainers.splice(0, this.shownToastContainers.length);
          }
        }, TOAST_ANIMATION_DURATION);
      },
    };

    ReactDOM.render(<Toast {...config} destory={cbs.destory} />, tempDiv);

    return cbs;
  };
}

const toastHelper = new ToastHelper();

export default toastHelper;
