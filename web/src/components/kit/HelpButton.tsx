import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button, IconButton, Tooltip } from "@mui/joy";
import { generateDialog } from "../Dialog";
import Icon from "../Icon";

const openUrl = (url?: string) => {
  window.open(url, "_blank");
};

/** Options for {@link HelpButton} */
interface HelpProps {
  /**
   * Plain text to show in the dialog.
   *
   * If the text contains "\n", it will be split to multiple paragraphs.
   */
  text?: string;
  /**
   * The title of the dialog.
   *
   * If not provided, the title will be set according to the `icon` prop.
   */
  title?: string;
  /**
   * External documentation URL.
   *
   * If provided, this will be shown as a link button in the bottom of the dialog.
   *
   * If provided alone, the button will just open the URL in a new tab.
   *
   * @param {string} url - External URL to the documentation.
   */
  url?: string;
  /**
   * The tooltip of the button.
   */
  hint?: string | "none";
  /**
   * The placement of the hovering hint.
   * @defaultValue "top"
   */
  hintPlacement?: "top" | "bottom" | "left" | "right";
  /**
   * The icon to show in the button.
   *
   * Also used to infer `title` and `hint`, if they are not provided.
   *
   * @defaultValue Icon.HelpCircle
   * @see {@link Icon.LucideIcon}
   */
  icon?: Icon.LucideIcon | "link" | "info" | "help" | "alert" | "warn";
  /**
   * The className for the button.
   * @defaultValue `!-mt-2` (aligns the button vertically with nearby text)
   */
  className?: string;
  /**
   * The color of the button.
   * @defaultValue "neutral"
   */
  color?: "primary" | "neutral" | "danger" | "info" | "success" | "warning";
  /**
   * The variant of the button.
   * @defaultValue "plain"
   */
  variant?: "plain" | "outlined" | "soft" | "solid";
  /**
   * The size of the button.
   * @defaultValue "md"
   */
  size?: "sm" | "md" | "lg";
  /**
   * `ReactNode` HTML content to show in the dialog.
   *
   * If provided, will be shown before `text`.
   *
   * You'll probably want to use `text` instead.
   */
  children?: ReactNode | undefined;
}

interface HelpDialogProps extends HelpProps, DialogProps {}

const HelpfulDialog: React.FC<HelpDialogProps> = (props: HelpDialogProps) => {
  const { t } = useTranslation();
  const { children, destroy, icon } = props;
  const LucideIcon = icon as Icon.LucideIcon;
  const handleCloseBtnClick = () => {
    destroy();
  };

  return (
    <>
      <div className="dialog-header-container">
        <LucideIcon size="24" />
        <p className="title-text text-left">{props.title}</p>
        <button className="btn close-btn" onClick={handleCloseBtnClick}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container max-w-sm">
        {children}
        {props.text
          ? props.text.split(/\n|\\n/).map((text) => {
              return (
                <p key={text} className="mt-2 break-words text-justify">
                  {text}
                </p>
              );
            })
          : null}
        <div className="mt-2 w-full flex flex-row justify-end space-x-2">
          {props.url ? (
            <Button className="btn-normal" variant="outlined" color={props.color} onClick={() => openUrl(props.url)}>
              {t("common.learn-more")}
              <Icon.ExternalLink className="ml-1 w-4 h-4 opacity-80" />
            </Button>
          ) : null}
          <Button className="btn-normal" variant="outlined" color={props.color} onClick={handleCloseBtnClick}>
            {t("common.close")}
          </Button>
        </div>
      </div>
    </>
  );
};

function showHelpDialog(props: HelpProps) {
  generateDialog(
    {
      className: "help-dialog",
      dialogName: "help-dialog",
      clickSpaceDestroy: true,
    },
    HelpfulDialog,
    props
  );
}

