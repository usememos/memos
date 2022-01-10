import { IMAGE_URL_REG, LINK_REG, MEMO_LINK_REG, TAG_REG } from "./consts";

export const relationConsts = [
  { text: "且", value: "AND" },
  { text: "或", value: "OR" },
];

export const filterConsts = {
  TAG: {
    value: "TAG",
    text: "标签",
    operators: [
      {
        text: "包括",
        value: "CONTAIN",
      },
      {
        text: "排除",
        value: "NOT_CONTAIN",
      },
    ],
  },
  TYPE: {
    value: "TYPE",
    text: "类型",
    operators: [
      {
        value: "IS",
        text: "是",
      },
      {
        value: "IS_NOT",
        text: "不是",
      },
    ],
    values: [
      {
        value: "CONNECTED",
        text: "有关联",
      },
      {
        value: "NOT_TAGGED",
        text: "无标签",
      },
      {
        value: "LINKED",
        text: "有超链接",
      },
      {
        value: "IMAGED",
        text: "有图片",
      },
    ],
  },
  TEXT: {
    value: "TEXT",
    text: "文本",
    operators: [
      {
        value: "CONTAIN",
        text: "包括",
      },
      {
        value: "NOT_CONTAIN",
        text: "排除",
      },
    ],
  },
};

export const memoSpecialTypes = filterConsts["TYPE"].values;

export const getTextWithMemoType = (type: string): string => {
  for (const t of memoSpecialTypes) {
    if (t.value === type) {
      return t.text;
    }
  }
  return "";
};

export const getDefaultFilter = (): BaseFilter => {
  return {
    type: "TAG",
    value: {
      operator: "CONTAIN",
      value: "",
    },
    relation: "AND",
  };
};

export const checkShouldShowMemoWithFilters = (memo: Model.Memo, filters: Filter[]) => {
  let shouldShow = true;

  for (const f of filters) {
    const { relation } = f;
    const r = checkShouldShowMemo(memo, f);
    if (relation === "OR") {
      shouldShow = shouldShow || r;
    } else {
      shouldShow = shouldShow && r;
    }
  }

  return shouldShow;
};

export const checkShouldShowMemo = (memo: Model.Memo, filter: Filter) => {
  const {
    type,
    value: { operator, value },
  } = filter;

  if (value === "") {
    return true;
  }

  let shouldShow = true;

  if (type === "TAG") {
    let contained = memo.content.includes(`#${value} `) || memo.content.includes(`# ${value} `);
    if (operator === "NOT_CONTAIN") {
      contained = !contained;
    }
    shouldShow = contained;
  } else if (type === "TYPE") {
    let matched = false;
    if (value === "NOT_TAGGED" && memo.content.match(TAG_REG) === null) {
      matched = true;
    } else if (value === "LINKED" && memo.content.match(LINK_REG) !== null) {
      matched = true;
    } else if (value === "IMAGED" && memo.content.match(IMAGE_URL_REG) !== null) {
      matched = true;
    } else if (value === "CONNECTED" && memo.content.match(MEMO_LINK_REG) !== null) {
      matched = true;
    }
    if (operator === "IS_NOT") {
      matched = !matched;
    }
    shouldShow = matched;
  } else if (type === "TEXT") {
    let contained = memo.content.includes(value);
    if (operator === "NOT_CONTAIN") {
      contained = !contained;
    }
    shouldShow = contained;
  }

  return shouldShow;
};
