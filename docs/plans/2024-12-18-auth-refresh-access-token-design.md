# Authentication Redesign: Refresh + Access Token Pattern

## Overview

This document describes the redesign of Memos authentication to follow industry-standard OAuth2 refresh/access token patterns. The goal is to eliminate per-request database queries while maintaining security and enabling instant token revocation.

## Current Problems

1. **2 DB queries per authenticated request** - Interceptor validates session, service method fetches user again
2. **Sessions stored as JSON array per user** - Inefficient lookup, read-modify-write on updates
3. **Sliding expiration causes DB write every request** - `UpdateUserSessionLastAccessed` called constantly
4. **Access tokens validated against DB** - Defeats purpose of JWT statelessness

## Design Goals

- Zero DB queries for normal authenticated requests
- Industry-standard token pattern (OAuth2/OIDC aligned)
- Instant revocation support via refresh token invalidation
- Unified auth flow for web and API clients
- Minimal schema changes (reuse user_setting table)

## Token Design

### Access Token (Short-lived JWT)

```
Header: {
  "alg": "HS256",
  "typ": "JWT",
  "kid": "v1"
}

Payload: {
  "sub": "1",           // user_id (string)
  "type": "access",     // token type
  "role": "USER",       // user role (HOST/ADMIN/USER)
  "status": "ACTIVE",   // user status
  "username": "john",   // for display/logging
  "iat": 1734652800,    // issued at
  "exp": 1734653700     // expires (15 min default)
}
```

**Properties:**
- Lifetime: 15 minutes (configurable)
- Storage: Client memory (web), secure storage (mobile)
- Validation: Signature only - NO database lookup
- Contains: All claims needed for authorization decisions

### Refresh Token (Long-lived JWT)

```
Header: {
  "alg": "HS256",
  "typ": "JWT",
  "kid": "v1"
}

Payload: {
  "sub": "1",           // user_id
  "type": "refresh",    // token type
  "tid": "uuid-v4",     // token_id (for revocation)
  "iat": 1734652800,    // issued at
  "exp": 1737244800     // expires (30 days default)
}
```

**Properties:**
- Lifetime: 30 days (configurable)
- Storage: HttpOnly cookie (web), secure storage (mobile/API)
- Validation: Signature + database revocation check
- Contains: Minimal claims (user_id, token_id for revocation lookup)

## Storage Design

### Proto Definition

```protobuf
// In proto/store/user_setting.proto

message UserSetting {
  enum Key {
    KEY_UNSPECIFIED = 0;
    GENERAL = 1;
    // SESSIONS = 2;        // DEPRECATED
    // ACCESS_TOKENS = 3;   // DEPRECATED
    SHORTCUTS = 4;
    WEBHOOKS = 5;
    REFRESH_TOKENS = 6;     // NEW
  }
}

message RefreshTokensUserSetting {
  message RefreshToken {
    // Unique identifier (matches 'tid' claim in JWT)
    string token_id = 1;

    // When the token expires (matches 'exp' claim)
    google.protobuf.Timestamp expires_at = 2;

    // When the token was created (matches 'iat' claim)
    google.protobuf.Timestamp created_at = 3;

    // Client information for session management UI
    ClientInfo client_info = 4;

    // Optional description for manually created API tokens
    string description = 5;
  }

  repeated RefreshToken refresh_tokens = 1;
}
```

### Database Storage

Stored in existing `user_setting` table:

```
| user_id | key            | value (JSON)                    |
|---------|----------------|---------------------------------|
| 1       | REFRESH_TOKENS | {"refreshTokens": [{...}, ...]} |
```

## Authentication Flows

### Login Flow

1. Client sends credentials to `POST /api/v1/auth/login`
2. Server validates credentials against database
3. Server generates:
   - Access token (JWT, 15 min expiry)
   - Refresh token (JWT, 30 days expiry)
4. Server stores refresh token metadata in user_setting
5. Server responds with:
   - `access_token` in response body
   - `refresh_token` in HttpOnly cookie

### API Request Flow

