type CELValueType = "string" | "int" | "bool" | "timestamp" | "duration" | "null" | "list";

type CELValueKind = "field" | "size" | "timestampAccessor";

interface CELValue {
  type: CELValueType;
  field?: string;
  kind?: CELValueKind;
  literal: boolean;
}

interface CELQualifiedCall {
  target: string;
  method: string;
  args: string[];
}

// This is deliberately a conservative client-side mirror of the memo filter
// subset implemented by internal/filter/parser.go and render.go. The server
// remains authoritative, but unsupported expressions must stay plain search
// text instead of being persisted as celSearch.
const CEL_FIELD_TYPES: Record<string, CELValueType> = {
  content: "string",
  creator: "string",
  creator_id: "int",
  created_ts: "timestamp",
  updated_ts: "timestamp",
  pinned: "bool",
  tag: "string",
  tags: "list",
  visibility: "string",
  has_task_list: "bool",
  has_link: "bool",
  has_code: "bool",
  has_incomplete_tasks: "bool",
  has_location: "bool",
};

const CEL_BOOLEAN_FIELDS = new Set(["pinned", "has_task_list", "has_link", "has_code", "has_incomplete_tasks", "has_location"]);
const CEL_SCALAR_IN_FIELDS = new Set(["content", "creator", "visibility", "creator_id"]);
const CEL_RESTRICTED_COMPARISON_FIELDS = new Set([
  "creator",
  "creator_id",
  "pinned",
  "visibility",
  "has_task_list",
  "has_link",
  "has_code",
  "has_incomplete_tasks",
  "has_location",
]);
const CEL_TIMESTAMP_ACCESSORS = new Set([
  "getFullYear",
  "getMonth",
  "getDate",
  "getDayOfMonth",
  "getDayOfWeek",
  "getDayOfYear",
  "getHours",
  "getMinutes",
  "getSeconds",
]);
const CEL_CONTENT_METHODS = new Set(["contains", "startsWith", "endsWith", "matches"]);
const CEL_TAG_METHODS = new Set(["exists", "all", "exists_one"]);
const CEL_TAG_PREDICATE_METHODS = new Set(["contains", "startsWith", "endsWith"]);
const CEL_SET_METHODS = new Set(["contains", "intersects", "equivalent"]);
const CEL_IDENTIFIER_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const CEL_COMPARISON_OPERATORS = new Set(["==", "!=", "<", ">", "<=", ">="]);
const CEL_ARITHMETIC_OPERATORS = new Set(["+", "-", "*", "/", "%"]);

const isIdentifier = (value: string): boolean => CEL_IDENTIFIER_PATTERN.test(value.trim());

const hasBalancedCELDelimiters = (query: string): boolean => {
  const expectedClosers: string[] = [];
  const matchingClosers: Record<string, string> = { "(": ")", "[": "]" };
  let quote = false;
  let escaped = false;

  for (const character of query) {
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        quote = false;
      }
      continue;
    }

    if (character === '"') {
      quote = true;
    } else if (character in matchingClosers) {
      expectedClosers.push(matchingClosers[character]);
    } else if (character === ")" || character === "]") {
      if (expectedClosers.pop() !== character) return false;
    }
  }

  return !quote && expectedClosers.length === 0;
};

const findMatchingParenthesis = (query: string, openIndex: number): number | undefined => {
  if (query[openIndex] !== "(") return undefined;

  let depth = 0;
  let quote = false;
  let escaped = false;
  for (let index = openIndex; index < query.length; index++) {
    const character = query[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        quote = false;
      }
      continue;
    }

    if (character === '"') {
      quote = true;
    } else if (character === "(") {
      depth += 1;
    } else if (character === ")") {
      depth -= 1;
      if (depth === 0) return index;
      if (depth < 0) return undefined;
    }
  }

  return undefined;
};

const stripEnclosingCELParentheses = (query: string): string => {
  let value = query.trim();
  while (value.startsWith("(")) {
    const closeIndex = findMatchingParenthesis(value, 0);
    if (closeIndex !== value.length - 1) break;
    value = value.slice(1, -1).trim();
  }
  return value;
};

const splitTopLevelCELArguments = (query: string): string[] | undefined => {
  const value = query.trim();
  if (!value) return [];

  const parts: string[] = [];
  let startIndex = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote = false;
  let escaped = false;

  for (let index = 0; index < value.length; index++) {
    const character = value[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        quote = false;
      }
      continue;
    }

    if (character === '"') {
      quote = true;
    } else if (character === "(") {
      parentheses += 1;
    } else if (character === ")") {
      parentheses -= 1;
      if (parentheses < 0) return undefined;
    } else if (character === "[") {
      brackets += 1;
    } else if (character === "]") {
      brackets -= 1;
      if (brackets < 0) return undefined;
    } else if (character === "," && parentheses === 0 && brackets === 0) {
      const part = value.slice(startIndex, index).trim();
      if (!part) return undefined;
      parts.push(part);
      startIndex = index + 1;
    }
  }

  if (quote || parentheses !== 0 || brackets !== 0) return undefined;
  const lastPart = value.slice(startIndex).trim();
  if (!lastPart) return undefined;
  parts.push(lastPart);
  return parts;
};

