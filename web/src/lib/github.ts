// GitHub API service for storing memos as GitHub Issues

const GITHUB_API = "https://api.github.com";

export interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<{ name: string; color: string }>;
  created_at: string;
  updated_at: string;
  user: GitHubUser;
}

export interface Memo {
  id: string;
  content: string;
  visibility: "PUBLIC" | "PRIVATE";
  pinned: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  creator: {
    name: string;
    avatarUrl: string;
  };
}

// Convert GitHub Issue to Memo
function issueToMemo(issue: GitHubIssue): Memo {
  const labels = issue.labels.map((l) => l.name);
  const isPinned = labels.includes("pinned");
  const isPrivate = labels.includes("private");
  const tags = labels.filter((l) => l.startsWith("tag:")).map((l) => l.replace("tag:", ""));

  return {
    id: issue.number.toString(),
    content: issue.body || "",
    visibility: isPrivate ? "PRIVATE" : "PUBLIC",
    pinned: isPinned,
    tags,
    createdAt: new Date(issue.created_at),
    updatedAt: new Date(issue.updated_at),
    creator: {
      name: issue.user.login,
      avatarUrl: issue.user.avatar_url,
    },
  };
}

// Extract tags from content (e.g., #tag1 #tag2)
function extractTags(content: string): string[] {
  const tagRegex = /#([a-zA-Z0-9_-]+)/g;
  const matches = content.match(tagRegex) || [];
  return [...new Set(matches.map((tag) => tag.slice(1)))];
}

class GitHubMemoService {
  private token: string | null = null;
  private repo: string | null = null;
  private owner: string | null = null;

  setAuth(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  clearAuth() {
    this.token = null;
    this.owner = null;
    this.repo = null;
  }

  isAuthenticated(): boolean {
    return !!this.token && !!this.owner && !!this.repo;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.token) {
      throw new Error("Not authenticated");
    }

    const response = await fetch(`${GITHUB_API}${endpoint}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  async getCurrentUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>("/user");
  }

  async listMemos(options: { state?: "open" | "closed" | "all"; labels?: string } = {}): Promise<Memo[]> {
    const params = new URLSearchParams({
      state: options.state || "open",
      per_page: "100",
      sort: "updated",
      direction: "desc",
    });

    if (options.labels) {
      params.set("labels", options.labels);
    }

    // Filter by "memo" label to distinguish from other issues
    const labelsParam = options.labels ? `memo,${options.labels}` : "memo";
    params.set("labels", labelsParam);

    const issues = await this.request<GitHubIssue[]>(
      `/repos/${this.owner}/${this.repo}/issues?${params.toString()}`
    );

    return issues.map(issueToMemo);
  }

  async getMemo(id: string): Promise<Memo> {
    const issue = await this.request<GitHubIssue>(
      `/repos/${this.owner}/${this.repo}/issues/${id}`
    );
    return issueToMemo(issue);
  }

  async createMemo(content: string, options: { visibility?: "PUBLIC" | "PRIVATE"; pinned?: boolean } = {}): Promise<Memo> {
    const tags = extractTags(content);
    const labels = ["memo"];

    if (options.visibility === "PRIVATE") {
      labels.push("private");
    }

    if (options.pinned) {
      labels.push("pinned");
    }

    tags.forEach((tag) => labels.push(`tag:${tag}`));

    // Create a title from first line or first 50 chars
    const firstLine = content.split("\n")[0].replace(/^#\s*/, "").trim();
    const title = firstLine.slice(0, 50) || "Untitled memo";

    const issue = await this.request<GitHubIssue>(
      `/repos/${this.owner}/${this.repo}/issues`,
      {
        method: "POST",
        body: JSON.stringify({
          title,
          body: content,
          labels,
        }),
      }
    );

    return issueToMemo(issue);
  }

  async updateMemo(
    id: string,
    content: string,
    options: { visibility?: "PUBLIC" | "PRIVATE"; pinned?: boolean } = {}
  ): Promise<Memo> {
    const tags = extractTags(content);
    const labels = ["memo"];

    if (options.visibility === "PRIVATE") {
      labels.push("private");
    }

    if (options.pinned) {
      labels.push("pinned");
    }

    tags.forEach((tag) => labels.push(`tag:${tag}`));

    const firstLine = content.split("\n")[0].replace(/^#\s*/, "").trim();
    const title = firstLine.slice(0, 50) || "Untitled memo";

    const issue = await this.request<GitHubIssue>(
      `/repos/${this.owner}/${this.repo}/issues/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title,
          body: content,
          labels,
        }),
      }
    );

    return issueToMemo(issue);
  }

  async deleteMemo(id: string): Promise<void> {
    // GitHub doesn't allow deleting issues, so we close it and add "archived" label
    await this.request<GitHubIssue>(
      `/repos/${this.owner}/${this.repo}/issues/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          state: "closed",
          labels: ["memo", "archived"],
        }),
      }
    );
  }

  async togglePin(id: string, pinned: boolean): Promise<Memo> {
    const memo = await this.getMemo(id);
    return this.updateMemo(id, memo.content, { ...memo, pinned });
  }

  async searchMemos(query: string): Promise<Memo[]> {
    const searchQuery = `repo:${this.owner}/${this.repo} is:issue label:memo ${query}`;

    const result = await this.request<{ items: GitHubIssue[] }>(
      `/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=50`
    );

    return result.items.map(issueToMemo);
  }

  async getAllTags(): Promise<string[]> {
    const labels = await this.request<Array<{ name: string }>>(
      `/repos/${this.owner}/${this.repo}/labels?per_page=100`
    );

    return labels
      .filter((l) => l.name.startsWith("tag:"))
      .map((l) => l.name.replace("tag:", ""));
  }

  async ensureLabelsExist(): Promise<void> {
    const requiredLabels = [
      { name: "memo", color: "0969da", description: "A memo entry" },
      { name: "pinned", color: "fbca04", description: "Pinned memo" },
      { name: "private", color: "d73a4a", description: "Private memo" },
      { name: "archived", color: "6e7681", description: "Archived memo" },
    ];

    const existingLabels = await this.request<Array<{ name: string }>>(
      `/repos/${this.owner}/${this.repo}/labels?per_page=100`
    );

    const existingNames = new Set(existingLabels.map((l) => l.name));

    for (const label of requiredLabels) {
      if (!existingNames.has(label.name)) {
        await this.request(`/repos/${this.owner}/${this.repo}/labels`, {
          method: "POST",
          body: JSON.stringify(label),
        }).catch(() => {
          // Label might already exist, ignore error
        });
      }
    }
  }
}

export const githubMemoService = new GitHubMemoService();

// Auth helpers
const TOKEN_KEY = "memos_github_token";
const OWNER_KEY = "memos_github_owner";
const REPO_KEY = "memos_github_repo";

export function saveAuth(token: string, owner: string, repo: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(OWNER_KEY, owner);
  localStorage.setItem(REPO_KEY, repo);
  githubMemoService.setAuth(token, owner, repo);
}

export function loadAuth(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);
  const owner = localStorage.getItem(OWNER_KEY);
  const repo = localStorage.getItem(REPO_KEY);

  if (token && owner && repo) {
    githubMemoService.setAuth(token, owner, repo);
    return true;
  }
  return false;
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(OWNER_KEY);
  localStorage.removeItem(REPO_KEY);
  githubMemoService.clearAuth();
}

export function getStoredRepo(): { owner: string; repo: string } | null {
  const owner = localStorage.getItem(OWNER_KEY);
  const repo = localStorage.getItem(REPO_KEY);
  if (owner && repo) {
    return { owner, repo };
  }
  return null;
}
