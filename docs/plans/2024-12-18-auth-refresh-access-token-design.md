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
- Unified auth flow for web and mobile clients
- Personal Access Tokens (PATs) for API/script access
- Minimal schema changes (reuse user_setting table)

## Authentication Types

This design supports two authentication mechanisms:

| Type | Use Case | Token | Lifetime | Validation |
|------|----------|-------|----------|------------|
| **User Session** | Web, Mobile apps | Refresh + Access | 30d / 15m | Stateless (access) |
| **Personal Access Token** | Scripts, CI/CD, API | PAT | Configurable | DB lookup |

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION TYPES                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. USER SESSION (Web/Mobile)                               │
│     ├── Refresh Token (30 days, HttpOnly cookie)            │
│     └── Access Token (15 min, stateless JWT)                │
│                                                             │
│  2. PERSONAL ACCESS TOKEN (API/Scripts)                     │
│     └── Long-lived token (user configurable expiry)         │
│         Validated against DB (acceptable for API use)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

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

### Personal Access Token (PAT)

PATs are designed for programmatic API access (scripts, CI/CD, integrations). Unlike access tokens, PATs are validated against the database but are only used for API calls, not interactive sessions.

```
Format: memos_pat_{random_32_chars}

Example: memos_pat_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

**Properties:**
- Lifetime: User configurable (30 days, 90 days, 1 year, or no expiry)
- Storage: Shown once on creation, user stores securely
- Validation: Hash comparison against database (1 DB query)
- Contains: Just the token - user info fetched from DB

**Security:**
- Token is hashed (SHA-256) before storage - plain token never stored
- Can be revoked instantly by deleting from user_setting
- Last used timestamp tracked for auditing
- Optional: scope restrictions (read-only, full access)

## Storage Design

### Proto Definition

```protobuf
// In proto/store/user_setting.proto

message UserSetting {
  enum Key {
    KEY_UNSPECIFIED = 0;
    GENERAL = 1;
    // SESSIONS = 2;                  // DEPRECATED
    // ACCESS_TOKENS = 3;             // DEPRECATED
    SHORTCUTS = 4;
    WEBHOOKS = 5;
    REFRESH_TOKENS = 6;               // NEW - for user sessions
    PERSONAL_ACCESS_TOKENS = 7;       // NEW - for API access
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

    // Optional description
    string description = 5;
  }

  repeated RefreshToken refresh_tokens = 1;
}

message PersonalAccessTokensUserSetting {
  message PersonalAccessToken {
    // Unique identifier for this token
    string token_id = 1;

    // SHA-256 hash of the actual token (for secure lookup)
    string token_hash = 2;

    // User-provided description (e.g., "CI/CD pipeline", "Mobile app")
    string description = 3;

    // When the token expires (null = never expires)
    google.protobuf.Timestamp expires_at = 4;

    // When the token was created
    google.protobuf.Timestamp created_at = 5;

    // When the token was last used (for auditing)
    google.protobuf.Timestamp last_used_at = 6;
  }

  repeated PersonalAccessToken tokens = 1;
}
```

### Database Storage

Stored in existing `user_setting` table:

```
| user_id | key                    | value (JSON)                           |
|---------|------------------------|----------------------------------------|
| 1       | REFRESH_TOKENS         | {"refreshTokens": [{...}, ...]}        |
| 1       | PERSONAL_ACCESS_TOKENS | {"tokens": [{...}, ...]}               |
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

### API Request Flow (Access Token - Web/Mobile)

1. Client sends request with `Authorization: Bearer <access_token>`
2. Interceptor validates JWT signature (NO database query)
3. Interceptor extracts claims, sets in context
4. Service method uses claims from context
5. If full user object needed, fetch once and cache in context

**Database queries: 0** (or 1 if full user needed)

### API Request Flow (Personal Access Token - Scripts/API)

1. Client sends request with `Authorization: Bearer memos_pat_xxxxx`
2. Interceptor detects PAT prefix (`memos_pat_`)
3. Interceptor hashes token, queries all users' PATs for match
4. On match: fetch user, set in context, update last_used_at
5. Service method uses user from context

**Database queries: 2** (acceptable for API use - not every 100ms like web)

```
┌──────────┐         ┌──────────┐         ┌──────────┐
│  Client  │         │  Server  │         │    DB    │
└────┬─────┘         └────┬─────┘         └────┬─────┘
     │                    │                    │
     │ GET /api/memos     │                    │
     │ Authorization:     │                    │
     │ Bearer memos_pat_xx│                    │
     │───────────────────>│                    │
     │                    │                    │
     │                    │ 1. Detect PAT prefix
     │                    │ 2. Hash token       │
     │                    │ 3. Query for match │
     │                    │───────────────────>│
     │                    │<───────────────────│
     │                    │                    │
     │                    │ 4. Fetch user      │
     │                    │───────────────────>│
     │                    │<───────────────────│
     │                    │                    │
     │                    │ 5. Update last_used│
     │                    │───────────────────>│
     │                    │                    │
     │ Response: memos    │                    │
     │<───────────────────│                    │
```

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

### Auth Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/v1/auth/login | Authenticate, return tokens |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Revoke refresh token |

### Personal Access Token Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/users/{id}/access-tokens | List user's PATs (metadata only) |
| POST | /api/v1/users/{id}/access-tokens | Create new PAT (returns token once) |
| DELETE | /api/v1/users/{id}/access-tokens/{token_id} | Revoke a PAT |

