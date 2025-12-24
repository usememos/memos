# React Query + Context Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate from MobX to React Query (for server state) + Context (for client state) to follow 2025 React standards and improve contributor familiarity.

**Architecture:** Separate server state (memos, users, attachments fetched from API) managed by TanStack Query, from client state (UI preferences, filters) managed by React Context. This follows the modern React pattern where each concern uses the right tool: React Query handles caching, deduplication, and refetching automatically; Context handles simple client-side state.

**Tech Stack:** React Query v5 (TanStack Query), React Context API, existing gRPC-Web clients

---

## Phase 1: Setup and Infrastructure

### Task 1: Install React Query Dependencies

**Files:**
- Modify: `web/package.json`

**Step 1: Install @tanstack/react-query**

```bash
cd web && pnpm add @tanstack/react-query@^5.0.0
```

Expected: Package added to dependencies

**Step 2: Install devtools (optional but recommended)**

```bash
cd web && pnpm add @tanstack/react-query-devtools@^5.0.0
```

Expected: Devtools package added

**Step 3: Verify installation**

Run: `cd web && pnpm list @tanstack/react-query`
Expected: Shows version 5.x.x installed

**Step 4: Commit**

```bash
git add web/package.json web/pnpm-lock.yaml
git commit -m "feat: add React Query dependencies"
```

---

### Task 2: Create Query Client Configuration

**Files:**
- Create: `web/src/lib/query-client.ts`

**Step 1: Create query client config file**

```typescript
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Memos app is real-time focused, so we want fresh data
      staleTime: 1000 * 10, // 10 seconds
      gcTime: 1000 * 60 * 5, // 5 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

**Step 2: Verify TypeScript compilation**

Run: `cd web && pnpm lint`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add web/src/lib/query-client.ts
git commit -m "feat: create React Query client configuration"
```

---

### Task 3: Add QueryClientProvider to App

**Files:**
- Modify: `web/src/main.tsx`

**Step 1: Import QueryClientProvider**

In `web/src/main.tsx`, add imports at the top:

```typescript
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "@/lib/query-client";
```

**Step 2: Wrap Main component with QueryClientProvider**

Replace the current Main component observer wrapper (lines 22-30) with:

```typescript
const Main = observer(() => (
  <QueryClientProvider client={queryClient}>
    <I18nextProvider i18n={i18n}>
      <Router>
        <App />
      </Router>
    </I18nextProvider>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
));
```

**Step 3: Test that app still runs**

Run: `cd web && pnpm dev`
Expected: App starts without errors, React Query devtools button visible in bottom-left

**Step 4: Commit**

```bash
git add web/src/main.tsx
git commit -m "feat: integrate React Query provider"
```

---

## Phase 2: Migrate View Store (Simplest Client State)

### Task 4: Create View Context

**Files:**
- Create: `web/src/contexts/ViewContext.tsx`

**Step 1: Create view context with TypeScript types**

```typescript
import { createContext, useContext, useState, type ReactNode } from "react";

export type LayoutMode = "LIST" | "MASONRY";

interface ViewContextValue {
  orderByTimeAsc: boolean;
  layout: LayoutMode;
  toggleSortOrder: () => void;
  setLayout: (layout: LayoutMode) => void;
}

const ViewContext = createContext<ViewContextValue | null>(null);

const LOCAL_STORAGE_KEY = "memos-view-setting";

export function ViewProvider({ children }: { children: ReactNode }) {
  // Load initial state from localStorage
  const getInitialState = () => {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        return {
          orderByTimeAsc: Boolean(data.orderByTimeAsc ?? false),
          layout: (["LIST", "MASONRY"].includes(data.layout) ? data.layout : "LIST") as LayoutMode,
        };
      }
    } catch (error) {
      console.warn("Failed to load view settings from localStorage:", error);
    }
    return { orderByTimeAsc: false, layout: "LIST" as LayoutMode };
  };

  const [viewState, setViewState] = useState(getInitialState);

  const persistToStorage = (newState: typeof viewState) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newState));
    } catch (error) {
      console.warn("Failed to persist view settings:", error);
    }
  };

  const toggleSortOrder = () => {
    setViewState((prev) => {
      const newState = { ...prev, orderByTimeAsc: !prev.orderByTimeAsc };
      persistToStorage(newState);
      return newState;
    });
  };

  const setLayout = (layout: LayoutMode) => {
    setViewState((prev) => {
      const newState = { ...prev, layout };
      persistToStorage(newState);
      return newState;
    });
  };

  return (
    <ViewContext.Provider
      value={{
        ...viewState,
        toggleSortOrder,
        setLayout,
      }}
    >
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  const context = useContext(ViewContext);
  if (!context) {
    throw new Error("useView must be used within ViewProvider");
  }
  return context;
}
```

