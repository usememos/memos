// Renders the parsed CEL AST into D1-compatible SQL (SQLite dialect, no
// custom functions). Port of internal/filter/render.go semantics.
import { FilterError, parseFilter, type CompareOp, type Expr } from "./cel";

export interface FieldSpec {
  /** SQL expression for the field value. */
  expr: string;
  type: "string" | "int" | "bool" | "timestamp";
  /** JSON list fields (e.g. tags) rendered via json_each. */
  jsonListExpr?: string;
  supportsContains?: boolean;
  /** Restrict comparisons to = / != (matches Go AllowedComparisonOps). */
  eqOnly?: boolean;
}

export type FilterSchema = Record<string, FieldSpec>;

// memo queries always join `user memo_creator ON memo.creator_id = memo_creator.id`.
export const MEMO_FILTER_SCHEMA: FilterSchema = {
  content: { expr: "memo.content", type: "string", supportsContains: true },
  creator: { expr: "('users/' || memo_creator.username)", type: "string", eqOnly: true },
  creator_id: { expr: "memo.creator_id", type: "int", eqOnly: true },
  created_ts: { expr: "memo.created_ts", type: "timestamp" },
  updated_ts: { expr: "memo.updated_ts", type: "timestamp" },
  pinned: { expr: "memo.pinned", type: "bool", eqOnly: true },
  visibility: { expr: "memo.visibility", type: "string", eqOnly: true },
  tags: { expr: "memo.payload", type: "string", jsonListExpr: "json_extract(memo.payload, '$.tags')" },
  tag: { expr: "memo.payload", type: "string", jsonListExpr: "json_extract(memo.payload, '$.tags')" },
  has_task_list: { expr: "COALESCE(json_extract(memo.payload, '$.property.hasTaskList'), 0)", type: "bool", eqOnly: true },
  has_link: { expr: "COALESCE(json_extract(memo.payload, '$.property.hasLink'), 0)", type: "bool", eqOnly: true },
  has_code: { expr: "COALESCE(json_extract(memo.payload, '$.property.hasCode'), 0)", type: "bool", eqOnly: true },
  has_incomplete_tasks: {
    expr: "COALESCE(json_extract(memo.payload, '$.property.hasIncompleteTasks'), 0)",
    type: "bool",
    eqOnly: true,
  },
};

export const ATTACHMENT_FILTER_SCHEMA: FilterSchema = {
  filename: { expr: "attachment.filename", type: "string", supportsContains: true },
  mime_type: { expr: "attachment.type", type: "string", supportsContains: true },
  create_time: { expr: "attachment.created_ts", type: "timestamp" },
  memo_id: { expr: "attachment.memo_id", type: "int", eqOnly: true },
};

export interface RenderedFilter {
  sql: string;
  args: unknown[];
}

