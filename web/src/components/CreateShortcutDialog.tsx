import { useCallback, useEffect, useState } from "react";
import { memoService, shortcutService } from "../services";
import { checkShouldShowMemoWithFilters, filterConsts, getDefaultFilter, relationConsts } from "../helpers/filter";
import useLoading from "../hooks/useLoading";
import Icon from "./Icon";
import { generateDialog } from "./Dialog";
import toastHelper from "./Toast";
import Selector from "./common/Selector";
import useI18n from "../hooks/useI18n";
import "../less/create-shortcut-dialog.less";

interface Props extends DialogProps {
  shortcutId?: ShortcutId;
}

const CreateShortcutDialog: React.FC<Props> = (props: Props) => {
  const { destroy, shortcutId } = props;

  const [title, setTitle] = useState<string>("");
  const [filters, setFilters] = useState<Filter[]>([]);
  const requestState = useLoading(false);
  const { t } = useI18n();

  const shownMemoLength = memoService.getState().memos.filter((memo) => {
    return checkShouldShowMemoWithFilters(memo, filters);
  }).length;

  useEffect(() => {
    if (shortcutId) {
      const shortcutTemp = shortcutService.getShortcutById(shortcutId);
      if (shortcutTemp) {
        setTitle(shortcutTemp.title);
        const temp = JSON.parse(shortcutTemp.payload);
        if (Array.isArray(temp)) {
          setFilters(temp);
        }
      }
    }
  }, [shortcutId]);

  const handleTitleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setTitle(text);
  };

  const handleSaveBtnClick = async () => {
    if (!title) {
      toastHelper.error(t("shortcut-list.title-required"));
      return;
    }

    try {
      if (shortcutId) {
        await shortcutService.patchShortcut({
          id: shortcutId,
          title,
          payload: JSON.stringify(filters),
        });
      } else {
        await shortcutService.createShortcut({
          title,
          payload: JSON.stringify(filters),
        });
      }
    } catch (error: any) {
      console.error(error);
      toastHelper.error(error.response.data.message);
    }
    destroy();
  };

  const handleAddFilterBenClick = () => {
    if (filters.length > 0) {
      const lastFilter = filters[filters.length - 1];
      if (lastFilter.value.value === "") {
        toastHelper.info(t("shortcut-list.fill-previous"));
        return;
      }
    }

    setFilters([...filters, getDefaultFilter()]);
  };

  const handleFilterChange = useCallback((index: number, filter: Filter) => {
    setFilters((filters) => {
      const temp = [...filters];
      temp[index] = filter;
      return temp;
    });
  }, []);

  const handleFilterRemove = useCallback((index: number) => {
    setFilters((filters) => {
      const temp = filters.filter((_, i) => i !== index);
      return temp;
    });
  }, []);

  return (
    <>
      <div className="dialog-header-container">
        <p className="title-text">
          <span className="icon-text">🚀</span>
          {shortcutId ? t("shortcut-list.edit-shortcut") : t("shortcut-list.create-shortcut")}
        </p>
        <button className="btn close-btn" onClick={destroy}>
          <Icon.X />
        </button>
      </div>
      <div className="dialog-content-container">
        <div className="form-item-container input-form-container">
          <span className="normal-text">{t("common.title")}</span>
          <input
            className="title-input"
            type="text"
            placeholder={t("common.shortcut-title")}
            value={title}
            onChange={handleTitleInputChange}
          />
        </div>
        <div className="form-item-container filter-form-container">
          <span className="normal-text">{t("common.filter")}</span>
          <div className="filters-wrapper">
            {filters.map((f, index) => {
              return (
                <MemoFilterInputer
                  key={index}
                  index={index}
                  filter={f}
                  handleFilterChange={handleFilterChange}
                  handleFilterRemove={handleFilterRemove}
                />
              );
            })}
            <div className="create-filter-btn" onClick={handleAddFilterBenClick}>
              {t("shortcut-list.new-filter")}
            </div>
          </div>
        </div>
      </div>
      <div className="dialog-footer-container">
        <div></div>
        <div className="btns-container">
          <span className={`tip-text ${filters.length === 0 && "hidden"}`}>
            <strong>{shownMemoLength}</strong> {t("shortcut-list.eligible-memo")}
          </span>
          <button className={`btn save-btn ${requestState.isLoading ? "requesting" : ""}`} onClick={handleSaveBtnClick}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </>
  );
};

interface MemoFilterInputerProps {
  index: number;
  filter: Filter;
  handleFilterChange: (index: number, filter: Filter) => void;
  handleFilterRemove: (index: number) => void;
}

const MemoFilterInputer: React.FC<MemoFilterInputerProps> = (props: MemoFilterInputerProps) => {
  const { index, filter, handleFilterChange, handleFilterRemove } = props;
  const [value, setValue] = useState<string>(filter.value.value);

  const tags = Array.from(memoService.getState().tags);
  const { type } = filter;
  const dataSource =
    type === "TYPE"
      ? filterConsts["TYPE"].values
      : tags.sort().map((t) => {
          return { text: t, value: t };
        });

  useEffect(() => {
    setValue(filter.value.value);
  }, [type]);

  const handleRelationChange = (value: string) => {
    if (["AND", "OR"].includes(value)) {
      handleFilterChange(index, {
        ...filter,
        relation: value as MemoFilterRalation,
      });
    }
  };

  const handleTypeChange = (value: string) => {
    if (filter.type !== value) {
      const ops = Object.values(filterConsts[value as FilterType].operators);
      handleFilterChange(index, {
        ...filter,
        type: value as FilterType,
        value: {
          operator: ops[0].value,
          value: "",
        },
      });
    }
  };

  const handleOperatorChange = (value: string) => {
    handleFilterChange(index, {
      ...filter,
      value: {
        ...filter.value,
        operator: value,
      },
    });
  };

  const handleValueChange = (value: string) => {
    setValue(value);
    handleFilterChange(index, {
      ...filter,
      value: {
        ...filter.value,
        value,
      },
    });
  };

  const handleRemoveBtnClick = () => {
    handleFilterRemove(index);
  };

  return (
    <div className="memo-filter-input-wrapper">
      {index > 0 ? (
        <Selector
          className="relation-selector"
          dataSource={relationConsts}
          value={filter.relation}
          handleValueChanged={handleRelationChange}
        />
      ) : null}
      <Selector
        className="type-selector"
        dataSource={Object.values(filterConsts)}
        value={filter.type}
        handleValueChanged={handleTypeChange}
      />
      <Selector
        className="operator-selector"
        dataSource={Object.values(filterConsts[type as FilterType].operators)}
        value={filter.value.operator}
        handleValueChanged={handleOperatorChange}
      />
      {type === "TEXT" ? (
        <input
          type="text"
          className="value-inputer"
          value={value}
          onChange={(event) => {
            handleValueChange(event.target.value);
          }}
        />
      ) : (
        <Selector className="value-selector" dataSource={dataSource} value={value} handleValueChanged={handleValueChange} />
      )}
      <Icon.X className="remove-btn" onClick={handleRemoveBtnClick} />
    </div>
  );
};

export default function showCreateShortcutDialog(shortcutId?: ShortcutId): void {
  generateDialog(
    {
      className: "create-shortcut-dialog",
    },
    CreateShortcutDialog,
    { shortcutId }
  );
}