**Step 2: Verify TypeScript compilation**

Run: `cd web && pnpm lint`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add web/src/contexts/ViewContext.tsx
git commit -m "feat: create View context to replace viewStore"
```

---

### Task 5: Add ViewProvider to App

**Files:**
- Modify: `web/src/main.tsx`

**Step 1: Import ViewProvider**

Add to imports:

```typescript
import { ViewProvider } from "@/contexts/ViewContext";
```

**Step 2: Wrap app with ViewProvider**

Update the Main component to add ViewProvider:

```typescript
const Main = observer(() => (
  <QueryClientProvider client={queryClient}>
    <ViewProvider>
      <I18nextProvider i18n={i18n}>
        <Router>
          <App />
        </Router>
      </I18nextProvider>
    </ViewProvider>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
));
```

**Step 3: Test app still runs**

Run: `cd web && pnpm dev`
Expected: No errors, app loads

**Step 4: Commit**

```bash
git add web/src/main.tsx
git commit -m "feat: integrate ViewProvider"
```

---

### Task 6: Create MemoFilter Context

**Files:**
- Create: `web/src/contexts/MemoFilterContext.tsx`

**Step 1: Copy filter types and create context**

```typescript
import { createContext, useContext, useState, type ReactNode } from "react";

export interface FilterFactor {
  tag?: string;
  hasLink?: boolean;
  hasTaskList?: boolean;
  hasCode?: boolean;
  hasMention?: boolean;
  hasSentiment?: boolean;
  text?: string;
  visibility?: string;
  from?: number;
  to?: number;
  property?: {
    key: string;
    value: string;
  };
}

export interface MemoFilter {
  user?: string;
  rowStatus?: string;
  creatorId?: string;
  displayWithPinned?: boolean;
  displayWithUpdatedTs?: boolean;
  contentSearch?: string[];
  limit?: number;
  visibilities?: string[];
  orderByPinned?: boolean;
  orderByTimeAsc?: boolean;
  displayWithNoTag?: boolean;
  tag?: string;
  text?: string;
  hasLink?: boolean;
  hasTaskList?: boolean;
  hasCode?: boolean;
  hasMention?: boolean;
  hasSentiment?: boolean;
  visibility?: string;
  from?: number;
  to?: number;
  property?: {
    key: string;
    value: string;
  };
}

interface MemoFilterContextValue {
  filter: MemoFilter;
  setFilter: (filter: MemoFilter) => void;
  updateFilter: (partial: Partial<MemoFilter>) => void;
  clearFilter: () => void;
}

const MemoFilterContext = createContext<MemoFilterContextValue | null>(null);

export function MemoFilterProvider({ children }: { children: ReactNode }) {
  const [filter, setFilter] = useState<MemoFilter>({});

  const updateFilter = (partial: Partial<MemoFilter>) => {
    setFilter((prev) => ({ ...prev, ...partial }));
  };

  const clearFilter = () => {
    setFilter({});
  };

  return (
    <MemoFilterContext.Provider
      value={{
        filter,
        setFilter,
        updateFilter,
        clearFilter,
      }}
    >
      {children}
    </MemoFilterContext.Provider>
  );
}

export function useMemoFilter() {
  const context = useContext(MemoFilterContext);
  if (!context) {
    throw new Error("useMemoFilter must be used within MemoFilterProvider");
  }
  return context;
}
```

**Step 2: Verify TypeScript compilation**

Run: `cd web && pnpm lint`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add web/src/contexts/MemoFilterContext.tsx
git commit -m "feat: create MemoFilter context to replace memoFilterStore"
```

---

### Task 7: Add MemoFilterProvider to App

**Files:**
- Modify: `web/src/main.tsx`

**Step 1: Import MemoFilterProvider**

Add to imports:

```typescript
import { MemoFilterProvider } from "@/contexts/MemoFilterContext";
```

**Step 2: Wrap app with MemoFilterProvider**

Update Main component:

```typescript
const Main = observer(() => (
  <QueryClientProvider client={queryClient}>
    <ViewProvider>
      <MemoFilterProvider>
        <I18nextProvider i18n={i18n}>
          <Router>
            <App />
          </Router>
        </I18nextProvider>
      </MemoFilterProvider>
    </ViewProvider>
    <ReactQueryDevtools initialIsOpen={false} />
  </QueryClientProvider>
));
```

**Step 3: Test app still runs**

Run: `cd web && pnpm dev`
Expected: No errors

**Step 4: Commit**

```bash
git add web/src/main.tsx
git commit -m "feat: integrate MemoFilterProvider"
```

---

## Phase 3: Migrate Memo Store (Server State)

### Task 8: Create Memo Query Hooks

**Files:**
- Create: `web/src/hooks/useMemoQueries.ts`

**Step 1: Create query hooks for memo operations**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema } from "@bufbuild/protobuf/wkt";
import { memoServiceClient } from "@/connect";
import type { CreateMemoRequest, ListMemosRequest, Memo } from "@/types/proto/api/v1/memo_service_pb";
import { ListMemosRequestSchema, MemoSchema } from "@/types/proto/api/v1/memo_service_pb";

// Query keys factory for consistent cache management
export const memoKeys = {
  all: ["memos"] as const,
  lists: () => [...memoKeys.all, "list"] as const,
  list: (filters: Partial<ListMemosRequest>) => [...memoKeys.lists(), filters] as const,
  details: () => [...memoKeys.all, "detail"] as const,
  detail: (name: string) => [...memoKeys.details(), name] as const,
};

// Hook to fetch list of memos
export function useMemos(request: Partial<ListMemosRequest> = {}) {
  return useQuery({
    queryKey: memoKeys.list(request),
    queryFn: async () => {
      const response = await memoServiceClient.listMemos(
        create(ListMemosRequestSchema, request as Record<string, unknown>)
      );
      return response;
    },
  });
}

// Hook to fetch single memo by name
export function useMemo(name: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: memoKeys.detail(name),
    queryFn: async () => {
      const memo = await memoServiceClient.getMemo({ name });
      return memo;
    },
    enabled: options?.enabled ?? true,
  });
}

// Hook to create memo
export function useCreateMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memoToCreate: Memo) => {
      const memo = await memoServiceClient.createMemo({ memo: memoToCreate });
      return memo;
    },
    onSuccess: (newMemo) => {
      // Invalidate memo lists to refetch
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      // Add new memo to cache
      queryClient.setQueryData(memoKeys.detail(newMemo.name), newMemo);
      // Invalidate user stats
      queryClient.invalidateQueries({ queryKey: ["users", "stats"] });
    },
  });
}

// Hook to update memo with optimistic updates
export function useUpdateMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ update, updateMask }: { update: Partial<Memo>; updateMask: string[] }) => {
      const memo = await memoServiceClient.updateMemo({
        memo: create(MemoSchema, update as Record<string, unknown>),
        updateMask: create(FieldMaskSchema, { paths: updateMask }),
      });
      return memo;
    },
    onMutate: async ({ update }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: memoKeys.detail(update.name!) });

      // Snapshot previous value
      const previousMemo = queryClient.getQueryData<Memo>(memoKeys.detail(update.name!));

      // Optimistically update
      if (previousMemo) {
        queryClient.setQueryData(memoKeys.detail(update.name!), { ...previousMemo, ...update });
      }

      return { previousMemo };
    },
    onError: (err, { update }, context) => {
      // Rollback on error
      if (context?.previousMemo) {
        queryClient.setQueryData(memoKeys.detail(update.name!), context.previousMemo);
      }
    },
    onSuccess: (updatedMemo) => {
      // Update cache with server response
      queryClient.setQueryData(memoKeys.detail(updatedMemo.name), updatedMemo);
      // Invalidate lists to refresh
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      // Invalidate user stats
      queryClient.invalidateQueries({ queryKey: ["users", "stats"] });
    },
  });
}

// Hook to delete memo
export function useDeleteMemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await memoServiceClient.deleteMemo({ name });
      return name;
    },
    onSuccess: (name) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: memoKeys.detail(name) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: memoKeys.lists() });
      // Invalidate user stats
      queryClient.invalidateQueries({ queryKey: ["users", "stats"] });
    },
  });
}
```

**Step 2: Verify TypeScript compilation**

Run: `cd web && pnpm lint`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add web/src/hooks/useMemoQueries.ts
git commit -m "feat: create React Query hooks for memo operations"
```

---

### Task 9: Create User Query Hooks