export function renderFilter(filter: string, schema: FilterSchema): RenderedFilter {
  const expr = parseFilter(filter);
  const renderer = new Renderer(schema);
  const sql = renderer.condition(expr);
  return { sql, args: renderer.args };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Go duration literals: "300s", "1.5h", "2h45m" etc.
function parseDuration(value: string): number {
  const matches = [...value.matchAll(/(-?\d+(?:\.\d+)?)(ns|us|µs|ms|s|m|h)/g)];
  if (matches.length === 0 || matches.map((m) => m[0]).join("") !== value) {
    throw new FilterError(`invalid duration: ${value}`);
  }
  const unitSeconds: Record<string, number> = { ns: 1e-9, us: 1e-6, "µs": 1e-6, ms: 1e-3, s: 1, m: 60, h: 3600 };
  let total = 0;
  for (const m of matches) {
    total += Number(m[1]) * unitSeconds[m[2]!]!;
  }
  return Math.trunc(total);
}

class Renderer {
  args: unknown[] = [];
  constructor(private schema: FilterSchema) {}

  private field(name: string): FieldSpec {
    const spec = this.schema[name];
    if (!spec) {
      throw new FilterError(`unknown filter field: ${name}`);
    }
    return spec;
  }

  private param(value: unknown): string {
    this.args.push(value);
    return "?";
  }

  condition(expr: Expr): string {
    switch (expr.kind) {
      case "and":
        return `(${this.condition(expr.left)} AND ${this.condition(expr.right)})`;
      case "or":
        return `(${this.condition(expr.left)} OR ${this.condition(expr.right)})`;
      case "not":
        return `NOT (${this.condition(expr.expr)})`;
      case "compare":
        return this.comparison(expr.op, expr.left, expr.right);
      case "in":
        return this.inCondition(expr.element, expr.list);
      case "call":
        return this.callCondition(expr);
      case "macro":
        return this.macroCondition(expr);
      case "ident": {
        // Bare identifier used as a boolean predicate (`pinned`, `has_link`).
        const spec = this.field(expr.name);
        if (spec.type !== "bool") {
          throw new FilterError(`field ${expr.name} is not boolean`);
        }
        return `${spec.expr} = 1`;
      }
      case "literal":
        if (typeof expr.value === "boolean") {
          return expr.value ? "1 = 1" : "1 = 0";
        }
        throw new FilterError("literal is not a boolean condition");
      default:
        throw new FilterError(`unsupported filter expression: ${expr.kind}`);
    }
  }

  private comparison(op: CompareOp, left: Expr, right: Expr): string {
    // Normalize `literal op field` to `field op literal`.
    if (left.kind === "literal" && right.kind === "ident") {
      const flipped: Record<CompareOp, CompareOp> = { "==": "==", "!=": "!=", "<": ">", "<=": ">=", ">": "<", ">=": "<=" };
      return this.comparison(flipped[op], right, left);
    }
    const sqlOp = op === "==" ? "=" : op;
    if (left.kind === "ident") {
      const spec = this.field(left.name);
      if (spec.jsonListExpr) {
        // tag == "x": exact or hierarchical descendant ("x/...").
        if (op !== "==" && op !== "!=") {
          throw new FilterError(`operator ${op} is not supported on ${left.name}`);
        }
        const value = this.literalValue(right, spec);
        const match = `EXISTS (SELECT 1 FROM json_each(COALESCE(${spec.jsonListExpr}, '[]')) WHERE json_each.value = ${this.param(value)} OR json_each.value LIKE ${this.param(`${escapeLike(String(value))}/%`)} ESCAPE '\\')`;
        return op === "==" ? match : `NOT ${match}`;
      }
      if (spec.eqOnly && op !== "==" && op !== "!=") {
        throw new FilterError(`operator ${op} is not supported on ${left.name}`);
      }
      return `${spec.expr} ${sqlOp} ${this.valueExpr(right, spec)}`;
    }
    // size(tags) == 2, arithmetic on both sides, etc.
    return `${this.valueExpr(left)} ${sqlOp} ${this.valueExpr(right)}`;
  }

  private inCondition(element: Expr, list: Expr): string {
    // field in [literal, ...]
    if (element.kind === "ident" && list.kind === "list") {
      const spec = this.field(element.name);
      if (spec.jsonListExpr) {
        // tag in ["a", "b"]: any exact or hierarchical match.
        const clauses = list.items.map((item) => {
          const value = this.literalValue(item, spec);
          return `json_each.value = ${this.param(value)} OR json_each.value LIKE ${this.param(`${escapeLike(String(value))}/%`)} ESCAPE '\\'`;
        });
        return `EXISTS (SELECT 1 FROM json_each(COALESCE(${spec.jsonListExpr}, '[]')) WHERE ${clauses.join(" OR ")})`;
      }
      const params = list.items.map((item) => this.param(this.literalValue(item, spec)));
      return `${spec.expr} IN (${params.join(", ")})`;
    }
    // "value" in tags
    if (element.kind === "literal" && list.kind === "ident") {
      const spec = this.field(list.name);
      if (!spec.jsonListExpr) {
        throw new FilterError(`${list.name} is not a list field`);
      }
      return `EXISTS (SELECT 1 FROM json_each(COALESCE(${spec.jsonListExpr}, '[]')) WHERE json_each.value = ${this.param(element.value)})`;
    }
    throw new FilterError("unsupported `in` expression");
  }

  private callCondition(expr: Extract<Expr, { kind: "call" }>): string {
    if (!expr.target || expr.target.kind !== "ident") {
      throw new FilterError(`unsupported function: ${expr.name}`);
    }
    const spec = this.field(expr.target.name);
    const arg = expr.args[0];
    if (!arg || arg.kind !== "literal" || typeof arg.value !== "string") {
      throw new FilterError(`${expr.name}() requires a string literal argument`);
    }
    if (spec.jsonListExpr) {
      // tag.startsWith("x") etc. treated as exists(t, t.op(...)).
      return this.jsonListPredicate(spec.jsonListExpr, "exists", expr.name, arg.value);
    }
    if (spec.type !== "string") {
      throw new FilterError(`${expr.name}() is only supported on string fields`);
    }
    if (expr.name === "matches") {
      throw new FilterError("matches() is not supported on Cloudflare D1");
    }
    if (expr.name === "contains" && !spec.supportsContains) {
      throw new FilterError(`contains() is not supported on ${expr.target.name}`);
    }
    const patterns: Record<string, string> = {
      contains: `%${escapeLike(arg.value)}%`,
      startsWith: `${escapeLike(arg.value)}%`,
      endsWith: `%${escapeLike(arg.value)}`,
    };
    const pattern = patterns[expr.name];
    if (!pattern) {
      throw new FilterError(`unsupported function: ${expr.name}`);
    }
    return `LOWER(${spec.expr}) LIKE LOWER(${this.param(pattern)}) ESCAPE '\\'`;
  }

  private macroCondition(expr: Extract<Expr, { kind: "macro" }>): string {
    if (expr.target.kind !== "ident") {
      throw new FilterError("macros are only supported on list fields");
    }
    const spec = this.field(expr.target.name);
    if (!spec.jsonListExpr) {
      throw new FilterError(`${expr.target.name} is not a list field`);
    }
    const predicate = expr.predicate;
    let fn: string;
    let value: string;
    if (predicate.kind === "call" && predicate.target?.kind === "ident" && predicate.target.name === expr.iterVar) {
      const arg = predicate.args[0];
      if (!arg || arg.kind !== "literal" || typeof arg.value !== "string") {
        throw new FilterError("macro predicate requires a string literal");
      }
      fn = predicate.name;
      value = arg.value;
    } else if (
      predicate.kind === "compare" &&
      predicate.op === "==" &&
      predicate.left.kind === "ident" &&
      predicate.left.name === expr.iterVar &&
      predicate.right.kind === "literal"
    ) {
      fn = "equals";
      value = String(predicate.right.value);
    } else {
      throw new FilterError("unsupported macro predicate");
    }
    return this.jsonListPredicate(spec.jsonListExpr, expr.name, fn, value);
  }

  private jsonListPredicate(listExpr: string, macro: "exists" | "all" | "exists_one", fn: string, value: string): string {
    const patterns: Record<string, () => string> = {
      equals: () => `json_each.value = ${this.param(value)}`,
      contains: () => `json_each.value LIKE ${this.param(`%${escapeLike(value)}%`)} ESCAPE '\\'`,
      startsWith: () => `json_each.value LIKE ${this.param(`${escapeLike(value)}%`)} ESCAPE '\\'`,
      endsWith: () => `json_each.value LIKE ${this.param(`%${escapeLike(value)}`)} ESCAPE '\\'`,
    };
    const build = patterns[fn];
    if (!build) {
      throw new FilterError(`unsupported predicate: ${fn}`);
    }
    const elemCond = build();
    const source = `json_each(COALESCE(${listExpr}, '[]'))`;
    switch (macro) {
      case "exists":
        return `EXISTS (SELECT 1 FROM ${source} WHERE ${elemCond})`;
      case "all":
        return `NOT EXISTS (SELECT 1 FROM ${source} WHERE NOT (${elemCond}))`;
      case "exists_one":
        return `(SELECT COUNT(*) FROM ${source} WHERE ${elemCond}) = 1`;
    }
  }

  // Renders a value-position expression (right side of comparisons, arithmetic).
  private valueExpr(expr: Expr, fieldSpec?: FieldSpec): string {
    switch (expr.kind) {
      case "literal":
        return this.param(this.literalValue(expr, fieldSpec));
      case "ident": {
        const spec = this.field(expr.name);
        return spec.expr;
      }
      case "arith":
        return `(${this.valueExpr(expr.left, fieldSpec)} ${expr.op} ${this.valueExpr(expr.right, fieldSpec)})`;
      case "call":
        return this.valueFunction(expr, fieldSpec);
      default:
        throw new FilterError(`unsupported value expression: ${expr.kind}`);
    }
  }

  private valueFunction(expr: Extract<Expr, { kind: "call" }>, fieldSpec?: FieldSpec): string {
    if (expr.target !== undefined) {
      throw new FilterError(`unsupported function: ${expr.name}`);
    }
    switch (expr.name) {
      case "now":
        return this.param(Math.floor(Date.now() / 1000));
      case "timestamp": {
        const arg = expr.args[0];
        if (arg?.kind === "literal" && typeof arg.value === "number") {
          return this.param(Math.trunc(arg.value));
        }
        if (arg?.kind === "literal" && typeof arg.value === "string") {
          const parsed = Date.parse(arg.value);
          if (Number.isNaN(parsed)) {
            throw new FilterError(`invalid timestamp: ${arg.value}`);
          }
          return this.param(Math.floor(parsed / 1000));
        }
        throw new FilterError("timestamp() requires a number or RFC3339 string");
      }
      case "duration": {
        const arg = expr.args[0];
        if (arg?.kind === "literal" && typeof arg.value === "string") {
          return this.param(parseDuration(arg.value));
        }
        if (arg?.kind === "literal" && typeof arg.value === "number") {
          return this.param(Math.trunc(arg.value));
        }
        throw new FilterError("duration() requires a string literal");
      }
      case "size": {
        const arg = expr.args[0];
        if (arg?.kind === "ident") {
          const spec = this.field(arg.name);
          if (spec.jsonListExpr) {
            return `json_array_length(COALESCE(${spec.jsonListExpr}, '[]'))`;
          }
          return `LENGTH(${spec.expr})`;
        }
        throw new FilterError("size() requires a field argument");
      }
      default:
        throw new FilterError(`unsupported function: ${expr.name}`);
    }
    void fieldSpec;
  }

  private literalValue(expr: Expr, spec?: FieldSpec): string | number | boolean | null {
    if (expr.kind !== "literal") {
      throw new FilterError("expected a literal value");
    }
    if (spec?.type === "bool" && typeof expr.value === "boolean") {
      return expr.value ? 1 : 0;
    }
    return expr.value;
  }
}