interface CELTopLevelOperator {
  index: number;
  operator: string;
}

const getTopLevelCELOperators = (query: string): CELTopLevelOperator[] => {
  const operators: CELTopLevelOperator[] = [];
  let parentheses = 0;
  let brackets = 0;
  let quote = false;
  let escaped = false;

  for (let index = 0; index < query.length; index++) {
    const character = query[index];
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        quote = false;
      }
      continue;
    }

    if (character === '"') {
      quote = true;
      continue;
    }
    if (character === "(") {
      parentheses += 1;
      continue;
    }
    if (character === ")") {
      parentheses -= 1;
      continue;
    }
    if (character === "[") {
      brackets += 1;
      continue;
    }
    if (character === "]") {
      brackets -= 1;
      continue;
    }
    if (parentheses !== 0 || brackets !== 0) continue;

    const twoCharacterOperator = query.slice(index, index + 2);
    if (["&&", "||", "==", "!=", "<=", ">="].includes(twoCharacterOperator)) {
      operators.push({ index, operator: twoCharacterOperator });
      index += 1;
      continue;
    }
    if (["<", ">", "+", "-", "*", "/", "%"].includes(character)) {
      operators.push({ index, operator: character });
      continue;
    }
    if (
      query.slice(index, index + 2) === "in" &&
      (index === 0 || !/[a-zA-Z0-9_]/.test(query[index - 1])) &&
      (index + 2 === query.length || !/[a-zA-Z0-9_]/.test(query[index + 2]))
    ) {
      operators.push({ index, operator: "in" });
      index += 1;
    }
  }

  return operators;
};

const splitAtTopLevelOperator = (query: string, operator: string): string[] | undefined => {
  const matches = getTopLevelCELOperators(query).filter((item) => item.operator === operator);
  if (matches.length === 0) return undefined;

  const parts: string[] = [];
  let startIndex = 0;
  for (const match of matches) {
    const part = query.slice(startIndex, match.index).trim();
    if (!part) return undefined;
    parts.push(part);
    startIndex = match.index + match.operator.length;
  }
  const lastPart = query.slice(startIndex).trim();
  if (!lastPart) return undefined;
  parts.push(lastPart);
  return parts;
};

const parseStringLiteral = (value: string): string | undefined => {
  const trimmedValue = value.trim();
  if (!/^"(?:\\.|[^"\\])*"$/.test(trimmedValue)) return undefined;
  try {
    const parsed = JSON.parse(trimmedValue);
    return typeof parsed === "string" ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const parseIntegerLiteral = (value: string): number | undefined => {
  const trimmedValue = value.trim();
  if (!/^-?(?:0|[1-9][0-9]*)$/.test(trimmedValue)) return undefined;
  const parsed = Number(trimmedValue);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
};

const isValidTimestampLiteral = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offset] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetMatch = /^(?:[+-](\d{2}):(\d{2}))$/.exec(offset);
  const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = month === 2 ? (isLeapYear ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    (!offsetMatch || (Number(offsetMatch[1]) <= 23 && Number(offsetMatch[2]) <= 59))
  );
};

const isValidDurationLiteral = (value: string): boolean =>
  value === "0" || /^[+-]?(?:[0-9]+(?:\.[0-9]+)?(?:ns|us|µs|ms|s|m|h))+$/u.test(value);