**Files:**
- Create: `web/src/hooks/useUserQueries.ts`

**Step 1: Create query hooks for user operations**

```typescript
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authServiceClient, shortcutServiceClient, userServiceClient } from "@/connect";
import type { User, UserStats } from "@/types/proto/api/v1/user_service_pb";

// Query keys factory
export const userKeys = {
  all: ["users"] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (name: string) => [...userKeys.details(), name] as const,
  stats: () => [...userKeys.all, "stats"] as const,
  userStats: (name: string) => [...userKeys.stats(), name] as const,
  currentUser: () => [...userKeys.all, "current"] as const,
  shortcuts: () => [...userKeys.all, "shortcuts"] as const,
  notifications: () => [...userKeys.all, "notifications"] as const,
};

// Hook to get current authenticated user
export function useCurrentUser() {
  return useQuery({
    queryKey: userKeys.currentUser(),
    queryFn: async () => {
      const { user } = await authServiceClient.getAuthStatus({});
      return user;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - auth doesn't change often
  });
}

// Hook to fetch user by name
export function useUser(name: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.detail(name),
    queryFn: async () => {
      const user = await userServiceClient.getUser({ name });
      return user;
    },
    enabled: options?.enabled ?? true,
  });
}

// Hook to fetch user stats
export function useUserStats(username?: string) {
  return useQuery({
    queryKey: username ? userKeys.userStats(username) : userKeys.stats(),
    queryFn: async () => {
      const name = username ? `${username}/stats` : undefined;
      const stats = await userServiceClient.getUserStats({ name });
      return stats;
    },
    enabled: !!username,
  });
}

// Hook to fetch shortcuts
export function useShortcuts() {
  return useQuery({
    queryKey: userKeys.shortcuts(),
    queryFn: async () => {
      const { shortcuts } = await shortcutServiceClient.listShortcuts({});
      return shortcuts;
    },
  });
}

// Hook to fetch notifications
export function useNotifications() {
  return useQuery({
    queryKey: userKeys.notifications(),
    queryFn: async () => {
      const { notifications } = await userServiceClient.listNotifications({});
      return notifications;
    },
  });
}

// Hook to get aggregated tag counts across all users
export function useTagCounts() {
  return useQuery({
    queryKey: [...userKeys.stats(), "tagCounts"],
    queryFn: async () => {
      // Fetch all user stats
      const stats = await userServiceClient.getUserStats({});

      // Aggregate tag counts
      const tagCount: Record<string, number> = {};
      if (stats.tagCount) {
        for (const [tag, count] of Object.entries(stats.tagCount)) {
          tagCount[tag] = (tagCount[tag] || 0) + count;
        }
      }
      return tagCount;
    },
  });
}
```

**Step 2: Verify TypeScript compilation**

Run: `cd web && pnpm lint`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add web/src/hooks/useUserQueries.ts
git commit -m "feat: create React Query hooks for user operations"
```

---

### Task 10: Create Attachment Query Hooks

**Files:**
- Create: `web/src/hooks/useAttachmentQueries.ts`

**Step 1: Create query hooks for attachment operations**

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { resourceServiceClient } from "@/connect";

// Query keys factory
export const attachmentKeys = {
  all: ["attachments"] as const,
  lists: () => [...attachmentKeys.all, "list"] as const,
  list: (filters?: any) => [...attachmentKeys.lists(), filters] as const,
  details: () => [...attachmentKeys.all, "detail"] as const,
  detail: (name: string) => [...attachmentKeys.details(), name] as const,
};

// Hook to fetch attachments
export function useAttachments() {
  return useQuery({
    queryKey: attachmentKeys.lists(),
    queryFn: async () => {
      const { resources } = await resourceServiceClient.listResources({});
      return resources;
    },
  });
}

// Hook to create/upload attachment
export function useCreateAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      // Note: This might need adjustment based on your actual upload API
      const response = await fetch("/api/v1/resources", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate attachments list
      queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() });
    },
  });
}

// Hook to delete attachment
export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await resourceServiceClient.deleteResource({ name });
      return name;
    },
    onSuccess: (name) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: attachmentKeys.detail(name) });
      // Invalidate lists
      queryClient.invalidateQueries({ queryKey: attachmentKeys.lists() });
    },
  });
}
```

**Step 2: Verify TypeScript compilation**

Run: `cd web && pnpm lint`
Expected: No TypeScript errors

**Step 3: Commit**

