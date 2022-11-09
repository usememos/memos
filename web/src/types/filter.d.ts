type MemoFilterRalation = "AND" | "OR";

interface BaseFilter {
  type: FilterType;
  value: {
    operator: string;
    value: string;
  };
  relation: MemoFilterRalation;
}

interface TagFilter extends BaseFilter {
  type: "TAG";
  value: {
    operator: "CONTAIN" | "NOT_CONTAIN";
    value: string;
  };
}

interface TypeFilter extends BaseFilter {
  type: "TYPE";
  value: {
    operator: "IS" | "IS_NOT";
    value: MemoSpecType;
  };
}

interface TextFilter extends BaseFilter {
  type: "TEXT";
  value: {
    operator: "CONTAIN" | "NOT_CONTAIN";
    value: string;
  };
}

interface CreatedTimeFilter extends BaseFilter {
  type: "CREATED_TIME";
  value: {
    operator: "BEFORE" | "AFTER";
    value: string;
  };
}

interface UpdatedTimeFilter extends BaseFilter {
  type: "UPDATED_TIME";
  value: {
    operator: "BEFORE" | "AFTER";
    value: string;
  };
}

type FilterType = "TEXT" | "TYPE" | "TAG" | "CREATED_TIME" | "UPDATED_TIME";

type Filter = BaseFilter | TagFilter | TypeFilter | TextFilter | CreatedTimeFilter | UpdatedTimeFilter;