1. Client sends request with `Authorization: Bearer <access_token>`
2. Interceptor validates JWT signature (NO database query)
3. Interceptor extracts claims, sets in context
4. Service method uses claims from context
5. If full user object needed, fetch once and cache in context

**Database queries: 0** (or 1 if full user needed)

### Token Refresh Flow

1. Client receives 401 (access token expired)
2. Client interceptor calls `POST /api/v1/auth/refresh`
3. Server parses refresh token JWT (signature + expiry check)
4. Server extracts user_id, token_id from claims
5. Server queries user_setting for revocation check
6. Server fetches fresh user data for new access token claims
7. Server generates new access token
8. Client interceptor retries original request

**Database queries: 2** (only every 15 minutes)

### Logout Flow

1. Client calls `POST /api/v1/auth/logout`
2. Server parses refresh token, extracts user_id, token_id
3. Server removes token_id from user_setting
4. Server clears refresh token cookie
5. Client clears access token from memory

## Context Propagation

Claims from access token are set in context by the interceptor:

```go
type UserClaims struct {
    UserID   int32
    Role     store.Role
    Status   string
    Username string
}

// Interceptor sets claims in context
ctx = context.WithValue(ctx, UserClaimsContextKey, claims)

// Service methods retrieve from context (no DB query)
claims := GetUserClaims(ctx)
```

If a service method needs the full user object:

```go
// Fetch once, cache in context for reuse
user, err := s.GetOrFetchUser(ctx, claims.UserID)
```

## API Endpoints

### New Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/login | Authenticate, return tokens |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Revoke refresh token |

### Modified Behavior

- `GetCurrentSession` - Returns user info from access token claims
- All protected endpoints - Validate access token signature only

## Client Integration (ConnectRPC)

```typescript
import { Interceptor } from "@connectrpc/connect";

const authInterceptor: Interceptor = (next) => async (req) => {
  // Add access token to request
  req.header.set("Authorization", `Bearer ${getAccessToken()}`);

  try {
    return await next(req);
  } catch (error) {
    if (error.code === "unauthenticated" && !req._retry) {
      req._retry = true;

      // Refresh token is in HttpOnly cookie, sent automatically
      const response = await authClient.refreshToken({});
      setAccessToken(response.accessToken);

      // Retry with new token
      req.header.set("Authorization", `Bearer ${response.accessToken}`);
      return await next(req);
    }
    throw error;
  }
};
```

## Performance Comparison

| Scenario | Current | New Design |
|----------|---------|------------|
| Normal API request | 2 DB queries | 0 DB queries |
| Request needing full user | 2 DB queries | 1 DB query |
| Token refresh | N/A | 2 DB queries (every 15 min) |
| Login | 1+ DB queries | 2 DB queries (once) |
| Logout | 1+ DB queries | 1 DB query (once) |

## Migration Strategy

1. Add new `REFRESH_TOKENS` key to user_setting proto
2. Implement new token generation and validation logic
3. Add `/auth/refresh` endpoint
4. Update interceptor to validate access tokens statelessly
5. Update frontend to use new token flow
6. Deprecate old `SESSIONS` and `ACCESS_TOKENS` keys
7. Migration script to clean up old session data

## Security Considerations

- **Access token theft**: Limited exposure (15 min window)
- **Refresh token theft**: Requires HttpOnly cookie extraction (XSS protected)
- **Token revocation**: Delete refresh token from user_setting, access expires naturally
- **Password change**: Invalidate all refresh tokens for user
- **Concurrent sessions**: Multiple refresh tokens allowed per user
- **Token rotation**: Optional - issue new refresh token on each refresh

## Configuration

```go
const (
    AccessTokenDuration  = 15 * time.Minute  // Configurable
    RefreshTokenDuration = 30 * 24 * time.Hour  // Configurable
)
```

## References

- [OAuth 2.0 RFC 6749](https://tools.ietf.org/html/rfc6749)
- [JWT RFC 7519](https://tools.ietf.org/html/rfc7519)
- [Auth0 Token Best Practices](https://auth0.com/docs/secure/tokens/token-best-practices)