```bash
git add web/src/hooks/useAttachmentQueries.ts
git commit -m "feat: create React Query hooks for attachment operations"
```

---

## Phase 4: Update Components to Use New Hooks

### Task 11: Update MemoDetail Page

**Files:**
- Modify: `web/src/pages/MemoDetail.tsx`

**Step 1: Replace memoStore with useMemo hook**

Find the current imports and replace:

```typescript
// Remove this import
// import { memoStore } from "@/store";

// Add these imports
import { useMemo } from "@/hooks/useMemoQueries";
```

**Step 2: Replace store usage in component**

Replace the memo fetching logic (lines ~30-78) with:

```typescript
const MemoDetail = () => {
  const { memoName } = useParams();

  // Fetch memo with React Query
  const { data: memo, isLoading, error } = useMemo(memoName!, {
    enabled: !!memoName,
  });

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error || !memo) {
    return <Navigate to="/404" />;
  }

  // Rest of component logic...
```

**Step 3: Test that MemoDetail page still works**

Run: `cd web && pnpm dev`
Navigate to a memo detail page
Expected: Memo loads and displays correctly

**Step 4: Commit**

```bash
git add web/src/pages/MemoDetail.tsx
git commit -m "refactor: migrate MemoDetail to use React Query"
```

---

### Task 12: Create Component Migration Helper Script

**Files:**
- Create: `web/scripts/migration-guide.md`

**Step 1: Document migration patterns for team**

```markdown
# MobX to React Query Migration Guide

## Common Patterns

### Pattern 1: Reading from store

**Before (MobX):**
```typescript
import { memoStore } from "@/store";
import { observer } from "mobx-react-lite";

const Component = observer(() => {
  const memo = memoStore.getMemoByName(name);
  // ...
});
```

**After (React Query):**
```typescript
import { useMemo } from "@/hooks/useMemoQueries";

const Component = () => {
  const { data: memo, isLoading } = useMemo(name);
  // ...
};
```

### Pattern 2: Creating/Updating

**Before (MobX):**
```typescript
const handleCreate = async () => {
  await memoStore.createMemo(newMemo);
};
```

**After (React Query):**
```typescript
const { mutate: createMemo } = useCreateMemo();

const handleCreate = () => {
  createMemo(newMemo);
};
```

### Pattern 3: View preferences

**Before (MobX):**
```typescript
import { viewStore } from "@/store";
viewStore.state.layout
viewStore.setLayout("MASONRY")
```

**After (Context):**
```typescript
import { useView } from "@/contexts/ViewContext";
const { layout, setLayout } = useView();
setLayout("MASONRY")
```

## Components to Update

- [ ] web/src/pages/MemoDetail.tsx (done)
- [ ] web/src/pages/Home.tsx
- [ ] web/src/pages/Explore.tsx
- [ ] web/src/pages/Archived.tsx
- [ ] web/src/pages/UserProfile.tsx
- [ ] web/src/pages/Inboxes.tsx
- [ ] web/src/components/MemoExplorer/MemoExplorer.tsx
- [ ] web/src/components/MemoActionMenu/MemoActionMenu.tsx
- [ ] web/src/layouts/MainLayout.tsx
- [ ] All other components using memoStore, userStore, viewStore

## Testing Each Component

1. Start dev server: `cd web && pnpm dev`
2. Navigate to component
3. Test CRUD operations work
4. Check browser console for errors
5. Verify React Query devtools shows correct queries
```

**Step 2: Commit**

```bash
git add web/scripts/migration-guide.md
git commit -m "docs: add migration guide for React Query transition"
```

---

## Phase 5: Systematic Component Migration

### Task 13: Update All Remaining Components

**Files:**
- Modify: All components in `web/src/pages/`, `web/src/components/`, `web/src/layouts/`

**Step 1: Identify all files using old stores**

Run:
```bash
cd web && grep -r "from \"@/store\"" src/ | cut -d: -f1 | sort -u
```

Expected: List of files to update

**Step 2: For each file, apply migration patterns**

Follow the patterns in `web/scripts/migration-guide.md`:
- Replace `memoStore` imports with `useMemo`, `useCreateMemo`, etc.
- Replace `userStore` imports with `useCurrentUser`, `useUser`, etc.
- Replace `viewStore` imports with `useView` hook
- Replace `memoFilterStore` imports with `useMemoFilter` hook
- Remove `observer()` HOC where no longer needed

**Step 3: Test each updated component**

