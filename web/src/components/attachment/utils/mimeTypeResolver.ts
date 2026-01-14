export type PreviewType = "image" | "pdf" | "video" | "audio" | "text" | "code" | "office" | "fallback";

const CODE_EXTENSIONS = [
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".c",
  ".cpp",
  ".h",
  ".hpp",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".scala",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  ".sql",
  ".graphql",
  ".yaml",
  ".yml",
  ".toml",
  ".json",
  ".xml",
  ".html",
  ".css",
  ".scss",
  ".less",
  ".vue",
  ".svelte",
  ".md",
  ".mdx",
  ".rst",
  ".tex",
  ".dockerfile",
  ".makefile",
];

const CODE_MIME_TYPES = [
  "application/javascript",
  "application/typescript",
  "application/json",
  "application/xml",
  "application/x-yaml",
  "application/toml",
];

// Microsoft Office MIME types
const OFFICE_MIME_TYPES = [
  // PowerPoint
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  // Word
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  // Excel
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// Office file extensions
const OFFICE_EXTENSIONS = [".ppt", ".pptx", ".doc", ".docx", ".xls", ".xlsx"];

export function getPreviewType(mimeType: string, filename: string): PreviewType {
  // Images
  if (mimeType.startsWith("image/")) {
    return "image";
  }

  // PDF
  if (mimeType === "application/pdf") {
    return "pdf";
  }

  // Video
  if (mimeType.startsWith("video/")) {
    return "video";
  }

  // Audio
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }

  // Office files (by MIME type)
  if (OFFICE_MIME_TYPES.includes(mimeType)) {
    return "office";
  }

  // Office files (by extension)
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex !== -1) {
    const ext = filename.substring(lastDotIndex).toLowerCase();
    if (OFFICE_EXTENSIONS.includes(ext)) {
      return "office";
    }
  }

  // Code files (by MIME type)
  if (CODE_MIME_TYPES.includes(mimeType)) {
    return "code";
  }

  // Code files (by extension)
  if (lastDotIndex !== -1) {
    const ext = filename.substring(lastDotIndex).toLowerCase();
    if (CODE_EXTENSIONS.includes(ext)) {
      return "code";
    }
  }

  // Plain text
  if (mimeType.startsWith("text/")) {
    return "text";
  }

  // Fallback for unsupported types
  return "fallback";
}

export function getLanguageFromFilename(filename: string): string {
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex === -1) return "plaintext";

  const ext = filename.substring(lastDotIndex + 1).toLowerCase();
  const languageMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    jsx: "jsx",
    tsx: "tsx",
    py: "python",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    sql: "sql",
    yaml: "yaml",
    yml: "yaml",
    json: "json",
    xml: "xml",
    html: "html",
    css: "css",
    scss: "scss",
    md: "markdown",
    sh: "bash",
    bash: "bash",
    dockerfile: "dockerfile",
  };
  return languageMap[ext] || "plaintext";
}
