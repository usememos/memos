# Authentication State Architecture

## Current Approach: AuthContext

The application uses **AuthContext** for authentication state management, not React Query's `useCurrentUserQuery`. This is an intentional architectural decision.

### Why AuthContext Instead of React Query?

#### 1. **Synchronous Initialization**
- AuthContext fetches user data during app initialization (`main.tsx`)
- Provides synchronous access to `currentUser` throughout the app
- No need to handle loading states in every component

#### 2. **Single Source of Truth**
- User data fetched once on mount
- All components get consistent, up-to-date user info
- No race conditions from multiple query instances

#### 3. **Integration with React Query**
- AuthContext pre-populates React Query cache after fetch (line 81-82 in `AuthContext.tsx`)
- Best of both worlds: synchronous access + cache consistency
- React Query hooks like `useNotifications()` can still use the cached user data

#### 4. **Simpler Component Code**
```typescript
// With AuthContext (current)
const user = useCurrentUser(); // Always returns User | undefined

// With React Query (alternative)
const { data: user, isLoading } = useCurrentUserQuery();
if (isLoading) return <Spinner />;
// Need loading handling everywhere
```

### When to Use React Query for Auth?

Consider migrating auth to React Query if:
- App needs real-time user profile updates from external sources
- Multiple tabs need instant sync
- User data changes frequently during a session

For Memos (a notes app where user profile rarely changes), AuthContext is the right choice.

### Future Considerations

The unused `useCurrentUserQuery()` hook in `useUserQueries.ts` is kept for potential future use. If requirements change (e.g., real-time collaboration on user profiles), migration path is clear:

1. Remove AuthContext
2. Use `useCurrentUserQuery()` everywhere
3. Handle loading states in components
4. Add suspense boundaries if needed

## Recommendation

**Keep the current AuthContext approach.** It provides better DX and performance for this use case.
