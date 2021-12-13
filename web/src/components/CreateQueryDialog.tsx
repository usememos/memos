import { memo, useCallback, useEffect, useState } from "react";
import { memoService, queryService } from "../services";
import { checkShouldShowMemoWithFilters, filterConsts, getDefaultFilter, relationConsts } from "../helpers/filter";
import useLoading from "../hooks/useLoading";
import { showDialog } from "./Dialog";
import toastHelper from "./Toast";
import Selector from "./common/Selector";
import "../less/create-query-dialog.less";

interface Props extends DialogProps {
  queryId?: string;
}

const CreateQueryDialog: React.FC<Props> = (props: Props) => {
  const { destroy, queryId } = props;

  const [title, setTitle] = useState<string>("");
  const [filters, setFilters] = useState<Filter[]>([]);
  const requestState = useLoading(false);

  const shownMemoLength = memoService.getState().memos.filter((memo) => {
    return checkShouldShowMemoWithFilters(memo, filters);
  }).length;

  useEffect(() => {
    const queryTemp = queryService.getQueryById(queryId ?? "");
    if (queryTemp) {
      setTitle(queryTemp.title);
      const temp = JSON.parse(queryTemp.querystring);
      if (Array.isArray(temp)) {
        setFilters(temp);
      }
    }
  }, [queryId]);

  const handleTitleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value as string;
    setTitle(text);
  };

  const handleSaveBtnClick = async () => {
    if (!title) {
      toastHelper.error("标题不能为空！");
      return;
    }

    try {
      if (queryId) {
        const editedQuery = await queryService.updateQuery(queryId, title, JSON.stringify(filters));
        queryService.editQuery(editedQuery);
      } else {
        const query = await queryService.createQuery(title, JSON.stringify(filters));
        queryService.pushQuery(query);
      }
    } catch (error: any) {
      toastHelper.error(error.message);
    }
    destroy();
  };

  const handleAddFilterBenClick = () => {
    if (filters.length > 0) {
      const lastFilter = filters[filters.length - 1];
      if (lastFilter.value.value === "") {
        toastHelper.info("先完善上一个过滤器吧");
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
          <span className="icon-text">🔖</span>
          {queryId ? "编辑检索" : "创建检索"}
        </p>
        <button className="btn close-btn" onClick={destroy}>
          <img className="icon-img" src="/icons/close.svg" />
        </button>
      </div>
      <div className="dialog-content-container">
        <div className="form-item-container input-form-container">
          <span className="normal-text">标题</span>
          <input className="title-input" type="text" value={title} onChange={handleTitleInputChange} />
        </div>
        <div className="form-item-container filter-form-container">
          <span className="normal-text">过滤器</span>
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
              添加筛选条件
            </div>
          </div>
        </div>
      </div>
      <div className="dialog-footer-container">
        <div></div>
        <div className="btns-container">
          <span className={`tip-text ${filters.length === 0 && "hidden"}`}>
            符合条件的 Memo 有 <strong>{shownMemoLength}</strong> 条
          </span>
          <button className={`btn save-btn ${requestState.isLoading ? "requesting" : ""}`} onClick={handleSaveBtnClick}>
            保存
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

const FilterInputer: React.FC<MemoFilterInputerProps> = (props: MemoFilterInputerProps) => {
  const { index, filter, handleFilterChange, handleFilterRemove } = props;
  const { type } = filter;
  const [inputElements, setInputElements] = useState<JSX.Element>(<></>);

  useEffect(() => {
    let operatorElement = <></>;
    if (Object.keys(filterConsts).includes(type)) {
      operatorElement = (
        <Selector
          className="operator-selector"
          dataSource={Object.values(filterConsts[type as FilterType].operators)}
          value={filter.value.operator}
          handleValueChanged={handleOperatorChange}
        />
      );
    }

    let valueElement = <></>;
    switch (type) {
      case "TYPE": {
        valueElement = (
          <Selector
            className="value-selector"
            dataSource={filterConsts["TYPE"].values}
            value={filter.value.value}
            handleValueChanged={handleValueChange}
          />
        );
        break;
      }
      case "TAG": {
        valueElement = (
          <Selector
            className="value-selector"
            dataSource={memoService
              .getState()
              .tags.sort()
              .map((t) => {
                return { text: t, value: t };
              })}
            value={filter.value.value}
            handleValueChanged={handleValueChange}
          />
        );
        break;
      }
      case "TEXT": {
        valueElement = (
          <input
            type="text"
            className="value-inputer"
            value={filter.value.value}
            onChange={(event) => {
              handleValueChange(event.target.value);
              event.target.focus();
            }}
          />
        );
        break;
      }
    }

    setInputElements(
      <>
        {operatorElement}
        {valueElement}
      </>
    );
  }, [type, filter]);

  const handleRelationChange = useCallback(
    (value: string) => {
      if (["AND", "OR"].includes(value)) {
        handleFilterChange(index, {
          ...filter,
          relation: value as MemoFilterRalation,
        });
      }
    },
    [filter]
  );

  const handleTypeChange = useCallback(
    (value: string) => {
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
    },
    [filter]
  );

  const handleOperatorChange = useCallback(
    (value: string) => {
      handleFilterChange(index, {
        ...filter,
        value: {
          ...filter.value,
          operator: value,
        },
      });
    },
    [filter]
  );

  const handleValueChange = useCallback(
    (value: string) => {
      handleFilterChange(index, {
        ...filter,
        value: {
          ...filter.value,
          value,
        },
      });
    },
    [filter]
  );

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

      {inputElements}
      <img className="remove-btn" src="/icons/close.svg" onClick={handleRemoveBtnClick} />
    </div>
  );
};

const MemoFilterInputer: React.FC<MemoFilterInputerProps> = memo(FilterInputer);

export default function showCreateQueryDialog(queryId?: string): void {
  showDialog(
    {
      className: "create-query-dialog",
    },
    CreateQueryDialog,
    { queryId }
  );
}