const isSupportedRegex = (value: string): boolean => {
  // cel.ValidateRegexLiterals uses RE2. Reject constructs accepted by JavaScript
  // but rejected by RE2 before using the JavaScript parser for basic syntax.
  if (/\(\?|\\(?:[1-9]|k<|k')/.test(value)) return false;
  try {
    new RegExp(value);
    return true;
  } catch {
    return false;
  }
};

const parseQualifiedCall = (query: string): CELQualifiedCall | undefined => {
  const value = query.trim();
  const match = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/.exec(value);
  if (!match) return undefined;

  const openIndex = value.indexOf("(", match[0].length - 1);
  const closeIndex = findMatchingParenthesis(value, openIndex);
  if (closeIndex !== value.length - 1) return undefined;

  const args = splitTopLevelCELArguments(value.slice(openIndex + 1, closeIndex));
  if (!args) return undefined;
  return { target: match[1], method: match[2], args };
};

const parseFunctionCall = (query: string): { name: string; args: string[] } | undefined => {
  const value = query.trim();
  const match = /^([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/.exec(value);
  if (!match) return undefined;

  const openIndex = value.indexOf("(", match[0].length - 1);
  const closeIndex = findMatchingParenthesis(value, openIndex);
  if (closeIndex !== value.length - 1) return undefined;

  const args = splitTopLevelCELArguments(value.slice(openIndex + 1, closeIndex));
  if (!args) return undefined;
  return { name: match[1], args };
};

const parseStringList = (value: string): string[] | undefined => {
  const trimmedValue = value.trim();
  if (!trimmedValue.startsWith("[") || !trimmedValue.endsWith("]")) return undefined;
  const elements = splitTopLevelCELArguments(trimmedValue.slice(1, -1));
  if (!elements) return undefined;
  const strings = elements.map(parseStringLiteral);
  return strings.every((element): element is string => element !== undefined) ? strings : undefined;
};

const parseIntegerList = (value: string): number[] | undefined => {
  const trimmedValue = value.trim();
  if (!trimmedValue.startsWith("[") || !trimmedValue.endsWith("]")) return undefined;
  const elements = splitTopLevelCELArguments(trimmedValue.slice(1, -1));
  if (!elements) return undefined;
  const integers = elements.map(parseIntegerLiteral);
  return integers.every((element): element is number => element !== undefined) ? integers : undefined;
};

const parseValue = (query: string): CELValue | undefined => {
  const value = stripEnclosingCELParentheses(query);
  if (!value) return undefined;

  const stringLiteral = parseStringLiteral(value);
  if (stringLiteral !== undefined) return { type: "string", literal: true };
  if (parseIntegerLiteral(value) !== undefined) return { type: "int", literal: true };
  if (value === "true" || value === "false") return { type: "bool", literal: true };
  if (value === "null") return { type: "null", literal: true };

  const fieldType = CEL_FIELD_TYPES[value];
  if (fieldType) return { type: fieldType, field: value, kind: "field", literal: false };
  if (value === "now") return { type: "timestamp", literal: true };

  const functionCall = parseFunctionCall(value);
  if (functionCall) {
    if (functionCall.name === "size" && functionCall.args.length === 1) {
      const field = functionCall.args[0].trim();
      if (field === "content" || field === "tags") return { type: "int", field, kind: "size", literal: false };
      return undefined;
    }
    if ((functionCall.name === "timestamp" || functionCall.name === "duration") && functionCall.args.length === 1) {
      const argument = parseStringLiteral(functionCall.args[0]);
      if (functionCall.name === "timestamp") {
        if (argument !== undefined && isValidTimestampLiteral(argument)) return { type: "timestamp", literal: true };
        if (parseIntegerLiteral(functionCall.args[0]) !== undefined) return { type: "timestamp", literal: true };
      } else if (argument !== undefined && isValidDurationLiteral(argument)) {
        return { type: "duration", literal: true };
      }
      return undefined;
    }
    return undefined;
  }

  const qualifiedCall = parseQualifiedCall(value);
  if (qualifiedCall && CEL_TIMESTAMP_ACCESSORS.has(qualifiedCall.method) && qualifiedCall.args.length === 0) {
    if (qualifiedCall.target === "now") return { type: "int", kind: "timestampAccessor", literal: true };
    if (qualifiedCall.target === "created_ts" || qualifiedCall.target === "updated_ts") {
      return { type: "int", field: qualifiedCall.target, kind: "timestampAccessor", literal: false };
    }
    return undefined;
  }

  const arithmeticOperators = getTopLevelCELOperators(value).filter((item) => CEL_ARITHMETIC_OPERATORS.has(item.operator));
  const arithmetic = arithmeticOperators[arithmeticOperators.length - 1];
  if (!arithmetic) return undefined;

  const left = parseValue(value.slice(0, arithmetic.index));
  const right = parseValue(value.slice(arithmetic.index + arithmetic.operator.length));
  if (!left || !right || !left.literal || !right.literal) return undefined;

  if (arithmetic.operator === "+" || arithmetic.operator === "-") {
    if (left.type === "timestamp" && right.type === "duration") return { type: "timestamp", literal: true };
    if (left.type === "duration" && right.type === "duration") return { type: "duration", literal: true };
    if (left.type === "int" && right.type === "int") return { type: "int", literal: true };
  } else if (left.type === "int" && right.type === "int") {
    const rightLiteral = parseIntegerLiteral(value.slice(arithmetic.index + arithmetic.operator.length));
    if (rightLiteral === 0 && (arithmetic.operator === "/" || arithmetic.operator === "%")) {
      return undefined;
    }
    return { type: "int", literal: true };
  }

  return undefined;
};

const isSupportedTagPredicate = (predicate: string, iterationVariable: string): boolean => {
  const value = stripEnclosingCELParentheses(predicate);
  const operators = getTopLevelCELOperators(value).filter((item) => item.operator === "==");
  if (operators.length === 1) {
    const operator = operators[0];
    const left = value.slice(0, operator.index).trim();
    const right = value.slice(operator.index + operator.operator.length).trim();
    return (
      (left === iterationVariable && parseStringLiteral(right) !== undefined) ||
      (right === iterationVariable && parseStringLiteral(left) !== undefined)
    );
  }

  const call = parseQualifiedCall(value);
  if (!call || call.target !== iterationVariable || !CEL_TAG_PREDICATE_METHODS.has(call.method) || call.args.length !== 1) return false;
  return parseStringLiteral(call.args[0]) !== undefined;
};

const isSupportedCall = (query: string): boolean => {
  const call = parseQualifiedCall(query);
  if (!call) return false;

  if (call.target === "content" && CEL_CONTENT_METHODS.has(call.method) && call.args.length === 1) {
    const argument = parseStringLiteral(call.args[0]);
    return argument !== undefined && (call.method !== "matches" || isSupportedRegex(argument));
  }

  if (call.target === "tags" && CEL_TAG_METHODS.has(call.method) && call.args.length === 2) {
    const iterationVariable = call.args[0].trim();
    return isIdentifier(iterationVariable) && isSupportedTagPredicate(call.args[1], iterationVariable);
  }

  if (call.target === "sets" && CEL_SET_METHODS.has(call.method) && call.args.length === 2) {
    return call.args[0].trim() === "tags" && parseStringList(call.args[1]) !== undefined;
  }

  return false;
};

const isSupportedMembership = (query: string): boolean => {
  const operators = getTopLevelCELOperators(query).filter((item) => item.operator === "in");
  if (operators.length !== 1) return false;

  const operator = operators[0];
  const left = stripEnclosingCELParentheses(query.slice(0, operator.index));
  const right = stripEnclosingCELParentheses(query.slice(operator.index + operator.operator.length));

  if (right === "tags") return parseStringLiteral(left) !== undefined;

  const fieldType = CEL_FIELD_TYPES[left];
  if (!fieldType || (!CEL_SCALAR_IN_FIELDS.has(left) && left !== "tag")) return false;
  if (fieldType === "string") {
    const values = parseStringList(right);
    return values !== undefined && (left === "tag" || values.length > 0);
  }
  if (fieldType === "int") {
    const values = parseIntegerList(right);
    return values !== undefined && values.length > 0;
  }
  return false;
};

const isSupportedComparison = (query: string): boolean => {
  const operators = getTopLevelCELOperators(query).filter((item) => CEL_COMPARISON_OPERATORS.has(item.operator));
  if (operators.length !== 1) return false;

  const operator = operators[0];
  const left = parseValue(query.slice(0, operator.index));
  const right = parseValue(query.slice(operator.index + operator.operator.length));
  if (!left || !right) return false;

  const fieldValue = !left.literal && left.field ? left : !right.literal && right.field ? right : undefined;
  if (!fieldValue || (fieldValue.kind === "field" && (fieldValue.field === "tag" || fieldValue.field === "tags"))) return false;
  const otherValue = fieldValue === left ? right : left;
  if (!otherValue.literal) return false;

  if (fieldValue.field && CEL_RESTRICTED_COMPARISON_FIELDS.has(fieldValue.field) && !["==", "!="].includes(operator.operator)) return false;

  if (otherValue.type === "null") {
    return (
      ["content", "creator", "creator_id", "created_ts", "updated_ts", "visibility"].includes(fieldValue.field ?? "") &&
      ["==", "!="].includes(operator.operator)
    );
  }
  if (fieldValue.kind === "size" || fieldValue.kind === "timestampAccessor") return otherValue.type === "int";
  return otherValue.type === fieldValue.type;
};

const isSupportedCELExpression = (query: string): boolean => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || !hasBalancedCELDelimiters(trimmedQuery)) return false;
  const expression = stripEnclosingCELParentheses(trimmedQuery);
  if (!expression) return false;

  const orParts = splitAtTopLevelOperator(expression, "||");
  if (orParts) return orParts.every(isSupportedCELExpression);
  const andParts = splitAtTopLevelOperator(expression, "&&");
  if (andParts) return andParts.every(isSupportedCELExpression);
  if (expression.startsWith("!") && !expression.startsWith("!=")) return isSupportedCELExpression(expression.slice(1));

  if (CEL_BOOLEAN_FIELDS.has(expression)) return true;
  if (isSupportedCall(expression)) return true;
  if (isSupportedMembership(expression)) return true;
  return isSupportedComparison(expression);
};

/** Returns whether a quick-find query uses the memo CEL filter grammar. */
export const isCELQuery = (query: string): boolean => isSupportedCELExpression(query);