### Modified Behavior

- `GetCurrentSession` - Returns user info from access token claims
- All protected endpoints - Validate access token signature only (or PAT with DB lookup)

## Interceptor Logic

The auth interceptor handles both token types:

```go
func (in *AuthInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
    return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
        token := extractBearerToken(req.Header().Get("Authorization"))

        // No token - check if public method
        if token == "" {
            if IsPublicMethod(req.Spec().Procedure) {
                return next(ctx, req)
            }
            return nil, connect.NewError(connect.CodeUnauthenticated, "authentication required")
        }

        // Check if Personal Access Token (has prefix)
        if strings.HasPrefix(token, "memos_pat_") {
            user, err := in.validatePersonalAccessToken(ctx, token)
            if err != nil {
                return nil, connect.NewError(connect.CodeUnauthenticated, err.Error())
            }
            ctx = SetUserInContext(ctx, user)
            return next(ctx, req)
        }

        // Try to parse as JWT access token
        claims, err := in.parseAccessToken(token)
        if err != nil {
            return nil, connect.NewError(connect.CodeUnauthenticated, "invalid token")
        }

        // Valid access token - set claims in context (no DB query)
        ctx = SetClaimsInContext(ctx, claims)
        return next(ctx, req)
    }
}

func (in *AuthInterceptor) validatePersonalAccessToken(ctx context.Context, token string) (*store.User, error) {
    // Hash the token for secure comparison
    tokenHash := sha256.Sum256([]byte(token))
    hashStr := hex.EncodeToString(tokenHash[:])

    // Find PAT by hash (queries all users' PATs)
    result, err := in.store.GetUserByPATHash(ctx, hashStr)
    if err != nil {
        return nil, errors.New("invalid access token")
    }

    // Check expiry
    if result.PAT.ExpiresAt != nil && result.PAT.ExpiresAt.AsTime().Before(time.Now()) {
        return nil, errors.New("access token expired")
    }

    // Update last used (fire-and-forget)
    go in.store.UpdatePATLastUsed(ctx, result.UserID, result.PAT.TokenId)

    return result.User, nil
}
```

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
| Normal API request (access token) | 2 DB queries | 0 DB queries |
| Normal API request (PAT) | 2 DB queries | 2 DB queries |
| Request needing full user | 2 DB queries | 1 DB query |
| Token refresh | N/A | 2 DB queries (every 15 min) |
| Login | 1+ DB queries | 2 DB queries (once) |
| Logout | 1+ DB queries | 1 DB query (once) |

**Note:** PAT requests still require DB lookup, but this is acceptable because:
- API/script usage is typically lower frequency than web UI
- PATs are used for automation, not interactive sessions
- Industry standard (GitHub, GitLab use same pattern)

## Migration Strategy

### Phase 1: Add New Infrastructure
1. Add `REFRESH_TOKENS` and `PERSONAL_ACCESS_TOKENS` keys to proto
2. Implement new token generation and validation logic
3. Add `/auth/refresh` endpoint
4. Add PAT management endpoints
5. Update interceptor to handle both token types

### Phase 2: Migrate Existing Tokens
**Sessions (SESSIONS key):**
- Clean break - users will need to re-login
- Old sessions ignored after deployment

**Access Tokens (ACCESS_TOKENS key):**
- Migrate existing tokens to new `PERSONAL_ACCESS_TOKENS` format
- Migration script converts old JWT tokens to PAT format:
  ```go
  // For each existing access token:
  // 1. Generate new PAT: memos_pat_{random}
  // 2. Hash and store in PERSONAL_ACCESS_TOKENS
  // 3. Keep old JWT working during grace period (30 days)
  ```
- Users notified to regenerate tokens in settings

### Phase 3: Deprecation
1. After grace period, remove support for old `SESSIONS` key
2. After grace period, remove support for old `ACCESS_TOKENS` key
3. Clean up old data from user_setting table

### Migration Timeline
```
Day 0:   Deploy new auth system
         - New logins use refresh/access tokens
         - Old sessions continue working (temporary)
         - Old access tokens continue working (temporary)

Day 1-30: Grace period
         - Users naturally re-login (get new tokens)
         - API users migrate to PATs

Day 30:  Remove old token support
         - Old sessions rejected
         - Old access tokens rejected
```

## Security Considerations

### Access Tokens (JWT)
- **Token theft**: Limited exposure (15 min window)
- **Revocation**: Token expires naturally, or invalidate all by changing server secret

### Refresh Tokens (JWT)
- **Token theft**: Requires HttpOnly cookie extraction (XSS protected)
- **Revocation**: Delete from user_setting, instant effect
- **Password change**: Invalidate all refresh tokens for user
- **Concurrent sessions**: Multiple refresh tokens allowed per user
- **Token rotation**: Optional - issue new refresh token on each refresh

### Personal Access Tokens (PAT)
- **Token storage**: SHA-256 hashed before storage - plain token never stored
- **Token format**: Prefixed (`memos_pat_`) for easy identification
- **Revocation**: Delete from user_setting, instant effect
- **Expiry options**: User can set expiry (30d, 90d, 1y, never)
- **Audit trail**: `last_used_at` tracked for security review
- **Scope limitation**: Future enhancement - restrict PAT to read-only operations

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
