---
title: "Authentication state proposal"
status: draft
tags:
  - "auth"
---

## Summary

Keep `AuthContext` (@web/src/contexts/AuthContext.tsx) as the holder of web authentication state, instead of a React Query current-user query. This is an intentional architectural choice for Memos, a notes app where the user profile rarely changes.

## Motivation

1. **Synchronous initialization.** `AuthProvider` fetches the user during app initialization in @web/src/main.tsx and then gives synchronous access to `currentUser` throughout the app, so components do not handle a loading state each.
2. **Single source of truth.** The user is fetched once on mount; all components read the same user data, with no race conditions between multiple query instances.
3. **Integration with React Query.** After the fetch, `AuthContext` pre-populates the React Query cache, which gives synchronous access and cache consistency together. React Query hooks such as `useNotifications()` in @web/src/hooks/useUserQueries.ts keep working with the current user.
4. **Simpler component code.** `useCurrentUser()` (@web/src/hooks/useCurrentUser.ts) returns `User | undefined` directly. A query-based hook returns `{ data, isLoading }`, and each caller renders a loading state while `isLoading` is true.

[assumption] The approach gives better developer experience and performance for this use case; no measurement backs the performance claim.

## Detailed Design

- `AuthProvider` wraps the router in @web/src/main.tsx; `AppInitializer` calls its `initialize()` on mount.
- After `getCurrentUser` succeeds, `AuthContext` writes the user into the React Query cache under `userKeys.currentUser()` and `userKeys.detail(name)` (@web/src/hooks/useUserQueries.ts).
- Components read the user through `useAuth()` or `useCurrentUser()`, not through a React Query current-user hook.

## Drawbacks

The choice fits only while none of these conditions holds; each one makes migrating auth to React Query worth considering:

1. The app needs real-time user profile updates from external sources.
2. Multiple tabs need instant sync of user data.
3. User data changes frequently during a session.

## Alternatives

1. **React Query current-user query (`useCurrentUserQuery()`) everywhere** — not chosen, because every consuming component then handles loading states. When requirements change (for example, real-time collaboration on user profiles), the migration path is:
   1. Remove `AuthContext`.
   2. Use `useCurrentUserQuery()` everywhere.
   3. Handle loading states in components.
   4. Add suspense boundaries if needed.
