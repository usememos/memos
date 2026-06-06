# Remove react-use Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `react-use` from the frontend while preserving current hook behavior and eliminating the transitive `js-cookie@2.2.1` dependency.

**Architecture:** Replace simple one-off `react-use` helpers with native React hooks inside the consuming components. Add two focused local hooks in `web/src/hooks/` for reused debounce behavior and typed localStorage state. Regenerate the pnpm lockfile from `web/package.json` instead of manually editing lockfile entries.

**Tech Stack:** React 19, TypeScript 6, Vite 8, Vitest 4, Testing Library, pnpm 11.

---

## File Structure

- Create `web/src/hooks/useDebouncedEffect.ts`
  - Shared debounce hook for effect-style callbacks.
- Create `web/src/hooks/useLocalStorage.ts`
  - Typed localStorage state hook for persisted UI preferences.
- Modify `web/src/hooks/index.ts`
  - Export the two new hooks for existing `@/hooks` barrel import style.
- Create `web/tests/hooks.test.tsx`
  - Unit tests for the two new local hooks.
- Modify `web/src/components/MemoEditor/Toolbar/InsertMenu.tsx`
  - Replace `react-use` debounce import with local `useDebouncedEffect`.
- Modify `web/src/components/MemoEditor/hooks/useLinkMemo.ts`
  - Replace deep `react-use` debounce import with local `useDebouncedEffect`.
- Modify `web/src/components/MemoExplorer/TagsSection.tsx`
  - Replace deep `react-use` localStorage import with local `useLocalStorage`.
- Modify `web/src/components/TagTree.tsx`
  - Replace `useToggle` with native `useState`.
- Modify `web/src/components/MobileHeader.tsx`
  - Replace `useWindowScroll` with native `useState` and `useEffect`.
- Modify `web/src/layouts/RootLayout.tsx`
  - Replace `usePrevious` with native `useRef` and `useEffect`.
- Modify `web/package.json`
  - Remove the direct `react-use` dependency.
- Modify `web/pnpm-lock.yaml`
  - Regenerate through pnpm after `react-use` is removed.

---

### Task 1: Add Failing Hook Tests

**Files:**
- Create: `web/tests/hooks.test.tsx`

- [ ] **Step 1: Write tests for local hook behavior**

Create `web/tests/hooks.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedEffect, useLocalStorage } from "@/hooks";

describe("useLocalStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("uses the default value when storage is empty", () => {
    const { result } = renderHook(() => useLocalStorage("hook-test-empty", false));

    expect(result.current[0]).toBe(false);
  });

  it("reads and writes JSON values", () => {
    window.localStorage.setItem("hook-test-existing", JSON.stringify(true));

    const { result } = renderHook(() => useLocalStorage("hook-test-existing", false));

    expect(result.current[0]).toBe(true);

    act(() => {
      result.current[1](false);
    });

    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem("hook-test-existing")).toBe("false");
  });

  it("supports updater functions", () => {
    const { result } = renderHook(() => useLocalStorage("hook-test-updater", false));

    act(() => {
      result.current[1]((current) => !current);
    });

    expect(result.current[0]).toBe(true);
    expect(window.localStorage.getItem("hook-test-updater")).toBe("true");
  });

  it("falls back to the default value for malformed storage", () => {
    window.localStorage.setItem("hook-test-malformed", "{bad json");

    const { result } = renderHook(() => useLocalStorage("hook-test-malformed", true));

    expect(result.current[0]).toBe(true);
  });
});

describe("useDebouncedEffect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("runs the latest callback after the delay", () => {
    const calls: string[] = [];
    const { rerender } = renderHook(
      ({ value }) => {
        useDebouncedEffect(
          () => {
            calls.push(value);
          },
          100,
          [value],
        );
      },
      { initialProps: { value: "first" } },
    );

    act(() => {
      vi.advanceTimersByTime(99);
    });
    expect(calls).toEqual([]);

    rerender({ value: "second" });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(calls).toEqual(["second"]);
  });

  it("clears the pending timeout on unmount", () => {
    const calls: string[] = [];
    const { unmount } = renderHook(() => {
      useDebouncedEffect(
        () => {
          calls.push("called");
        },
        100,
        [],
      );
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(calls).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests and verify they fail because hooks do not exist**

Run:

```bash
cd web
pnpm test tests/hooks.test.tsx
```

Expected: FAIL with missing exports for `useDebouncedEffect` and `useLocalStorage` from `@/hooks`.

- [ ] **Step 3: Commit failing tests**

```bash
git add web/tests/hooks.test.tsx
git commit -m "test: cover local frontend hooks"
```

---

### Task 2: Implement Local Shared Hooks

**Files:**
- Create: `web/src/hooks/useDebouncedEffect.ts`
- Create: `web/src/hooks/useLocalStorage.ts`
- Modify: `web/src/hooks/index.ts`
- Test: `web/tests/hooks.test.tsx`

- [ ] **Step 1: Add `useDebouncedEffect`**

Create `web/src/hooks/useDebouncedEffect.ts`:

```ts
import { type DependencyList, useEffect } from "react";

