# Authentication State Architecture

> Moved to [`.archcore/auth/auth-state.rfc.md`](../../.archcore/auth/auth-state.rfc.md).

## Current Approach: AuthContext

> Moved to [`.archcore/auth/auth-state.rfc.md`](../../.archcore/auth/auth-state.rfc.md).

### Future Considerations

> Moved to [`.archcore/auth/auth-state.rfc.md`](../../.archcore/auth/auth-state.rfc.md).

The unused `useCurrentUserQuery()` hook in `useUserQueries.ts` is kept for potential future use. If requirements change (e.g., real-time collaboration on user profiles), migration path is clear:

1. Remove AuthContext
2. Use `useCurrentUserQuery()` everywhere
3. Handle loading states in components
4. Add suspense boundaries if needed

## Recommendation

> Moved to [`.archcore/auth/auth-state.rfc.md`](../../.archcore/auth/auth-state.rfc.md).
