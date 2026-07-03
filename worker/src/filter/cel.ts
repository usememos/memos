// Minimal CEL-subset parser for memo/attachment filters, port of
// internal/filter (parser.go). Produces a small AST that render.ts turns into
// D1-compatible SQL. Supported: && || !, comparisons, `in` (both directions),
// contains/startsWith/endsWith, exists/all/exists_one macros over list fields,
// size(), now(), timestamp(), duration(), + - * arithmetic on scalars.

export type Expr =
  | { kind: "and"; left: Expr; right: Expr }
  | { kind: "or"; left: Expr; right: Expr }
  | { kind: "not"; expr: Expr }
  | { kind: "compare"; op: CompareOp; left: Expr; right: Expr }
  | { kind: "in"; element: Expr; list: Expr }
  | { kind: "call"; target: Expr | undefined; name: string; args: Expr[] }
  | { kind: "macro"; target: Expr; name: "exists" | "all" | "exists_one"; iterVar: string; predicate: Expr }
  | { kind: "ident"; name: string }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "list"; items: Expr[] }
  | { kind: "arith"; op: "+" | "-" | "*"; left: Expr; right: Expr };

export type CompareOp = "==" | "!=" | "<" | "<=" | ">" | ">=";

export class FilterError extends Error {}

interface Token {
  type: "ident" | "string" | "number" | "punct";
  value: string;
  num?: number;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const punct2 = ["==", "!=", "<=", ">=", "&&", "||"];
  while (i < input.length) {
    const ch = input[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let value = "";
      i++;
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < input.length) {
          const next = input[i + 1]!;
          const escapes: Record<string, string> = { n: "\n", t: "\t", r: "\r", '"': '"', "'": "'", "\\": "\\" };
          value += escapes[next] ?? next;
          i += 2;
        } else {
          value += input[i];
          i++;
        }
      }
      if (i >= input.length) {
        throw new FilterError("unterminated string literal");
      }
      i++;
      tokens.push({ type: "string", value });
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(input[i + 1] ?? ""))) {
      let j = i;
      while (j < input.length && /[0-9.]/.test(input[j]!)) j++;
      const raw = input.slice(i, j);
      const num = Number(raw);
      if (Number.isNaN(num)) {
        throw new FilterError(`invalid number: ${raw}`);
      }
      tokens.push({ type: "number", value: raw, num });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < input.length && /[A-Za-z0-9_]/.test(input[j]!)) j++;
      tokens.push({ type: "ident", value: input.slice(i, j) });
      i = j;
      continue;
    }
    const two = input.slice(i, i + 2);
    if (punct2.includes(two)) {
      tokens.push({ type: "punct", value: two });
      i += 2;
      continue;
    }
    if ("()[],.!<>+-*".includes(ch)) {
      tokens.push({ type: "punct", value: ch });
      i++;
      continue;
    }
    throw new FilterError(`unexpected character: ${ch}`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  parse(): Expr {
    const expr = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new FilterError(`unexpected token: ${this.tokens[this.pos]!.value}`);
    }
    return expr;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private eat(type: Token["type"], value?: string): Token {
    const token = this.tokens[this.pos];
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
      throw new FilterError(`expected ${value ?? type}, got ${token?.value ?? "end of input"}`);
    }
    this.pos++;
    return token;
  }

  private tryEat(value: string): boolean {
    const token = this.tokens[this.pos];
    if (token && token.value === value && (token.type === "punct" || token.type === "ident")) {
      this.pos++;
      return true;
    }
    return false;
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.tryEat("||")) {
      left = { kind: "or", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseRelation();
    while (this.tryEat("&&")) {
      left = { kind: "and", left, right: this.parseRelation() };
    }
    return left;
  }

  private parseRelation(): Expr {
    const left = this.parseAdditive();
    const next = this.peek();
    if (next && next.type === "punct" && ["==", "!=", "<", "<=", ">", ">="].includes(next.value)) {
      this.pos++;
      return { kind: "compare", op: next.value as CompareOp, left, right: this.parseAdditive() };
    }
    if (next && next.type === "ident" && next.value === "in") {
      this.pos++;
      return { kind: "in", element: left, list: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    for (;;) {
      if (this.tryEat("+")) {
        left = { kind: "arith", op: "+", left, right: this.parseMultiplicative() };
      } else if (this.tryEat("-")) {
        left = { kind: "arith", op: "-", left, right: this.parseMultiplicative() };
      } else {
        return left;
      }
    }
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.tryEat("*")) {
      left = { kind: "arith", op: "*", left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.tryEat("!")) {
      return { kind: "not", expr: this.parseUnary() };
    }
    return this.parseMember();
  }

  private parseMember(): Expr {
    let expr = this.parsePrimary();
    while (this.tryEat(".")) {
      const name = this.eat("ident").value;
      if (this.tryEat("(")) {
        if (name === "exists" || name === "all" || name === "exists_one") {
          const iterVar = this.eat("ident").value;
          this.eat("punct", ",");
          const predicate = this.parseOr();
          this.eat("punct", ")");
          expr = { kind: "macro", target: expr, name, iterVar, predicate };
        } else {
          const args = this.parseArgs();
          expr = { kind: "call", target: expr, name, args };
        }
      } else {
        throw new FilterError(`unsupported member access: .${name}`);
      }
    }
    return expr;
  }

  private parseArgs(): Expr[] {
    const args: Expr[] = [];
    if (this.tryEat(")")) {
      return args;
    }
    for (;;) {
      args.push(this.parseOr());
      if (this.tryEat(")")) {
        return args;
      }
      this.eat("punct", ",");
    }
  }

  private parsePrimary(): Expr {
    const token = this.peek();
    if (!token) {
      throw new FilterError("unexpected end of filter");
    }
    if (token.type === "string") {
      this.pos++;
      return { kind: "literal", value: token.value };
    }
    if (token.type === "number") {
      this.pos++;
      return { kind: "literal", value: token.num! };
    }
    if (token.type === "punct" && token.value === "(") {
      this.pos++;
      const expr = this.parseOr();
      this.eat("punct", ")");
      return expr;
    }
    if (token.type === "punct" && token.value === "[") {
      this.pos++;
      const items: Expr[] = [];
      if (!this.tryEat("]")) {
        for (;;) {
          items.push(this.parseOr());
          if (this.tryEat("]")) break;
          this.eat("punct", ",");
        }
      }
      return { kind: "list", items };
    }
    if (token.type === "punct" && token.value === "-") {
      this.pos++;
      const operand = this.parsePrimary();
      if (operand.kind === "literal" && typeof operand.value === "number") {
        return { kind: "literal", value: -operand.value };
      }
      throw new FilterError("unary minus is only supported on number literals");
    }
    if (token.type === "ident") {
      this.pos++;
      if (token.value === "true" || token.value === "false") {
        return { kind: "literal", value: token.value === "true" };
      }
      if (token.value === "null") {
        return { kind: "literal", value: null };
      }
      if (this.tryEat("(")) {
        return { kind: "call", target: undefined, name: token.value, args: this.parseArgs() };
      }
      return { kind: "ident", name: token.value };
    }
    throw new FilterError(`unexpected token: ${token.value}`);
  }
}

export function parseFilter(input: string): Expr {
  return new Parser(tokenize(input)).parse();
}