export const useDebouncedEffect = (effect: () => void | Promise<void>, delay: number, deps: DependencyList): void => {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void effect();
    }, delay);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [delay, ...deps]);
};
```

- [ ] **Step 2: Add `useLocalStorage`**

Create `web/src/hooks/useLocalStorage.ts`:

```ts
import { useCallback, useEffect, useState } from "react";

type SetLocalStorageValue<T> = T | ((currentValue: T) => T);

const readLocalStorageValue = <T>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  try {
    const storedValue = window.localStorage.getItem(key);
    return storedValue === null ? defaultValue : (JSON.parse(storedValue) as T);
  } catch {
    return defaultValue;
  }
};

export const useLocalStorage = <T>(key: string, defaultValue: T): [T, (value: SetLocalStorageValue<T>) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => readLocalStorageValue(key, defaultValue));

  useEffect(() => {
    setStoredValue(readLocalStorageValue(key, defaultValue));
  }, [key, defaultValue]);

  const setValue = useCallback(
    (value: SetLocalStorageValue<T>) => {
      setStoredValue((currentValue) => {
        const nextValue = typeof value === "function" ? (value as (currentValue: T) => T)(currentValue) : value;

        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(key, JSON.stringify(nextValue));
          } catch {
            // Keep React state updated even if persistence is unavailable.
          }
        }

        return nextValue;
      });
    },
    [key],
  );

  return [storedValue, setValue];
};
```

- [ ] **Step 3: Export hooks from the barrel**

Modify `web/src/hooks/index.ts` to include:

```ts
export * from "./useAsyncEffect";
export * from "./useCurrentUser";
export * from "./useDateFilterNavigation";
export * from "./useDebouncedEffect";
export * from "./useFilteredMemoStats";
export * from "./useLoading";
export * from "./useLocalStorage";
export * from "./useMediaQuery";
export * from "./useMemoFilters";
export * from "./useMemoSorting";
export * from "./useNavigateTo";
export * from "./useUserLocale";
export * from "./useUserTheme";
```

- [ ] **Step 4: Run hook tests and verify they pass**

Run:

```bash
cd web
pnpm test tests/hooks.test.tsx
```

Expected: PASS for all `useLocalStorage` and `useDebouncedEffect` tests.

- [ ] **Step 5: Commit shared hooks**

```bash
git add web/src/hooks/useDebouncedEffect.ts web/src/hooks/useLocalStorage.ts web/src/hooks/index.ts web/tests/hooks.test.tsx
git commit -m "feat: add local frontend hooks"
```

---

### Task 3: Replace Simple react-use Helpers With React Hooks

**Files:**
- Modify: `web/src/components/TagTree.tsx`
- Modify: `web/src/components/MobileHeader.tsx`
- Modify: `web/src/layouts/RootLayout.tsx`

- [ ] **Step 1: Replace `useToggle` in `TagTree`**

In `web/src/components/TagTree.tsx`, change the imports:

```ts
import { ChevronRightIcon, HashIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { type MemoFilter, useMemoFilterContext } from "@/contexts/MemoFilterContext";
```

Replace the toggle state in `TagItemContainer` with:

```ts
  const [showSubTags, setShowSubTags] = useState(false);

  useEffect(() => {
    setShowSubTags(expandSubTags);
  }, [expandSubTags]);
```

Replace `handleToggleBtnClick` with:

```ts
  const handleToggleBtnClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setShowSubTags((current) => !current);
  }, []);
