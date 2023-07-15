import { getUnixTimeMillis } from "./datetime";
import { TAG_REG, LINK_REG, PLAIN_LINK_REG } from "@/labs/marked/parser";

export const relationConsts = [
  { text: "filter.and", value: "AND" },
  { text: "filter.or", value: "OR" },
] as const;

export const filterConsts = {
  TAG: {
    text: "filter.type.tag",
    value: "TAG",
    operators: [
      {
        text: "filter.operator.contains",
        value: "CONTAIN",
      },
      {
        text: "filter.operator.not-contains",
        value: "NOT_CONTAIN",
      },
    ],
  },
  TYPE: {
    text: "filter.type.type",
    value: "TYPE",
    operators: [
      {
        text: "filter.operator.is",
        value: "IS",
      },
      {
        text: "filter.operator.is-not",
        value: "IS_NOT",
      },
    ],
    values: [
      {
        text: "filter.value.not-tagged",
        value: "NOT_TAGGED",
      },
      {
        text: "filter.value.linked",
        value: "LINKED",
      },
      {
        text: "filter.value.has-attachment",
        value: "HAS_ATTACHMENT",
      },
    ],
  },
  TEXT: {
    text: "filter.type.text",
    value: "TEXT",
    operators: [
      {
        text: "filter.operator.contains",
        value: "CONTAIN",
      },
      {
        text: "filter.operator.not-contains",
        value: "NOT_CONTAIN",
      },
    ],
  },
  DISPLAY_TIME: {
    text: "filter.type.display-time",
    value: "DISPLAY_TIME",
    operators: [
      {
        text: "filter.operator.before",
        value: "BEFORE",
      },
      {
        text: "filter.operator.after",
        value: "AFTER",
      },
    ],
  },
  VISIBILITY: {
    text: "filter.type.visibility",
    value: "VISIBILITY",
    operators: [
      {
        text: "filter.operator.is",
        value: "IS",
      },
      {
        text: "filter.operator.is-not",
        value: "IS_NOT",
      },
    ],
    values: [
      {
        text: "memo.visibility.public",
        value: "PUBLIC",
      },
      {
        text: "memo.visibility.protected",
        value: "PROTECTED",
      },
      {
        text: "memo.visibility.private",
        value: "PRIVATE",
      },
    ],
  },
} as const;

export const memoSpecialTypes = filterConsts["TYPE"].values;

export const getTextWithMemoType = (type: string) => {
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
    for (const t of Array.from(memo.content.match(new RegExp(TAG_REG, "g")) ?? [])) {
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
    } else if (value === "LINKED" && (memo.content.match(LINK_REG) !== null || memo.content.match(PLAIN_LINK_REG)) !== null) {
      matched = true;
    } else if (value === "HAS_ATTACHMENT" && memo.resourceList.length > 0) {
      matched = true;
    }
    if (operator === "IS_NOT") {
      matched = !matched;
    }
    shouldShow = matched;
  } else if (type === "TEXT") {
    if (value.startsWith("^")) {
      const reg = new RegExp(value.slice(1));
      shouldShow = operator === "NOT_CONTAIN" ? !reg.test(memo.content) : reg.test(memo.content);
    } else {
      let contained = memo.content.toLowerCase().includes(value.toLowerCase());
      if (operator === "NOT_CONTAIN") {
        contained = !contained;
      }
      shouldShow = contained;
    }
  } else if (type === "DISPLAY_TIME") {
    if (operator === "BEFORE") {
      return memo.displayTs < getUnixTimeMillis(value);
    } else {
      return memo.displayTs >= getUnixTimeMillis(value);
    }
  } else if (type === "VISIBILITY") {
    let matched = memo.visibility === value;
    if (operator === "IS_NOT") {
      matched = !matched;
    }
    shouldShow = matched;
  }

  return shouldShow;
};
