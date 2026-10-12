export interface SuggestionToken {
  text: string;
  value?: string;
}

export type SuggestionExpression =
  | { kind: "atom"; tokens: SuggestionToken[] }
  | { kind: "not"; child: SuggestionExpression }
  | {
      kind: "and" | "or";
      left: SuggestionExpression;
      right: SuggestionExpression;
    };

const STRING_ESCAPES: Record<string, string> = { a: "\x07", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t", v: "\v" };
const BRACKET_PAIRS: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
// Sticky: lastIndex is set before every exec.
const LEXER =
  /\s+|\/\/[^\n]*|"(?:\\[^\r\n]|[^"\\\r\n])*"|'(?:\\[^\r\n]|[^'\\\r\n])*'|[a-zA-Z_]\w*|\d+(?:\.\d+)?|&&|\|\||==|!=|<=|>=|[()[\]{},.!<>+*/%?:-]/gy;

function decodeString(text: string): string {
  return text.slice(1, -1).replace(/\\(u[\da-fA-F]{4}|U[\da-fA-F]{8}|x[\da-fA-F]{2}|[0-7]{3}|.)/g, (_, escaped: string) => {
    if (/^[uUx]/.test(escaped)) return String.fromCodePoint(Number.parseInt(escaped.slice(1), 16));
    if (/^[0-7]{3}$/.test(escaped)) return String.fromCodePoint(Number.parseInt(escaped, 8));
    if (escaped in STRING_ESCAPES) return STRING_ESCAPES[escaped];
    if (["\\", '"', "'", "?"].includes(escaped)) return escaped;
    throw new Error("Unsupported string escape");
  });
}

/**
 * A deliberately small CEL reader, not a filter evaluator. Boolean structure is
 * parsed; calls and other atoms stay opaque for each suggestion provider to interpret.
 * Unsupported syntax never falls back to searching strings for tag-like text.
 */
function parseExpression(source: string): SuggestionExpression {
  const tokens: SuggestionToken[] = [];
  let end = 0;
  while (end < source.length) {
    LEXER.lastIndex = end;
    const match = LEXER.exec(source);
    if (!match) throw new Error("Unsupported token");
    const text = match[0];
    end = LEXER.lastIndex;
    if (/^\s|^\/\//.test(text)) continue;
    tokens.push({ text, value: /^["']/.test(text) ? decodeString(text) : undefined });
  }
  let position = 0;
  const take = (text: string) => {
    if (tokens[position]?.text !== text) return false;
    position++;
    return true;
  };
  const unary = (): SuggestionExpression => {
    if (take("!")) return { kind: "not", child: unary() };
    if (take("(")) {
      const expression = binary("||");
      if (!take(")")) throw new Error("Unbalanced expression");
      return expression;
    }
    const start = position;
    const closers: string[] = [];
    while (position < tokens.length) {
      const token = tokens[position];
      if (token.value === undefined) {
        const text = token.text;
        if (!closers.length && ["&&", "||", ")"].includes(text)) break;
        // Ternaries can change the meaning of the surrounding Boolean clauses.
        if (!closers.length && ["?", ":", ","].includes(text)) throw new Error("Unsupported expression");
        if (text in BRACKET_PAIRS) closers.push(BRACKET_PAIRS[text]);
        else if ([")", "]", "}"].includes(text) && closers.pop() !== text) throw new Error("Unbalanced atom");
      }
      position++;
    }
    if (position === start || closers.length) throw new Error("Incomplete expression");
    const atom = tokens.slice(start, position);
    if (/^(?:in|[.!<>=+*/%-]|==|!=|<=|>=)$/.test(atom.at(-1)?.text ?? "")) throw new Error("Incomplete atom");
    return { kind: "atom", tokens: atom };
  };
  const binary = (operator: "&&" | "||"): SuggestionExpression => {
    const next = () => (operator === "&&" ? unary() : binary("&&"));
    let expression = next();
    while (take(operator)) expression = { kind: operator === "&&" ? "and" : "or", left: expression, right: next() };
    return expression;
  };
  const expression = binary("||");
  if (position !== tokens.length) throw new Error("Unsupported expression suffix");
  return expression;
}

/** Invalid or unsupported syntax contributes no inferred conditions. */
export function parseSuggestionExpression(source: string): SuggestionExpression | undefined {
  try {
    return parseExpression(source);
  } catch {
    return undefined;
  }
}

/** Read a complete list of string literals, allowing CEL's trailing comma. */
export function readStringList(tokens: SuggestionToken[]): string[] | undefined {
  if (tokens[0]?.text !== "[" || tokens.at(-1)?.text !== "]") return undefined;
  const values = tokens.slice(1, -1);
  if (values.at(-1)?.text === ",") values.pop();
  if (!values.length) return [];
  if (values.length % 2 === 0) return undefined;
  if (values.some((token, index) => (index % 2 === 0 ? token.value === undefined : token.text !== ","))) return undefined;
  return values.filter((_, index) => index % 2 === 0).map((token) => token.value as string);
}
