/**
 * Utilities for manipulating markdown strings (GitHub-style approach)
 *
 * These functions modify the raw markdown text directly without parsing to AST.
 * This is the same approach GitHub uses for task list updates.
 */

/**
 * Toggle a task checkbox at a specific line number
 *
 * @param markdown - The full markdown content
 * @param lineNumber - Zero-based line number
 * @param checked - New checked state
 * @returns Updated markdown string
 */
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
    // Not a task list item
    return markdown;
  }

  const [, prefix, , suffix] = match;
  const newCheckmark = checked ? "x" : " ";
  lines[lineNumber] = `${prefix}[${newCheckmark}]${suffix}`;

  return lines.join("\n");
}

/**
 * Toggle a task checkbox by its index (nth task in the document)
 *
 * @param markdown - The full markdown content
 * @param taskIndex - Zero-based index of the task (0 = first task, 1 = second task, etc.)
 * @param checked - New checked state
 * @returns Updated markdown string
 */
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

/**
 * Remove all completed tasks from markdown
 *
 * @param markdown - The full markdown content
 * @returns Markdown with completed tasks removed
 */
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
        i++; // Skip next line
      }
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
}

/**
 * Count tasks in markdown
 *
 * @param markdown - The full markdown content
 * @returns Object with task counts
 */
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

/**
 * Check if markdown has any completed tasks
 *
 * @param markdown - The full markdown content
 * @returns True if there are completed tasks
 */
export function hasCompletedTasks(markdown: string): boolean {
  const completedTaskPattern = /^(\s*[-*+]\s+)\[([xX])\](\s+.*)$/m;
  return completedTaskPattern.test(markdown);
}

/**
 * Get the line number of the nth task
 *
 * @param markdown - The full markdown content
 * @param taskIndex - Zero-based task index
 * @returns Line number, or -1 if not found
 */
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

/**
 * Extract all task items with their metadata
 *
 * @param markdown - The full markdown content
 * @returns Array of task metadata
 */
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