/**
 * Show a helpful `IconButton` that behaves differently depending on the props.
 *
 * The main purpose of this component is to avoid UI clutter.
 * 
 * Use the property `icon` to set the icon and infer the title and hint automatically.
 *
 * Use cases:
 *  - Button with just a hover hint
 *  - Button with a hover hint and link
 *  - Button with a hover hint that opens a dialog with text and a link.
 *
 * @example
 * <Helpful hint="Hint" />
 * <Helpful hint="This is a hint with a link" url="https://usememos.com/" />
 * <Helpful icon="warn" text={t("i18n.key.long-dialog-text")} url="https://usememos.com/" />
 * <Helpful />
 * 
 * <div className="flex flex-row">  
 *  <span className="ml-2">Sample alignment</span>
 *  <Helpful hint="Button with hint" />
 * </div>

 * @param props.title - The title of the dialog. Defaults to "Learn more" i18n key.
 * @param props.text - Plain text to show in the dialog. Line breaks are supported.
 * @param props.url - External memos documentation URL.
 * @param props.hint - The hint when hovering the button.
 * @param props.hintPlacement - The placement of the hovering hint. Defaults to "top".
 * @param props.icon - The icon to show in the button.
 * @param props.className - The class name for the button.
 * @param {HelpProps} props - See {@link HelpDialogProps} for all exposed props.
 */
const HelpButton = (props: HelpProps): JSX.Element => {
  const { t } = useTranslation();
  const color = props.color ?? "neutral";
  const variant = props.variant ?? "plain";
  const className = props.className ?? "!-mt-1";
  const hintPlacement = props.hintPlacement ?? "top";
  const iconButtonSize = "sm";

  const dialogAvailable = props.text || props.children;
  const clickActionAvailable = props.url || dialogAvailable;
  const onlyUrlAvailable = props.url && !dialogAvailable;

  let LucideIcon = (() => {
    switch (props.icon) {
      case "info":
        return Icon.Info;
      case "help":
        return Icon.HelpCircle;
      case "warn":
      case "alert":
        return Icon.AlertTriangle;
      case "link":
        return Icon.ExternalLink;
      default:
        return Icon.HelpCircle;
    }
  })() as Icon.LucideIcon;

  const hint = (() => {
    switch (props.hint) {
      case undefined:
        return t(
          (() => {
            if (!dialogAvailable) {
              LucideIcon = Icon.ExternalLink;
            }
            switch (LucideIcon) {
              case Icon.Info:
                return "common.dialog.info";
              case Icon.AlertTriangle:
                return "common.dialog.warning";
              case Icon.ExternalLink:
                return "common.learn-more";
              case Icon.HelpCircle:
              default:
                return "common.dialog.help";
            }
          })()
        );
      case "":
      case "none":
      case "false":
      case "disabled":
        return undefined;
      default:
        return props.hint;
    }
  })();

  const sizePx = (() => {
    switch (props.size) {
      case "sm":
        return 16;
      case "lg":
        return 48;
      case "md":
      default:
        return 24;
    }
  })();

  if (!dialogAvailable && !clickActionAvailable && !props.hint) {
    return (
      <IconButton className={className} color={color} variant={variant} size={iconButtonSize}>
        <LucideIcon size={sizePx} />
      </IconButton>
    );
  }

  const wrapInTooltip = (element: JSX.Element) => {
    if (!hint) {
      return element;
    }
    return (
      <Tooltip placement={hintPlacement} title={hint} color={color} variant={variant} size={props.size}>
        {element}
      </Tooltip>
    );
  };

  if (clickActionAvailable) {
    props = { ...props, title: props.title ?? hint, hint: hint, color: color, variant: variant, icon: LucideIcon };
    const clickAction = () => {
      dialogAvailable ? showHelpDialog(props) : openUrl(props.url);
    };
    LucideIcon = dialogAvailable || onlyUrlAvailable ? LucideIcon : Icon.ExternalLink;
    return wrapInTooltip(
      <IconButton className={className} color={color} variant={variant} size={iconButtonSize} onClick={clickAction}>
        <LucideIcon size={sizePx} />
      </IconButton>
    );
  }

  return wrapInTooltip(
    <IconButton className={className} color={color} variant={variant} size={iconButtonSize}>
      <LucideIcon size={sizePx} />
    </IconButton>
  );
};

export default HelpButton;