After updating each file:
```bash
cd web && pnpm lint
cd web && pnpm dev
# Navigate to component and test functionality
```

**Step 4: Commit after each component or logical group**

```bash
git add web/src/pages/[ComponentName].tsx
git commit -m "refactor: migrate [ComponentName] to React Query"
```

**Note:** This task is intentionally broad. Break it into smaller commits per component or feature area.

---

## Phase 6: Cleanup

### Task 14: Remove MobX Dependencies

**Files:**
- Modify: `web/package.json`
- Delete: `web/src/store/` directory

**Step 1: Verify no files import from @/store**

Run:
```bash
cd web && grep -r "from \"@/store\"" src/
```

Expected: No results (or only commented code)

**Step 2: Verify no files use observer**

Run:
```bash
cd web && grep -r "mobx-react-lite" src/
```

Expected: No results

**Step 3: Delete store directory**

```bash
rm -rf web/src/store
```

**Step 4: Remove MobX packages**

```bash
cd web && pnpm remove mobx mobx-react-lite
```

**Step 5: Verify app still builds and runs**

```bash
cd web && pnpm lint
cd web && pnpm build
cd web && pnpm dev
```

Expected: No errors, all features work

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove MobX dependencies and old store code"
```

---

## Phase 7: Testing and Documentation

### Task 15: Update Project Documentation

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update state management section**

Replace the MobX reference in CLAUDE.md with:

```markdown
**Why React Query + Context?**
- React Query for server state (memos, users, attachments) handles caching, deduplication, and refetching
- React Context for client state (view preferences, filters) keeps UI state simple
- Both are industry-standard 2025 patterns that contributors will recognize
- Hooks in `web/src/hooks/` provide type-safe API access
- Contexts in `web/src/contexts/` provide client state
```

**Step 2: Update development workflow**

Add section about React Query devtools:

```markdown
**Frontend Development:**
- React Query devtools available at bottom-left of screen in dev mode
- Use devtools to inspect query cache, mutations, and refetch behavior
- Query keys are organized by resource (memoKeys, userKeys, attachmentKeys)
```

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update state management documentation"
```

---

### Task 16: Final Integration Testing

**Files:**
- None (testing only)

**Step 1: Full application smoke test**

Test these workflows:
- [ ] Sign in
- [ ] View memo list
- [ ] Create new memo
- [ ] Edit memo
- [ ] Delete memo
- [ ] View user profile
- [ ] Change view settings (layout, sort order)
- [ ] Apply filters
- [ ] Upload attachment
- [ ] View notifications

**Step 2: Check performance**

Open React Query devtools and verify:
- [ ] Queries are deduplicated (no duplicate fetches)
- [ ] Cache is working (navigating back doesn't refetch)
- [ ] Mutations invalidate correctly (creating memo refetches list)
- [ ] Optimistic updates work (edit memo updates immediately)

**Step 3: Check for console errors**

Run: `cd web && pnpm dev`
Open browser console
Expected: No errors or warnings

**Step 4: Build production bundle**

Run: `cd web && pnpm release`
Expected: Build succeeds, no errors

**Step 5: Document any issues found**

Create GitHub issues for any bugs discovered during testing

---

## Completion Checklist

- [ ] React Query installed and configured
- [ ] Query client with appropriate defaults created
- [ ] ViewContext and MemoFilterContext created
- [ ] All server state (memos, users, attachments) migrated to React Query
- [ ] All client state (view, filter) migrated to Context
- [ ] All components updated to use new hooks
- [ ] MobX dependencies removed
- [ ] Documentation updated
- [ ] Full application tested
- [ ] Production build successful

---

## Rollback Plan

If issues arise during migration:

1. **Rollback via Git:**
   ```bash
   git log --oneline
   git revert <commit-hash>
   ```

2. **Partial rollback:** Keep both systems running temporarily
   - Don't delete MobX stores until ALL components migrated
   - Can have some components use React Query, others use MobX
   - Add `// TODO: migrate to React Query` comments

3. **Emergency rollback:**
   ```bash
   git reset --hard <last-good-commit>
   ```

---

## Notes for Implementer

- **Take your time:** Migrate one component at a time, test thoroughly
- **Use devtools:** React Query devtools will help debug caching issues
- **Follow TDD where possible:** Write tests for custom hooks before using in components
- **Ask questions:** If uncertain about a pattern, check React Query docs or ask
- **Commit frequently:** Small commits make rollback easier if needed