```

- [ ] **Step 2: Replace `useWindowScroll` in `MobileHeader`**

In `web/src/components/MobileHeader.tsx`, replace the first import with React hooks:

```ts
import { useEffect, useState } from "react";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import NavigationDrawer from "./NavigationDrawer";
```

Inside `MobileHeader`, replace `const { y: offsetTop } = useWindowScroll();` with:

```ts
  const [offsetTop, setOffsetTop] = useState(() => {
    if (typeof window === "undefined") return 0;
    return window.scrollY;
  });

  useEffect(() => {
    const handleScroll = () => {
      setOffsetTop(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);
```

- [ ] **Step 3: Replace `usePrevious` in `RootLayout`**

In `web/src/layouts/RootLayout.tsx`, change the React import and remove the `react-use` import:

```ts
import { useEffect, useRef } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router-dom";
```

Replace:

```ts
  const prevPathname = usePrevious(pathname);
```

with:

```ts
  const prevPathnameRef = useRef<string | undefined>(undefined);
```

Replace the route filter clearing effect with:

```ts
  useEffect(() => {
    const prevPathname = prevPathnameRef.current;

    // When the route changes and there is no filter in the search params, remove all filters.
    if (prevPathname !== undefined && prevPathname !== pathname && !searchParams.has("filter")) {
      removeFilter(() => true);
    }

    prevPathnameRef.current = pathname;
  }, [pathname, searchParams, removeFilter]);
```

- [ ] **Step 4: Run TypeScript/lint check**

Run:

```bash
cd web
pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Commit simple helper replacements**

```bash
git add web/src/components/TagTree.tsx web/src/components/MobileHeader.tsx web/src/layouts/RootLayout.tsx
git commit -m "refactor: replace simple react-use helpers"
```

---

### Task 4: Replace Debounce And LocalStorage Call Sites

**Files:**
- Modify: `web/src/components/MemoEditor/Toolbar/InsertMenu.tsx`
- Modify: `web/src/components/MemoEditor/hooks/useLinkMemo.ts`
- Modify: `web/src/components/MemoExplorer/TagsSection.tsx`
- Test: `web/tests/hooks.test.tsx`

- [ ] **Step 1: Update `InsertMenu` debounce import and call**

In `web/src/components/MemoEditor/Toolbar/InsertMenu.tsx`, remove:

```ts
import { useDebounce } from "react-use";
```

Add:

```ts
import { useDebouncedEffect } from "@/hooks";
```

Replace:

```ts
  useDebounce(
    () => {
      setDebouncedPosition(locationState.position);
    },
    1000,
    [locationState.position],
  );
```

with:

```ts
  useDebouncedEffect(
    () => {
      setDebouncedPosition(locationState.position);
    },
    1000,
    [locationState.position],
  );
```

- [ ] **Step 2: Update `useLinkMemo` debounce import and call**

In `web/src/components/MemoEditor/hooks/useLinkMemo.ts`, remove:

```ts
import useDebounce from "react-use/lib/useDebounce";
```

Add:

```ts
import { useDebouncedEffect } from "@/hooks";
```

Replace:

```ts
  useDebounce(
```

with:

```ts
  useDebouncedEffect(
```

Keep the existing async callback body, `300` delay, and `[isOpen, searchText]` dependency list unchanged.

- [ ] **Step 3: Update `TagsSection` localStorage import**

In `web/src/components/MemoExplorer/TagsSection.tsx`, replace:

```ts
import useLocalStorage from "react-use/lib/useLocalStorage";
```

with:

```ts
import { useLocalStorage } from "@/hooks";
```

Keep both call sites unchanged:

```ts
  const [treeMode, setTreeMode] = useLocalStorage<boolean>("tag-view-as-tree", false);
  const [treeAutoExpand, setTreeAutoExpand] = useLocalStorage<boolean>("tag-tree-auto-expand", false);
```

- [ ] **Step 4: Verify no source imports from `react-use` remain**

Run:

```bash
rg -n 'react-use' web/src web/package.json
```

Expected: only `web/package.json` still reports `react-use` before the dependency removal task.

- [ ] **Step 5: Run targeted hook tests and lint**

Run:

```bash
cd web
pnpm test tests/hooks.test.tsx
pnpm lint
```

Expected: both commands PASS.

- [ ] **Step 6: Commit call-site replacements**

```bash
git add web/src/components/MemoEditor/Toolbar/InsertMenu.tsx web/src/components/MemoEditor/hooks/useLinkMemo.ts web/src/components/MemoExplorer/TagsSection.tsx web/tests/hooks.test.tsx
git commit -m "refactor: use local debounce and storage hooks"
```

---

### Task 5: Remove react-use Dependency And Regenerate Lockfile

**Files:**
- Modify: `web/package.json`
- Modify: `web/pnpm-lock.yaml`

- [ ] **Step 1: Remove `react-use` from `web/package.json`**

In `web/package.json`, remove this dependency line:

```json
    "react-use": "^17.6.0",
```

Do not add `js-cookie` as a direct dependency.

- [ ] **Step 2: Regenerate the lockfile**

Run:

```bash
cd web
pnpm install --lockfile-only
```

Expected: command succeeds and updates `web/pnpm-lock.yaml`.

- [ ] **Step 3: Verify dependency graph removal**

Run:

```bash
cd web
pnpm why react-use js-cookie
```

Expected: output does not list installed versions for `react-use` or `js-cookie`.

- [ ] **Step 4: Verify repository text references**

Run:

```bash
rg -n '"react-use"|react-use/lib|react-use@17\.6\.0|^\s+react-use:|js-cookie' web/package.json web/pnpm-lock.yaml web/src
```

Expected: no matches.

- [ ] **Step 5: Commit dependency removal**

```bash
git add web/package.json web/pnpm-lock.yaml
git commit -m "chore: remove react-use dependency"
```

---

### Task 6: Final Verification

**Files:**
- Verify: all files changed by Tasks 1-5

- [ ] **Step 1: Run frontend tests for the new hook coverage**

Run:

```bash
cd web
pnpm test tests/hooks.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run frontend lint**

Run:

```bash
cd web
pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd web
pnpm build
```

Expected: PASS.

- [ ] **Step 4: Confirm no removed dependency remains**

Run:

```bash
cd web
pnpm why react-use js-cookie
rg -n '"react-use"|react-use/lib|react-use@17\.6\.0|^\s+react-use:|js-cookie' src package.json pnpm-lock.yaml
```

Expected: no `react-use` or `js-cookie` dependency remains. The `rg` command returns no matches.

- [ ] **Step 5: Inspect final diff**

Run:

```bash
git diff --stat HEAD~5..HEAD
git status --short
```

Expected: diff contains only hook tests, local hooks, six call-site rewrites, and dependency files. Working tree is clean after all task commits.
