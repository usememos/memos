import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { MemoSchema, type Visibility } from "@/types/proto/api/v1/memo_service_pb";
import { convertVisibilityFromString, convertVisibilityToString } from "@/utils/memo";

const COLUMN_ALIASES = {
  title: ["title", "name", "memo"],
  deadline: ["deadline", "due", "due_date", "due-date", "due date", "display_time", "display time"],
  description: ["description", "details", "content", "note", "notes"],
  visibility: ["visibility", "scope", "access"],
  tags: ["tags", "tag"],
} as const;

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

export const DEADLINE_IMPORT_SAMPLE_CSV = `title,deadline,description,visibility,tags
CS304 Open Source PR,2026-04-10 23:59,Submit the PR URL to Blackboard,PRIVATE,cs304;deadline
Database Homework,2026-04-15 18:00,Finish chapter 6 exercises,PROTECTED,database;homework`;

export interface ParsedDeadlineImportEntry {
  rowNumber: number;
  title: string;
  deadline: Date;
  description: string;
  visibility?: Visibility;
  tags: string[];
}

export interface ParsedDeadlineImportResult {
  entries: ParsedDeadlineImportEntry[];
  errors: string[];
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function findColumnIndex(headers: string[], field: keyof typeof COLUMN_ALIASES): number {
  const aliases = COLUMN_ALIASES[field] as readonly string[];
  return headers.findIndex((header) => aliases.includes(header));
}

function parseCsvRecords(text: string): string[][] {
  const rows: string[][] = [];
  const normalized = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];

    if (inQuotes) {
      // CSV escapes quotes by doubling them inside a quoted field.
      if (character === '"') {
        if (normalized[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      inQuotes = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new Error("Unterminated quoted field in CSV file.");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((record) => record.some((cell) => cell.trim() !== ""));
}

function parseDeadline(value: string): Date | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const dateTimeMatch = trimmed.match(DATE_TIME_PATTERN);
  if (dateTimeMatch) {
    const [, year, month, day, hour, minute, second = "0"] = dateTimeMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const dateOnlyMatch = trimmed.match(DATE_ONLY_PATTERN);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const fallback = new Date(trimmed);
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }

  return undefined;
}

function normalizeTags(value: string): string[] {
  const tags = value
    .split(/[;,|]/)
    .map((tag) => tag.trim().replace(/^#/, "").replace(/\s+/g, "-"))
    .filter(Boolean);

  return [...new Set(tags)];
}

function parseVisibility(value: string): Visibility | undefined {
  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }

  if (!["PRIVATE", "PROTECTED", "PUBLIC"].includes(normalized)) {
    throw new Error(`Invalid visibility "${value}". Use PRIVATE, PROTECTED, or PUBLIC.`);
  }

  return convertVisibilityFromString(normalized);
}

export function parseDeadlineCsv(text: string): ParsedDeadlineImportResult {
  const records = parseCsvRecords(text);
  if (records.length === 0) {
    return {
      entries: [],
      errors: ["The CSV file is empty."],
    };
  }

  const headers = records[0].map(normalizeHeader);
  const titleIndex = findColumnIndex(headers, "title");
  const deadlineIndex = findColumnIndex(headers, "deadline");
  const descriptionIndex = findColumnIndex(headers, "description");
  const visibilityIndex = findColumnIndex(headers, "visibility");
  const tagsIndex = findColumnIndex(headers, "tags");
  const missingColumns: string[] = [];

  if (titleIndex === -1) {
    missingColumns.push("title");
  }
  if (deadlineIndex === -1) {
    missingColumns.push("deadline");
  }

  if (missingColumns.length > 0) {
    return {
      entries: [],
      errors: [`Missing required columns: ${missingColumns.join(", ")}.`],
    };
  }

  const entries: ParsedDeadlineImportEntry[] = [];
  const errors: string[] = [];

  for (const [index, record] of records.slice(1).entries()) {
    const rowNumber = index + 2;
    try {
      const title = (record[titleIndex] ?? "").trim().replace(/\s+/g, " ");
      const deadlineValue = (record[deadlineIndex] ?? "").trim();
      const description = descriptionIndex === -1 ? "" : (record[descriptionIndex] ?? "").trim();
      const visibilityValue = visibilityIndex === -1 ? "" : (record[visibilityIndex] ?? "").trim();
      const tagsValue = tagsIndex === -1 ? "" : (record[tagsIndex] ?? "").trim();

      if (!title && !deadlineValue && !description && !visibilityValue && !tagsValue) {
        continue;
      }

      if (!title) {
        throw new Error("Title is required.");
      }

      const deadline = parseDeadline(deadlineValue);
      if (!deadline) {
        throw new Error(`Invalid deadline "${deadlineValue}". Use YYYY-MM-DD, YYYY-MM-DD HH:mm, YYYY-MM-DD HH:mm:ss, or ISO 8601.`);
      }

      entries.push({
        rowNumber,
        title,
        deadline,
        description,
        visibility: visibilityValue ? parseVisibility(visibilityValue) : undefined,
        tags: normalizeTags(tagsValue),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown import error.";
      errors.push(`Row ${rowNumber}: ${message}`);
    }
  }

  if (entries.length === 0 && errors.length === 0) {
    errors.push("No valid rows were found in the CSV file.");
  }

  return { entries, errors };
}

export function formatDeadlineForDisplay(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function getVisibilityLabel(visibility: Visibility): string {
  return convertVisibilityToString(visibility);
}

export function buildDeadlineMemo(entry: ParsedDeadlineImportEntry, defaultVisibility: Visibility) {
  const lines = [`# ${entry.title}`, "", `**Deadline:** ${formatDeadlineForDisplay(entry.deadline)}`];

  if (entry.description) {
    lines.push("", entry.description);
  }

  if (entry.tags.length > 0) {
    lines.push("", entry.tags.map((tag) => `#${tag}`).join(" "));
  }

  return create(MemoSchema, {
    content: lines.join("\n"),
    visibility: entry.visibility ?? defaultVisibility,
    displayTime: timestampFromDate(entry.deadline),
  });
}
