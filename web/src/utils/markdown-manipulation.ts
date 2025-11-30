// Utilities for manipulating markdown strings (GitHub-style approach)
// These functions modify the raw markdown text directly without parsing to AST

export function toggleTaskAtLine(markdown: string, lineNumber: number, checked: boolean): string {
  const lines = markdown.split("\n");

  if (lineNumber < 0 || lineNumber >= lines.length) {
    return markdown;
  }

  const line = lines[lineNumber];

  // Match task list patterns: - [ ], - [x], - [X], etc.
  const taskPattern = /^(\s*[-*+]\s+)\[([ xX])\](\s+.*)$/;
  const match = line.match(taskPattern);

  if (!match) {
    return markdown;
  }

  const [, prefix, , suffix] = match;
  const newCheckmark = checked ? "x" : " ";
  lines[lineNumber] = `${prefix}[${newCheckmark}]${suffix}`;

  return lines.join("\n");
}

export function toggleTaskAtIndex(markdown: string, taskIndex: number, checked: boolean): string {
  const lines = markdown.split("\n");
  const taskPattern = /^(\s*[-*+]\s+)\[([ xX])\](\s+.*)$/;

  let currentTaskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(taskPattern);

    if (match) {
      if (currentTaskIndex === taskIndex) {
        const [, prefix, , suffix] = match;
        const newCheckmark = checked ? "x" : " ";
        lines[i] = `${prefix}[${newCheckmark}]${suffix}`;
        break;
      }
      currentTaskIndex++;
    }
  }

  return lines.join("\n");
}

export function removeCompletedTasks(markdown: string): string {
  const lines = markdown.split("\n");
  const completedTaskPattern = /^(\s*[-*+]\s+)\[([xX])\](\s+.*)$/;
  const result: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip completed tasks
    if (completedTaskPattern.test(line)) {
      // Also skip the following line if it's empty (preserve spacing)
      if (i + 1 < lines.length && lines[i + 1].trim() === "") {
        i++;
      }
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
}

export function countTasks(markdown: string): {
  total: number;
  completed: number;
  incomplete: number;
} {
  const lines = markdown.split("\n");
  const taskPattern = /^(\s*[-*+]\s+)\[([ xX])\](\s+.*)$/;

  let total = 0;
  let completed = 0;

  for (const line of lines) {
    const match = line.match(taskPattern);
    if (match) {
      total++;
      const checkmark = match[2];
      if (checkmark.toLowerCase() === "x") {
        completed++;
      }
    }
  }

  return {
    total,
    completed,
    incomplete: total - completed,
  };
}

export function hasCompletedTasks(markdown: string): boolean {
  const completedTaskPattern = /^(\s*[-*+]\s+)\[([xX])\](\s+.*)$/m;
  return completedTaskPattern.test(markdown);
}

export function getTaskLineNumber(markdown: string, taskIndex: number): number {
  const lines = markdown.split("\n");
  const taskPattern = /^(\s*[-*+]\s+)\[([ xX])\](\s+.*)$/;

  let currentTaskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    if (taskPattern.test(lines[i])) {
      if (currentTaskIndex === taskIndex) {
        return i;
      }
      currentTaskIndex++;
    }
  }

  return -1;
}

export interface TaskItem {
  lineNumber: number;
  taskIndex: number;
  checked: boolean;
  content: string;
  indentation: number;
}

export function extractTasks(markdown: string): TaskItem[] {
  const lines = markdown.split("\n");
  const taskPattern = /^(\s*)([-*+]\s+)\[([ xX])\](\s+.*)$/;
  const tasks: TaskItem[] = [];

  let taskIndex = 0;

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber];
    const match = line.match(taskPattern);

    if (match) {
      const [, indentStr, , checkmark, content] = match;
      tasks.push({
        lineNumber,
        taskIndex: taskIndex++,
        checked: checkmark.toLowerCase() === "x",
        content: content.trim(),
        indentation: indentStr.length,
      });
    }
  }

  return tasks;
}
