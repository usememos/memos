# Store Architecture

This directory contains the application's state management implementation using MobX.

## Overview

The store architecture follows a clear separation of concerns:

- **Server State Stores**: Manage data fetched from the backend API
- **Client State Stores**: Manage UI preferences and transient state

## Store Files

### Server State Stores (API Data)

| Store | File | Purpose |
|-------|------|---------|
| `memoStore` | `memo.ts` | Memo CRUD operations, optimistic updates |
| `userStore` | `user.ts` | User authentication, settings, stats |
| `workspaceStore` | `workspace.ts` | Workspace profile and settings |
| `attachmentStore` | `attachment.ts` | File attachment management |

**Features:**
- ✅ Request deduplication (prevents duplicate API calls)
- ✅ Structured error handling with `StoreError`
- ✅ Computed property memoization for performance
- ✅ Optimistic updates (immediate UI feedback)
- ✅ Automatic caching

### Client State Stores (UI State)

| Store | File | Purpose | Persistence |
|-------|------|---------|-------------|
| `viewStore` | `view.ts` | Display preferences (sort, layout) | localStorage |
| `memoFilterStore` | `memoFilter.ts` | Active search filters | URL params |

**Features:**
- ✅ No API calls (instant updates)
- ✅ localStorage persistence (viewStore)
- ✅ URL synchronization (memoFilterStore - shareable links)

### Utilities

| File | Purpose |
|------|---------|
| `base-store.ts` | Base classes and factory functions |
| `store-utils.ts` | Request deduplication, error handling, optimistic updates |
| `config.ts` | MobX configuration |
| `common.ts` | Shared constants and utilities |
| `index.ts` | Centralized exports |

## Usage Examples

### Basic Store Usage

```typescript
import { memoStore, userStore, viewStore } from "@/store";
import { observer } from "mobx-react-lite";

const MyComponent = observer(() => {
  // Access state
  const memos = memoStore.state.memos;
  const currentUser = userStore.state.currentUser;
  const sortOrder = viewStore.state.orderByTimeAsc;

  // Call actions
  const handleCreate = async () => {
    await memoStore.createMemo({ content: "Hello" });
  };

  const toggleSort = () => {
    viewStore.toggleSortOrder();
  };

  return <div>...</div>;
});
```

### Server Store Pattern

```typescript
// Fetch data with automatic deduplication
const memo = await memoStore.getOrFetchMemoByName("memos/123");

// Update with optimistic UI updates
await memoStore.updateMemo({ name: "memos/123", content: "Updated" }, ["content"]);

// Errors are wrapped in StoreError
try {
  await memoStore.deleteMemo("memos/123");
} catch (error) {
  if (error instanceof StoreError) {
    console.error(error.code, error.message);
  }
}
```

### Client Store Pattern

```typescript
// View preferences (persisted to localStorage)
viewStore.setLayout("MASONRY");
viewStore.toggleSortOrder();

// Filters (synced to URL)
memoFilterStore.addFilter({ factor: "tagSearch", value: "work" });
memoFilterStore.removeFiltersByFactor("tagSearch");
memoFilterStore.clearAllFilters();
```

## Creating New Stores

### Server State Store

```typescript
import { StandardState, createServerStore } from "./base-store";
import { createRequestKey, StoreError } from "./store-utils";

class MyState extends StandardState {
  dataMap: Record<string, Data> = {};

  get items() {
    return Object.values(this.dataMap);
  }
}

const myStore = (() => {
  const base = createServerStore(new MyState(), {
    name: "myStore",
    enableDeduplication: true,
  });

  const { state, executeRequest } = base;

  const fetchItems = async () => {
    return executeRequest(
      createRequestKey("fetchItems"),
      async () => {
        const items = await api.fetchItems();
        state.setPartial({ dataMap: items });
        return items;
      },
      "FETCH_ITEMS_FAILED"
    );
  };

  return { state, fetchItems };
})();
```

### Client State Store

```typescript
import { StandardState } from "./base-store";

class MyState extends StandardState {
  preference: string = "default";

  setPartial(partial: Partial<MyState>) {
    Object.assign(this, partial);
    // Optional: persist to localStorage
    localStorage.setItem("my-preference", JSON.stringify(this));
  }
}

const myStore = (() => {
  const state = new MyState();

  const setPreference = (value: string) => {
    state.setPartial({ preference: value });
  };

  return { state, setPreference };
})();
```

## Best Practices

### ✅ Do

- Use `observer()` HOC for components that access store state
- Call store actions from event handlers
- Use computed properties for derived state
- Handle errors from async store operations
- Keep stores focused on a single domain

### ❌ Don't

- Don't mutate store state directly - use `setPartial()` or action methods
- Don't call async store methods during render
- Don't mix server and client state in the same store
- Don't access stores outside of React components (except initialization)

## Performance Tips

1. **Computed Properties**: Use getters for derived state - they're memoized by MobX
2. **Request Deduplication**: Automatic for server stores - prevents wasted API calls
3. **Optimistic Updates**: Used in `updateMemo` - immediate UI feedback
4. **Fine-grained Reactivity**: MobX only re-renders components that access changed properties

## Testing

```typescript
import { memoStore } from "@/store";

describe("memoStore", () => {
  it("should fetch memos", async () => {
    const memos = await memoStore.fetchMemos({ filter: "..." });
    expect(memos).toBeDefined();
  });

  it("should cache memos", () => {
    const memo = memoStore.getMemoByName("memos/123");
    expect(memo).toBeDefined();
  });
});
```

## Migration Guide

If you're migrating from old store patterns:

1. **Replace direct state mutations** with `setPartial()`:
   ```typescript
   // Before
   store.state.value = 5;

   // After
   store.state.setPartial({ value: 5 });
   ```

2. **Wrap API calls** with `executeRequest()`:
   ```typescript
   // Before
   const data = await api.fetch();
   state.data = data;

   // After
   return executeRequest("fetchData", async () => {
     const data = await api.fetch();
     state.setPartial({ data });
     return data;
   }, "FETCH_FAILED");
   ```

3. **Use StandardState** for new stores:
   ```typescript
   // Before
   class State {
     constructor() { makeAutoObservable(this); }
   }

   // After
   class State extends StandardState {
     // makeAutoObservable() called automatically
   }
   ```

## Troubleshooting

**Q: Component not re-rendering when state changes?**
A: Make sure you wrapped it with `observer()` from `mobx-react-lite`.

**Q: Getting "Cannot modify state outside of actions" error?**
A: Use `state.setPartial()` instead of direct mutations.

**Q: API calls firing multiple times?**
A: Check that your store uses `createServerStore()` with deduplication enabled.

**Q: localStorage not persisting?**
A: Ensure your client store overrides `setPartial()` to call `localStorage.setItem()`.

## Resources

- [MobX Documentation](https://mobx.js.org/)
- [mobx-react-lite](https://github.com/mobxjs/mobx-react-lite)
- [Store Pattern Guide](./base-store.ts)
