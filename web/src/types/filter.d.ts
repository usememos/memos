type MemoFilterRelation = "AND" | "OR";

interface BaseFilter {
  type: FilterType;
  value: {
    operator: string;
    value: string;
  };
  relation: MemoFilterRelation;
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

interface DisplayTimeFilter extends BaseFilter {
  type: "DISPLAY_TIME";
  value: {
    operator: "BEFORE" | "AFTER";
    value: string;
  };
}

interface VisibilityFilter extends BaseFilter {
  type: "VISIBILITY";
  value: {
    operator: "IS" | "IS_NOT";
    value: string;
  };
}

type FilterType = "TEXT" | "TYPE" | "TAG" | "DISPLAY_TIME" | "VISIBILITY";

type Filter = BaseFilter | TagFilter | TypeFilter | TextFilter | DisplayTimeFilter | VisibilityFilter;
