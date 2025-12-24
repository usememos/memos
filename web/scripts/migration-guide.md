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
import { useMemo as useMemoQuery } from "@/hooks/useMemoQueries";

const Component = () => {
  const { data: memo, isLoading } = useMemoQuery(name);
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

- [x] web/src/pages/MemoDetail.tsx (done)
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
