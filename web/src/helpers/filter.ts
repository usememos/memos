import { IMAGE_URL_REG, LINK_URL_REG, MEMO_LINK_REG, TAG_REG } from "./marked";

export const relationConsts = [
  { text: "And", value: "AND" },
  { text: "Or", value: "OR" },
];

export const filterConsts = {
  TAG: {
    text: "Tag",
    value: "TAG",
    operators: [
      {
        text: "Contains",
        value: "CONTAIN",
      },
      {
        text: "Does not contain",
        value: "NOT_CONTAIN",
      },
    ],
  },
  TYPE: {
    text: "Type",
    value: "TYPE",
    operators: [
      {
        text: "Is",
        value: "IS",
      },
      {
        text: "Is not",
        value: "IS_NOT",
      },
    ],
    values: [
      {
        text: "Connected",
        value: "CONNECTED",
      },
      {
        text: "No tags",
        value: "NOT_TAGGED",
      },
      {
        text: "Has links",
        value: "LINKED",
      },
      {
        text: "Has images",
        value: "IMAGED",
      },
    ],
  },
  TEXT: {
    text: "Text",
    value: "TEXT",
    operators: [
      {
        text: "Contain",
        value: "CONTAIN",
      },
      {
        text: "Does not contain",
        value: "NOT_CONTAIN",
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

export const checkShouldShowMemoWithFilters = (memo: Memo, filters: Filter[]) => {
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

export const checkShouldShowMemo = (memo: Memo, filter: Filter) => {
  const {
    type,
    value: { operator, value },
  } = filter;

  if (value === "") {
    return true;
  }

  let shouldShow = true;

  if (type === "TAG") {
    let contained = true;
    const tagsSet = new Set<string>();
    for (const t of Array.from(memo.content.match(TAG_REG) ?? [])) {
      const tag = t.replace(TAG_REG, "$1").trim();
      const items = tag.split("/");
      let temp = "";
      for (const i of items) {
        temp += i;
        tagsSet.add(temp);
        temp += "/";
      }
    }
    if (!tagsSet.has(value)) {
      contained = false;
    }
    if (operator === "NOT_CONTAIN") {
      contained = !contained;
    }
    shouldShow = contained;
  } else if (type === "TYPE") {
    let matched = false;
    if (value === "NOT_TAGGED" && memo.content.match(TAG_REG) === null) {
      matched = true;
    } else if (value === "LINKED" && memo.content.match(LINK_URL_REG) !== null) {
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
