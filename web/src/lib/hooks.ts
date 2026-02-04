// React hooks for GitHub-backed memos

import { useCallback, useEffect, useState } from "react";
import {
  githubMemoService,
  loadAuth,
  saveAuth,
  clearAuth as clearStoredAuth,
  type Memo,
  type GitHubUser
} from "./github";

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      if (loadAuth()) {
        try {
          const currentUser = await githubMemoService.getCurrentUser();
          setUser(currentUser);
          setIsAuthenticated(true);
          // Ensure required labels exist
          await githubMemoService.ensureLabelsExist();
        } catch (err) {
          clearStoredAuth();
          setError("Session expired. Please sign in again.");
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const signIn = useCallback(async (token: string, owner: string, repo: string) => {
    setLoading(true);
    setError(null);
    try {
      saveAuth(token, owner, repo);
      const currentUser = await githubMemoService.getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(true);
      await githubMemoService.ensureLabelsExist();
    } catch (err) {
      clearStoredAuth();
      setError(err instanceof Error ? err.message : "Failed to sign in");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    clearStoredAuth();
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return { isAuthenticated, user, loading, error, signIn, signOut };
}

export function useMemos() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMemos = useCallback(async (options?: { labels?: string }) => {
    if (!githubMemoService.isAuthenticated()) return;

    setLoading(true);
    setError(null);
    try {
      const data = await githubMemoService.listMemos(options);
      setMemos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch memos");
    } finally {
      setLoading(false);
    }
  }, []);

  const createMemo = useCallback(async (
    content: string,
    options?: { visibility?: "PUBLIC" | "PRIVATE"; pinned?: boolean }
  ) => {
    setError(null);
    try {
      const memo = await githubMemoService.createMemo(content, options);
      setMemos((prev) => [memo, ...prev]);
      return memo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create memo");
      throw err;
    }
  }, []);

  const updateMemo = useCallback(async (
    id: string,
    content: string,
    options?: { visibility?: "PUBLIC" | "PRIVATE"; pinned?: boolean }
  ) => {
    setError(null);
    try {
      const memo = await githubMemoService.updateMemo(id, content, options);
      setMemos((prev) => prev.map((m) => (m.id === id ? memo : m)));
      return memo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update memo");
      throw err;
    }
  }, []);

  const deleteMemo = useCallback(async (id: string) => {
    setError(null);
    try {
      await githubMemoService.deleteMemo(id);
      setMemos((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete memo");
      throw err;
    }
  }, []);

  const togglePin = useCallback(async (id: string, pinned: boolean) => {
    setError(null);
    try {
      const memo = await githubMemoService.togglePin(id, pinned);
      setMemos((prev) => prev.map((m) => (m.id === id ? memo : m)));
      return memo;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle pin");
      throw err;
    }
  }, []);

  const searchMemos = useCallback(async (query: string) => {
    if (!githubMemoService.isAuthenticated()) return;

    setLoading(true);
    setError(null);
    try {
      const data = await githubMemoService.searchMemos(query);
      setMemos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search memos");
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    memos,
    loading,
    error,
    fetchMemos,
    createMemo,
    updateMemo,
    deleteMemo,
    togglePin,
    searchMemos,
  };
}

export function useTags() {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTags = useCallback(async () => {
    if (!githubMemoService.isAuthenticated()) return;

    setLoading(true);
    try {
      const data = await githubMemoService.getAllTags();
      setTags(data);
    } catch {
      // Ignore errors for tags
    } finally {
      setLoading(false);
    }
  }, []);

  return { tags, loading, fetchTags };
}
