import { memo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import useToggle from "../../hooks/useToggle";
import Icon from "../Icon";
import { Tooltip } from "@mui/joy";
import "../../less/common/selector.less";

interface SelectorItem {
  text: string;
  value: string;
}

interface Props {
  className?: string;
  value: string;
  dataSource: SelectorItem[];
  handleValueChanged?: (value: string) => void;
  disabled?: boolean;
  tooltipTitle?: string;
}

const nullItem = {
  text: "common.select",
  value: "",
};

const Selector: React.FC<Props> = (props: Props) => {
  const { className, dataSource, handleValueChanged, value, disabled, tooltipTitle } = props;
  const { t } = useTranslation();
  const [showSelector, toggleSelectorStatus] = useToggle(false);

  const selectorElRef = useRef<HTMLDivElement>(null);

  let currentItem = { text: t(nullItem.text), value: nullItem.value };
  for (const d of dataSource) {
    if (d.value === value) {
      currentItem = d;
      break;
    }
  }

  useEffect(() => {
    if (showSelector) {
      const handleClickOutside = (event: MouseEvent) => {
        if (!selectorElRef.current?.contains(event.target as Node)) {
          toggleSelectorStatus(false);
        }
      };
      window.addEventListener("click", handleClickOutside, {
        capture: true,
        once: true,
      });
    }
  }, [showSelector]);

  const handleItemClick = (item: SelectorItem) => {
    if (handleValueChanged) {
      handleValueChanged(item.value);
    }
    toggleSelectorStatus(false);
  };

  const handleCurrentValueClick = (event: React.MouseEvent) => {
    if (disabled) return;
    event.stopPropagation();
    toggleSelectorStatus();
  };

  return (
    <Tooltip title={tooltipTitle} hidden={!disabled}>
      <div className={`selector-wrapper ${className ?? ""} `} ref={selectorElRef}>
        <div
          className={`current-value-container ${showSelector ? "active" : ""} ${disabled && "selector-disabled"}`}
          onClick={handleCurrentValueClick}
        >
          {disabled && (
            <span className="lock-text">
              <Icon.Lock className="icon-img" />
            </span>
          )}
          <span className="value-text">{currentItem.text}</span>
          {!disabled && (
            <span className="arrow-text">
              <Icon.ChevronDown className="icon-img" />
            </span>
          )}
        </div>

        <div className={`items-wrapper ${showSelector ? "" : "!hidden"}`}>
          {dataSource.length > 0 ? (
            dataSource.map((d) => {
              return (
                <div
                  className={`item-container ${d.value === value ? "selected" : ""}`}
                  key={d.value}
                  onClick={() => {
                    handleItemClick(d);
                  }}
                >
                  {d.text}
                </div>
              );
            })
          ) : (
            <p className="tip-text">{t("common.null")}</p>
          )}
        </div>
      </div>
    </Tooltip>
  );
};

export default memo(Selector);
