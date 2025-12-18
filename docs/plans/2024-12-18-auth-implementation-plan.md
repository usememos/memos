# Auth Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement industry-standard OAuth2 refresh/access token pattern with Personal Access Token (PAT) support.

**Architecture:** Two auth paths - (1) User sessions using short-lived access tokens (15min) + long-lived refresh tokens (30d) for web/mobile, (2) Personal Access Tokens for API/scripts. Access tokens are stateless JWT (0 DB queries). Refresh tokens and PATs stored in user_setting table.

**Tech Stack:** Go, Protocol Buffers, ConnectRPC, TypeScript/React, SQLite/MySQL/PostgreSQL

---

## Phase 1: Backend - Proto Definitions

### Task 1: Update user_setting.proto with new token types

**Files:**
- Modify: `proto/store/user_setting.proto`

**Step 1: Add REFRESH_TOKENS and PERSONAL_ACCESS_TOKENS keys**

Add to the `UserSetting.Key` enum:

```protobuf
enum Key {
  KEY_UNSPECIFIED = 0;
  GENERAL = 1;
  SESSIONS = 2;           // Keep for backward compatibility during migration
  ACCESS_TOKENS = 3;      // Keep for backward compatibility during migration
  SHORTCUTS = 4;
  WEBHOOKS = 5;
  REFRESH_TOKENS = 6;     // NEW
  PERSONAL_ACCESS_TOKENS = 7; // NEW
}
```

**Step 2: Add RefreshTokensUserSetting message**

Add after `AccessTokensUserSetting`:

```protobuf
message RefreshTokensUserSetting {
  message RefreshToken {
    // Unique identifier (matches 'tid' claim in JWT)
    string token_id = 1;
    // When the token expires
    google.protobuf.Timestamp expires_at = 2;
    // When the token was created
    google.protobuf.Timestamp created_at = 3;
    // Client information for session management UI
    SessionsUserSetting.ClientInfo client_info = 4;
    // Optional description
    string description = 5;
  }
  repeated RefreshToken refresh_tokens = 1;
}
```

**Step 3: Add PersonalAccessTokensUserSetting message**

Add after `RefreshTokensUserSetting`:

```protobuf
message PersonalAccessTokensUserSetting {
  message PersonalAccessToken {
    // Unique identifier for this token
    string token_id = 1;
    // SHA-256 hash of the actual token
    string token_hash = 2;
    // User-provided description
    string description = 3;
    // When the token expires (null = never)
    google.protobuf.Timestamp expires_at = 4;
    // When the token was created
    google.protobuf.Timestamp created_at = 5;
    // When the token was last used
    google.protobuf.Timestamp last_used_at = 6;
  }
  repeated PersonalAccessToken tokens = 1;
}
```

**Step 4: Add oneof cases to UserSetting**

Update the `oneof value` in `UserSetting`:

```protobuf
oneof value {
  GeneralUserSetting general = 3;
  SessionsUserSetting sessions = 4;
  AccessTokensUserSetting access_tokens = 5;
  ShortcutsUserSetting shortcuts = 6;
  WebhooksUserSetting webhooks = 7;
  RefreshTokensUserSetting refresh_tokens = 8;
  PersonalAccessTokensUserSetting personal_access_tokens = 9;
}
```

**Step 5: Regenerate proto**

Run: `cd proto && buf generate`

**Step 6: Commit**

```bash
git add proto/
git commit -m "proto: add RefreshTokens and PersonalAccessTokens to user_setting"
```

---

### Task 2: Update auth_service.proto with refresh endpoint

**Files:**
- Modify: `proto/api/v1/auth_service.proto`

**Step 1: Add RefreshToken RPC**

Add to the `AuthService`:

```protobuf
// RefreshToken exchanges a valid refresh token for a new access token.
// The refresh token is sent via HttpOnly cookie.
rpc RefreshToken(RefreshTokenRequest) returns (RefreshTokenResponse) {
  option (google.api.http) = {
    post: "/api/v1/auth/refresh"
    body: "*"
  };
}
```

**Step 2: Add request/response messages**

Add after `DeleteSessionRequest`:

```protobuf
message RefreshTokenRequest {}

message RefreshTokenResponse {
  // The new short-lived access token
  string access_token = 1;
  // When the access token expires
  google.protobuf.Timestamp expires_at = 2;
}
```

**Step 3: Update CreateSessionResponse**

Modify `CreateSessionResponse` to include access_token:

```protobuf
message CreateSessionResponse {
  User user = 1;
  google.protobuf.Timestamp last_accessed_at = 2;
  // The short-lived access token for API requests
  string access_token = 3;
  // When the access token expires
  google.protobuf.Timestamp access_token_expires_at = 4;
}
```

**Step 4: Regenerate proto**

Run: `cd proto && buf generate`

**Step 5: Commit**

```bash
git add proto/
git commit -m "proto: add RefreshToken RPC and update CreateSessionResponse"
```

---

## Phase 2: Backend - Token Generation

### Task 3: Add new token types to auth/token.go

**Files:**
- Modify: `server/auth/token.go`

**Step 1: Add new constants**

Add after existing constants:

```go
const (
  // AccessTokenDuration is the lifetime of access tokens (15 minutes)
  AccessTokenDuration = 15 * time.Minute

  // RefreshTokenDuration is the lifetime of refresh tokens (30 days)
  RefreshTokenDuration = 30 * 24 * time.Hour

  // RefreshTokenAudienceName is the audience claim for refresh tokens
  RefreshTokenAudienceName = "user.refresh-token"

  // RefreshTokenCookieName is the cookie name for refresh tokens
  RefreshTokenCookieName = "memos_refresh"

  // PersonalAccessTokenPrefix is the prefix for PAT tokens
  PersonalAccessTokenPrefix = "memos_pat_"
)
```

**Step 2: Add AccessTokenClaims struct**

Add new claims struct for access tokens with user info:

```go
// AccessTokenClaims contains claims for short-lived access tokens.
// These tokens are validated by signature only (stateless).
type AccessTokenClaims struct {
  Type     string `json:"type"`     // "access"
  Role     string `json:"role"`     // User role
  Status   string `json:"status"`   // User status
  Username string `json:"username"` // Username for display
  jwt.RegisteredClaims
}
```

**Step 3: Add RefreshTokenClaims struct**

```go
// RefreshTokenClaims contains claims for long-lived refresh tokens.
// These tokens are validated against the database for revocation.
type RefreshTokenClaims struct {
  Type    string `json:"type"` // "refresh"
  TokenID string `json:"tid"`  // Token ID for revocation lookup
  jwt.RegisteredClaims
}
```

**Step 4: Add GenerateAccessTokenV2 function**

```go
// GenerateAccessTokenV2 generates a short-lived access token with user claims.
func GenerateAccessTokenV2(userID int32, username, role, status string, secret []byte) (string, time.Time, error) {
  expiresAt := time.Now().Add(AccessTokenDuration)

  claims := &AccessTokenClaims{
    Type:     "access",
    Role:     role,
    Status:   status,
    Username: username,
    RegisteredClaims: jwt.RegisteredClaims{
      Issuer:    Issuer,
      Subject:   fmt.Sprint(userID),
      IssuedAt:  jwt.NewNumericDate(time.Now()),
      ExpiresAt: jwt.NewNumericDate(expiresAt),
    },
  }

  token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
  token.Header["kid"] = KeyID

  tokenString, err := token.SignedString(secret)
  if err != nil {
    return "", time.Time{}, err
  }

  return tokenString, expiresAt, nil
}
```

**Step 5: Add GenerateRefreshToken function**

```go
// GenerateRefreshToken generates a long-lived refresh token.
func GenerateRefreshToken(userID int32, tokenID string, secret []byte) (string, time.Time, error) {
  expiresAt := time.Now().Add(RefreshTokenDuration)

  claims := &RefreshTokenClaims{
    Type:    "refresh",
    TokenID: tokenID,
    RegisteredClaims: jwt.RegisteredClaims{
      Issuer:    Issuer,
      Subject:   fmt.Sprint(userID),
      IssuedAt:  jwt.NewNumericDate(time.Now()),
      ExpiresAt: jwt.NewNumericDate(expiresAt),
    },
  }

  token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
  token.Header["kid"] = KeyID

  tokenString, err := token.SignedString(secret)
  if err != nil {
    return "", time.Time{}, err
  }

  return tokenString, expiresAt, nil
}
```

**Step 6: Add GeneratePersonalAccessToken function**

```go
// GeneratePersonalAccessToken generates a random PAT string.
func GeneratePersonalAccessToken() string {
  return PersonalAccessTokenPrefix + util.RandomString(32)
}

// HashPersonalAccessToken returns SHA-256 hash of a PAT.
func HashPersonalAccessToken(token string) string {
  hash := sha256.Sum256([]byte(token))
  return hex.EncodeToString(hash[:])
}
```

**Step 7: Add ParseAccessTokenV2 function**

```go
// ParseAccessTokenV2 parses and validates a short-lived access token.
func ParseAccessTokenV2(tokenString string, secret []byte) (*AccessTokenClaims, error) {
  claims := &AccessTokenClaims{}
  _, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
    if t.Method.Alg() != jwt.SigningMethodHS256.Name {
      return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
    }
    kid, ok := t.Header["kid"].(string)
    if !ok || kid != KeyID {
      return nil, fmt.Errorf("unexpected kid: %v", t.Header["kid"])
    }
    return secret, nil
  })
  if err != nil {
    return nil, err
  }
  if claims.Type != "access" {
    return nil, errors.New("invalid token type")
  }
  return claims, nil
}
```

**Step 8: Add ParseRefreshToken function**

```go
// ParseRefreshToken parses and validates a refresh token.
func ParseRefreshToken(tokenString string, secret []byte) (*RefreshTokenClaims, error) {
  claims := &RefreshTokenClaims{}
  _, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (any, error) {
    if t.Method.Alg() != jwt.SigningMethodHS256.Name {
      return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
    }
    kid, ok := t.Header["kid"].(string)
    if !ok || kid != KeyID {
      return nil, fmt.Errorf("unexpected kid: %v", t.Header["kid"])
    }
    return secret, nil
  })
  if err != nil {
    return nil, err
  }
  if claims.Type != "refresh" {
    return nil, errors.New("invalid token type")
  }
  return claims, nil
}
```

**Step 9: Commit**

```bash
git add server/auth/token.go
git commit -m "feat(auth): add access token v2, refresh token, and PAT generation"
```

---

### Task 4: Add context helpers for new token types

**Files:**
- Modify: `server/auth/context.go`

**Step 1: Add new context keys**

Add to the const block:

```go
// UserClaimsContextKey stores the claims from access token
UserClaimsContextKey

// RefreshTokenIDContextKey stores the refresh token ID
RefreshTokenIDContextKey
```

**Step 2: Add UserClaims struct**

```go
// UserClaims represents authenticated user info from access token.
type UserClaims struct {
  UserID   int32
  Username string
  Role     string
  Status   string
}
```

**Step 3: Add GetUserClaims function**

```go
// GetUserClaims retrieves the user claims from context.
// Returns nil if not authenticated via access token.
func GetUserClaims(ctx context.Context) *UserClaims {
  if v, ok := ctx.Value(UserClaimsContextKey).(*UserClaims); ok {
    return v
  }
  return nil
}
```

**Step 4: Add SetUserClaimsInContext function**

```go
// SetUserClaimsInContext sets the user claims in context.
func SetUserClaimsInContext(ctx context.Context, claims *UserClaims) context.Context {
  return context.WithValue(ctx, UserClaimsContextKey, claims)
}
```

**Step 5: Commit**

```bash
git add server/auth/context.go
git commit -m "feat(auth): add UserClaims context helpers"
```

---

## Phase 3: Backend - Store Layer

### Task 5: Add store methods for refresh tokens

**Files:**
- Modify: `store/user_setting.go`

**Step 1: Add RefreshTokenQueryResult struct**

```go
// RefreshTokenQueryResult contains the result of querying a refresh token.
type RefreshTokenQueryResult struct {
  UserID       int32
  RefreshToken *storepb.RefreshTokensUserSetting_RefreshToken
}
```

**Step 2: Add GetUserRefreshTokens method**

```go
// GetUserRefreshTokens returns the refresh tokens of the user.
func (s *Store) GetUserRefreshTokens(ctx context.Context, userID int32) ([]*storepb.RefreshTokensUserSetting_RefreshToken, error) {
  userSetting, err := s.GetUserSetting(ctx, &FindUserSetting{
    UserID: &userID,
    Key:    storepb.UserSetting_REFRESH_TOKENS,
  })
  if err != nil {
    return nil, err
  }
  if userSetting == nil {
    return []*storepb.RefreshTokensUserSetting_RefreshToken{}, nil
  }
  return userSetting.GetRefreshTokens().RefreshTokens, nil
}
```

**Step 3: Add AddUserRefreshToken method**

```go
// AddUserRefreshToken adds a new refresh token for the user.
func (s *Store) AddUserRefreshToken(ctx context.Context, userID int32, token *storepb.RefreshTokensUserSetting_RefreshToken) error {
  existingTokens, err := s.GetUserRefreshTokens(ctx, userID)
  if err != nil {
    return err
  }

  tokens := append(existingTokens, token)

  _, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
    UserId: userID,
    Key:    storepb.UserSetting_REFRESH_TOKENS,
    Value: &storepb.UserSetting_RefreshTokens{
      RefreshTokens: &storepb.RefreshTokensUserSetting{
        RefreshTokens: tokens,
      },
    },
  })
  return err
}
```

**Step 4: Add RemoveUserRefreshToken method**

```go
// RemoveUserRefreshToken removes a refresh token from the user.
func (s *Store) RemoveUserRefreshToken(ctx context.Context, userID int32, tokenID string) error {
  existingTokens, err := s.GetUserRefreshTokens(ctx, userID)
  if err != nil {
    return err
  }

  newTokens := make([]*storepb.RefreshTokensUserSetting_RefreshToken, 0, len(existingTokens))
  for _, token := range existingTokens {
    if token.TokenId != tokenID {
      newTokens = append(newTokens, token)
    }
  }

  _, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
    UserId: userID,
    Key:    storepb.UserSetting_REFRESH_TOKENS,
    Value: &storepb.UserSetting_RefreshTokens{
      RefreshTokens: &storepb.RefreshTokensUserSetting{
        RefreshTokens: newTokens,
      },
    },
  })
  return err
}
```

**Step 5: Add GetUserRefreshTokenByID method**

```go
// GetUserRefreshTokenByID returns a specific refresh token.
func (s *Store) GetUserRefreshTokenByID(ctx context.Context, userID int32, tokenID string) (*storepb.RefreshTokensUserSetting_RefreshToken, error) {
  tokens, err := s.GetUserRefreshTokens(ctx, userID)
  if err != nil {
    return nil, err
  }
  for _, token := range tokens {
    if token.TokenId == tokenID {
      return token, nil
    }
  }
  return nil, nil
}
```

**Step 6: Commit**

```bash
git add store/user_setting.go
git commit -m "feat(store): add refresh token management methods"
```

---

### Task 6: Add store methods for personal access tokens

**Files:**
- Modify: `store/user_setting.go`

**Step 1: Add PATQueryResult struct**

```go
// PATQueryResult contains the result of querying a PAT by hash.
type PATQueryResult struct {
  UserID int32
  User   *User
  PAT    *storepb.PersonalAccessTokensUserSetting_PersonalAccessToken
}
```

**Step 2: Add GetUserPersonalAccessTokens method**

```go
// GetUserPersonalAccessTokens returns the PATs of the user.
func (s *Store) GetUserPersonalAccessTokens(ctx context.Context, userID int32) ([]*storepb.PersonalAccessTokensUserSetting_PersonalAccessToken, error) {
  userSetting, err := s.GetUserSetting(ctx, &FindUserSetting{
    UserID: &userID,
    Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
  })
  if err != nil {
    return nil, err
  }
  if userSetting == nil {
    return []*storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{}, nil
  }
  return userSetting.GetPersonalAccessTokens().Tokens, nil
}
```

**Step 3: Add AddUserPersonalAccessToken method**

```go
// AddUserPersonalAccessToken adds a new PAT for the user.
func (s *Store) AddUserPersonalAccessToken(ctx context.Context, userID int32, token *storepb.PersonalAccessTokensUserSetting_PersonalAccessToken) error {
  existingTokens, err := s.GetUserPersonalAccessTokens(ctx, userID)
  if err != nil {
    return err
  }

  tokens := append(existingTokens, token)

  _, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
    UserId: userID,
    Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
    Value: &storepb.UserSetting_PersonalAccessTokens{
      PersonalAccessTokens: &storepb.PersonalAccessTokensUserSetting{
        Tokens: tokens,
      },
    },
  })
  return err
}
```

**Step 4: Add RemoveUserPersonalAccessToken method**

```go
// RemoveUserPersonalAccessToken removes a PAT from the user.
func (s *Store) RemoveUserPersonalAccessToken(ctx context.Context, userID int32, tokenID string) error {
  existingTokens, err := s.GetUserPersonalAccessTokens(ctx, userID)
  if err != nil {
    return err
  }

  newTokens := make([]*storepb.PersonalAccessTokensUserSetting_PersonalAccessToken, 0, len(existingTokens))
  for _, token := range existingTokens {
    if token.TokenId != tokenID {
      newTokens = append(newTokens, token)
    }
  }

  _, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
    UserId: userID,
    Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
    Value: &storepb.UserSetting_PersonalAccessTokens{
      PersonalAccessTokens: &storepb.PersonalAccessTokensUserSetting{
        Tokens: newTokens,
      },
    },
  })
  return err
}
```

**Step 5: Add UpdatePATLastUsed method**

```go
// UpdatePATLastUsed updates the last_used_at timestamp of a PAT.
func (s *Store) UpdatePATLastUsed(ctx context.Context, userID int32, tokenID string, lastUsed *timestamppb.Timestamp) error {
  tokens, err := s.GetUserPersonalAccessTokens(ctx, userID)
  if err != nil {
    return err
  }

  for _, token := range tokens {
    if token.TokenId == tokenID {
      token.LastUsedAt = lastUsed
      break
    }
  }

  _, err = s.UpsertUserSetting(ctx, &storepb.UserSetting{
    UserId: userID,
    Key:    storepb.UserSetting_PERSONAL_ACCESS_TOKENS,
    Value: &storepb.UserSetting_PersonalAccessTokens{
      PersonalAccessTokens: &storepb.PersonalAccessTokensUserSetting{
        Tokens: tokens,
      },
    },
  })
  return err
}
```

**Step 6: Commit**

```bash
git add store/user_setting.go
git commit -m "feat(store): add personal access token management methods"
```

---

### Task 7: Add driver interface and implementations for PAT lookup

**Files:**
- Modify: `store/driver.go`
- Modify: `store/db/sqlite/user_setting.go`
- Modify: `store/db/mysql/user_setting.go`
- Modify: `store/db/postgres/user_setting.go`

**Step 1: Add to Driver interface**

Add to `store/driver.go`:

```go
// GetUserByPATHash finds a user by PAT hash (searches all users)
GetUserByPATHash(ctx context.Context, tokenHash string) (*PATQueryResult, error)
```

**Step 2: Implement SQLite version**

Add to `store/db/sqlite/user_setting.go`:

```go
func (d *DB) GetUserByPATHash(ctx context.Context, tokenHash string) (*store.PATQueryResult, error) {
  query := `
    SELECT
      user_setting.user_id,
      user_setting.value
    FROM user_setting
    WHERE user_setting.key = 'PERSONAL_ACCESS_TOKENS'
      AND EXISTS (
        SELECT 1
        FROM json_each(json_extract(user_setting.value, '$.tokens')) AS token
        WHERE json_extract(token.value, '$.tokenHash') = ?
      )
  `

  var userID int32
  var tokensJSON string

  err := d.db.QueryRowContext(ctx, query, tokenHash).Scan(&userID, &tokensJSON)
  if err != nil {
    return nil, err
  }

  patsUserSetting := &storepb.PersonalAccessTokensUserSetting{}
  if err := protojsonUnmarshaler.Unmarshal([]byte(tokensJSON), patsUserSetting); err != nil {
    return nil, err
  }

  for _, pat := range patsUserSetting.Tokens {
    if pat.TokenHash == tokenHash {
      return &store.PATQueryResult{
        UserID: userID,
        PAT:    pat,
      }, nil
    }
  }

  return nil, errors.New("PAT not found")
}
```

**Step 3: Implement MySQL version**

Add to `store/db/mysql/user_setting.go`:

```go
func (d *DB) GetUserByPATHash(ctx context.Context, tokenHash string) (*store.PATQueryResult, error) {
  query := `
    SELECT
      user_setting.user_id,
      user_setting.value
    FROM user_setting
    WHERE user_setting.key = 'PERSONAL_ACCESS_TOKENS'
      AND JSON_CONTAINS(value, JSON_OBJECT('tokenHash', ?), '$.tokens')
  `

  var userID int32
  var tokensJSON string

  err := d.db.QueryRowContext(ctx, query, tokenHash).Scan(&userID, &tokensJSON)
  if err != nil {
    return nil, err
  }

  patsUserSetting := &storepb.PersonalAccessTokensUserSetting{}
  if err := protojsonUnmarshaler.Unmarshal([]byte(tokensJSON), patsUserSetting); err != nil {
    return nil, err
  }

  for _, pat := range patsUserSetting.Tokens {
    if pat.TokenHash == tokenHash {
      return &store.PATQueryResult{
        UserID: userID,
        PAT:    pat,
      }, nil
    }
  }

  return nil, errors.New("PAT not found")
}
```

**Step 4: Implement PostgreSQL version**

Add to `store/db/postgres/user_setting.go`:

```go
func (d *DB) GetUserByPATHash(ctx context.Context, tokenHash string) (*store.PATQueryResult, error) {
  query := `
    SELECT
      user_setting.user_id,
      user_setting.value
    FROM user_setting
    WHERE user_setting.key = 'PERSONAL_ACCESS_TOKENS'
      AND value->'tokens' @> $1::jsonb
  `

  tokenFilter := fmt.Sprintf(`[{"tokenHash": "%s"}]`, tokenHash)

  var userID int32
  var tokensJSON string

  err := d.db.QueryRowContext(ctx, query, tokenFilter).Scan(&userID, &tokensJSON)
  if err != nil {
    return nil, err
  }

  patsUserSetting := &storepb.PersonalAccessTokensUserSetting{}
  if err := protojsonUnmarshaler.Unmarshal([]byte(tokensJSON), patsUserSetting); err != nil {
    return nil, err
  }

  for _, pat := range patsUserSetting.Tokens {
    if pat.TokenHash == tokenHash {
      return &store.PATQueryResult{
        UserID: userID,
        PAT:    pat,
      }, nil
    }
  }

  return nil, errors.New("PAT not found")
}
```

**Step 5: Add Store wrapper method**

Add to `store/user_setting.go`:

```go
// GetUserByPATHash finds a user by PAT hash.
func (s *Store) GetUserByPATHash(ctx context.Context, tokenHash string) (*PATQueryResult, error) {
  result, err := s.driver.GetUserByPATHash(ctx, tokenHash)
  if err != nil {
    return nil, err
  }

  // Fetch user info
  user, err := s.GetUser(ctx, &FindUser{ID: &result.UserID})
  if err != nil {
    return nil, err
  }
  result.User = user

  return result, nil
}
```

**Step 6: Commit**

```bash
git add store/
git commit -m "feat(store): add PAT lookup by hash for all database drivers"
```

---

## Phase 4: Backend - Auth Service Implementation

### Task 8: Update authenticator for new token types

**Files:**
- Modify: `server/auth/authenticator.go`

**Step 1: Add AuthenticateByAccessTokenV2 method**

```go
// AuthenticateByAccessTokenV2 validates a short-lived access token.
// Returns claims without database query (stateless validation).
func (a *Authenticator) AuthenticateByAccessTokenV2(accessToken string) (*UserClaims, error) {
  claims, err := ParseAccessTokenV2(accessToken, []byte(a.secret))
  if err != nil {
    return nil, errors.Wrap(err, "invalid access token")
  }

  userID, err := util.ConvertStringToInt32(claims.Subject)
  if err != nil {
    return nil, errors.Wrap(err, "invalid user ID in token")
  }

  return &UserClaims{
    UserID:   userID,
    Username: claims.Username,
    Role:     claims.Role,
    Status:   claims.Status,
  }, nil
}
```

**Step 2: Add AuthenticateByRefreshToken method**

```go
// AuthenticateByRefreshToken validates a refresh token against the database.
func (a *Authenticator) AuthenticateByRefreshToken(ctx context.Context, refreshToken string) (*store.User, string, error) {
  claims, err := ParseRefreshToken(refreshToken, []byte(a.secret))
  if err != nil {
    return nil, "", errors.Wrap(err, "invalid refresh token")
  }

  userID, err := util.ConvertStringToInt32(claims.Subject)
  if err != nil {
    return nil, "", errors.Wrap(err, "invalid user ID in token")
  }

  // Check token exists in database (revocation check)
  token, err := a.store.GetUserRefreshTokenByID(ctx, userID, claims.TokenID)
  if err != nil {
    return nil, "", errors.Wrap(err, "failed to get refresh token")
  }
  if token == nil {
    return nil, "", errors.New("refresh token revoked")
  }

  // Check token not expired
  if token.ExpiresAt != nil && token.ExpiresAt.AsTime().Before(time.Now()) {
    return nil, "", errors.New("refresh token expired")
  }

  // Get user
  user, err := a.store.GetUser(ctx, &store.FindUser{ID: &userID})
  if err != nil {
    return nil, "", errors.Wrap(err, "failed to get user")
  }
  if user == nil {
    return nil, "", errors.New("user not found")
  }
  if user.RowStatus == store.Archived {
    return nil, "", errors.New("user is archived")
  }

  return user, claims.TokenID, nil
}
```

**Step 3: Add AuthenticateByPAT method**

```go
// AuthenticateByPAT validates a Personal Access Token.
func (a *Authenticator) AuthenticateByPAT(ctx context.Context, token string) (*store.User, *storepb.PersonalAccessTokensUserSetting_PersonalAccessToken, error) {
  if !strings.HasPrefix(token, PersonalAccessTokenPrefix) {
    return nil, nil, errors.New("invalid PAT format")
  }

  tokenHash := HashPersonalAccessToken(token)
  result, err := a.store.GetUserByPATHash(ctx, tokenHash)
  if err != nil {
    return nil, nil, errors.Wrap(err, "invalid PAT")
  }

  // Check expiry
  if result.PAT.ExpiresAt != nil && result.PAT.ExpiresAt.AsTime().Before(time.Now()) {
    return nil, nil, errors.New("PAT expired")
  }

  // Check user status
  if result.User.RowStatus == store.Archived {
    return nil, nil, errors.New("user is archived")
  }

  return result.User, result.PAT, nil
}
```

**Step 4: Update Authenticate method**

Update the `Authenticate` method to try new token types first:

```go
// Authenticate tries to authenticate using the provided credentials.
// Priority: 1. Access Token V2, 2. PAT, 3. Legacy session, 4. Legacy JWT
func (a *Authenticator) Authenticate(ctx context.Context, sessionID, authHeader string) *AuthResult {
  token := ExtractBearerToken(authHeader)

  // Try Access Token V2 (stateless)
  if token != "" && !strings.HasPrefix(token, PersonalAccessTokenPrefix) {
    claims, err := a.AuthenticateByAccessTokenV2(token)
    if err == nil && claims != nil {
      return &AuthResult{
        Claims:      claims,
        AccessToken: token,
      }
    }
  }

  // Try PAT
  if token != "" && strings.HasPrefix(token, PersonalAccessTokenPrefix) {
    user, pat, err := a.AuthenticateByPAT(ctx, token)
    if err == nil && user != nil {
      // Update last used (fire-and-forget)
      go func() {
        _ = a.store.UpdatePATLastUsed(context.Background(), user.ID, pat.TokenId, timestamppb.Now())
      }()
      return &AuthResult{User: user, AccessToken: token}
    }
  }

  // Legacy: Try session cookie
  if sessionID != "" {
    user, err := a.AuthenticateBySession(ctx, sessionID)
    if err == nil && user != nil {
      a.UpdateSessionLastAccessed(ctx, user.ID, sessionID)
      return &AuthResult{User: user, SessionID: sessionID}
    }
  }

  // Legacy: Try JWT
  if token != "" {
    user, err := a.AuthenticateByJWT(ctx, token)
    if err == nil && user != nil {
      return &AuthResult{User: user, AccessToken: token}
    }
  }

  return nil
}
```

**Step 5: Update AuthResult struct**

```go
// AuthResult contains the result of an authentication attempt.
type AuthResult struct {
  User        *store.User   // Set for PAT and legacy auth
  Claims      *UserClaims   // Set for Access Token V2 (stateless)
  SessionID   string
  AccessToken string
}
```

**Step 6: Commit**

```bash
git add server/auth/authenticator.go
git commit -m "feat(auth): add AccessTokenV2, RefreshToken, and PAT authentication"
```

---

### Task 9: Update interceptor for new auth flow

**Files:**
- Modify: `server/router/api/v1/connect_interceptors.go`

**Step 1: Update WrapUnary to handle new token types**

Update the `AuthInterceptor.WrapUnary` method:

```go
func (in *AuthInterceptor) WrapUnary(next connect.UnaryFunc) connect.UnaryFunc {
  return func(ctx context.Context, req connect.AnyRequest) (connect.AnyResponse, error) {
    header := req.Header()
    sessionCookie := auth.ExtractSessionCookieFromHeader(header.Get("Cookie"))
    authHeader := header.Get("Authorization")

    result := in.authenticator.Authenticate(ctx, sessionCookie, authHeader)

    // Enforce authentication for non-public methods
    if result == nil && !IsPublicMethod(req.Spec().Procedure) {
      return nil, connect.NewError(connect.CodeUnauthenticated, errors.New("authentication required"))
    }

    // Set context based on auth result
    if result != nil {
      if result.Claims != nil {
        // Access Token V2 - stateless, use claims
        ctx = auth.SetUserClaimsInContext(ctx, result.Claims)
        ctx = context.WithValue(ctx, auth.UserIDContextKey, result.Claims.UserID)
      } else if result.User != nil {
        // PAT or legacy auth - have full user
        ctx = auth.SetUserInContext(ctx, result.User, result.SessionID, result.AccessToken)
      }
    }

    return next(ctx, req)
  }
}
```

**Step 2: Commit**

```bash
git add server/router/api/v1/connect_interceptors.go
git commit -m "feat(api): update interceptor to handle AccessTokenV2 and PAT"
```

---

### Task 10: Implement RefreshToken RPC

**Files:**
- Modify: `server/router/api/v1/auth_service.go`

**Step 1: Add RefreshToken method**

```go
// RefreshToken exchanges a valid refresh token for a new access token.
func (s *APIV1Service) RefreshToken(ctx context.Context, _ *v1pb.RefreshTokenRequest) (*v1pb.RefreshTokenResponse, error) {
  // Extract refresh token from cookie
  refreshToken := ""
  if md, ok := metadata.FromIncomingContext(ctx); ok {
    if cookies := md.Get("cookie"); len(cookies) > 0 {
      refreshToken = auth.ExtractRefreshTokenFromCookie(cookies[0])
    }
  }

  if refreshToken == "" {
    return nil, status.Errorf(codes.Unauthenticated, "refresh token not found")
  }

  // Validate refresh token
  authenticator := auth.NewAuthenticator(s.Store, s.Secret)
  user, _, err := authenticator.AuthenticateByRefreshToken(ctx, refreshToken)
  if err != nil {
    return nil, status.Errorf(codes.Unauthenticated, "invalid refresh token: %v", err)
  }

  // Generate new access token
  accessToken, expiresAt, err := auth.GenerateAccessTokenV2(
    user.ID,
    user.Username,
    string(user.Role),
    string(user.RowStatus),
    []byte(s.Secret),
  )
  if err != nil {
    return nil, status.Errorf(codes.Internal, "failed to generate access token: %v", err)
  }

  return &v1pb.RefreshTokenResponse{
    AccessToken: accessToken,
    ExpiresAt:   timestamppb.New(expiresAt),
  }, nil
}
```

**Step 2: Add ExtractRefreshTokenFromCookie helper**

Add to `server/auth/extract.go`:

```go
// ExtractRefreshTokenFromCookie extracts the refresh token from cookie header.
func ExtractRefreshTokenFromCookie(cookieHeader string) string {
  if cookieHeader == "" {
    return ""
  }
  req := &http.Request{Header: http.Header{"Cookie": []string{cookieHeader}}}
  cookie, err := req.Cookie(RefreshTokenCookieName)
  if err != nil {
    return ""
  }
  return cookie.Value
}
```

**Step 3: Commit**

```bash
git add server/router/api/v1/auth_service.go server/auth/extract.go
git commit -m "feat(api): implement RefreshToken RPC"
```

---

### Task 11: Update CreateSession to return tokens

**Files:**
- Modify: `server/router/api/v1/auth_service.go`

**Step 1: Update doSignIn to create both tokens**

```go
func (s *APIV1Service) doSignIn(ctx context.Context, user *store.User, expireTime time.Time) (string, time.Time, error) {
  // Generate refresh token
  tokenID := util.GenUUID()
  refreshToken, refreshExpiresAt, err := auth.GenerateRefreshToken(user.ID, tokenID, []byte(s.Secret))
  if err != nil {
    return "", time.Time{}, errors.Wrap(err, "failed to generate refresh token")
  }

  // Store refresh token metadata
  clientInfo := s.extractClientInfo(ctx)
  refreshTokenRecord := &storepb.RefreshTokensUserSetting_RefreshToken{
    TokenId:    tokenID,
    ExpiresAt:  timestamppb.New(refreshExpiresAt),
    CreatedAt:  timestamppb.Now(),
    ClientInfo: clientInfo,
  }
  if err := s.Store.AddUserRefreshToken(ctx, user.ID, refreshTokenRecord); err != nil {
    slog.Error("failed to store refresh token", "error", err)
  }

  // Set refresh token cookie
  refreshCookie := s.buildRefreshTokenCookie(ctx, refreshToken, refreshExpiresAt)
  if err := SetResponseHeader(ctx, "Set-Cookie", refreshCookie); err != nil {
    return "", time.Time{}, errors.Wrap(err, "failed to set refresh token cookie")
  }

  // Generate access token
  accessToken, accessExpiresAt, err := auth.GenerateAccessTokenV2(
    user.ID,
    user.Username,
    string(user.Role),
    string(user.RowStatus),
    []byte(s.Secret),
  )
  if err != nil {
    return "", time.Time{}, errors.Wrap(err, "failed to generate access token")
  }

  return accessToken, accessExpiresAt, nil
}
```

**Step 2: Add buildRefreshTokenCookie helper**

```go
func (*APIV1Service) buildRefreshTokenCookie(ctx context.Context, refreshToken string, expireTime time.Time) string {
  attrs := []string{
    fmt.Sprintf("%s=%s", auth.RefreshTokenCookieName, refreshToken),
    "Path=/",
    "HttpOnly",
  }
  if expireTime.IsZero() {
    attrs = append(attrs, "Expires=Thu, 01 Jan 1970 00:00:00 GMT")
  } else {
    attrs = append(attrs, "Expires="+expireTime.Format(time.RFC1123))
  }

  isHTTPS := false
  if md, ok := metadata.FromIncomingContext(ctx); ok {
    for _, v := range md.Get("origin") {
      if strings.HasPrefix(v, "https://") {
        isHTTPS = true
        break
      }
    }
  }

  if isHTTPS {
    attrs = append(attrs, "SameSite=None", "Secure")
  } else {
    attrs = append(attrs, "SameSite=Strict")
  }
  return strings.Join(attrs, "; ")
}
```

**Step 3: Update CreateSession to return access token**

```go
func (s *APIV1Service) CreateSession(ctx context.Context, request *v1pb.CreateSessionRequest) (*v1pb.CreateSessionResponse, error) {
  // ... existing authentication logic ...

  if existingUser == nil {
    return nil, status.Errorf(codes.InvalidArgument, "invalid credentials")
  }
  if existingUser.RowStatus == store.Archived {
    return nil, status.Errorf(codes.PermissionDenied, "user has been archived")
  }

  // Sign in and get tokens
  accessToken, accessExpiresAt, err := s.doSignIn(ctx, existingUser, time.Now().Add(auth.RefreshTokenDuration))
  if err != nil {
    return nil, status.Errorf(codes.Internal, "failed to sign in: %v", err)
  }

  return &v1pb.CreateSessionResponse{
    User:                 convertUserFromStore(existingUser),
    LastAccessedAt:       timestamppb.Now(),
    AccessToken:          accessToken,
    AccessTokenExpiresAt: timestamppb.New(accessExpiresAt),
  }, nil
}
```

**Step 4: Commit**

```bash
git add server/router/api/v1/auth_service.go
git commit -m "feat(api): update CreateSession to return access and refresh tokens"
```

---

### Task 12: Update DeleteSession for new tokens

**Files:**
- Modify: `server/router/api/v1/auth_service.go`

**Step 1: Update DeleteSession to clear refresh token**

```go
func (s *APIV1Service) DeleteSession(ctx context.Context, _ *v1pb.DeleteSessionRequest) (*emptypb.Empty, error) {
  // Try to get user from new access token claims
  claims := auth.GetUserClaims(ctx)
  if claims != nil {
    // Revoke refresh token if we can identify it
    refreshToken := ""
    if md, ok := metadata.FromIncomingContext(ctx); ok {
      if cookies := md.Get("cookie"); len(cookies) > 0 {
        refreshToken = auth.ExtractRefreshTokenFromCookie(cookies[0])
      }
    }
    if refreshToken != "" {
      refreshClaims, err := auth.ParseRefreshToken(refreshToken, []byte(s.Secret))
      if err == nil {
        _ = s.Store.RemoveUserRefreshToken(ctx, claims.UserID, refreshClaims.TokenID)
      }
    }
  } else {
    // Legacy: try old session-based logout
    user, err := s.GetCurrentUser(ctx)
    if err == nil && user != nil {
      if sessionID := auth.GetSessionID(ctx); sessionID != "" {
        _ = s.Store.RemoveUserSession(ctx, user.ID, sessionID)
      }
    }
  }

  // Clear all auth cookies
  if err := s.clearAuthCookies(ctx); err != nil {
    return nil, status.Errorf(codes.Internal, "failed to clear cookies: %v", err)
  }

  return &emptypb.Empty{}, nil
}
```

**Step 2: Update clearAuthCookies to clear refresh token**

```go
func (s *APIV1Service) clearAuthCookies(ctx context.Context) error {
  // Clear legacy session cookie
  sessionCookie, err := s.buildSessionCookie(ctx, "", time.Time{})
  if err != nil {
    return errors.Wrap(err, "failed to build session cookie")
  }
  if err := SetResponseHeader(ctx, "Set-Cookie", sessionCookie); err != nil {
    return errors.Wrap(err, "failed to set session cookie")
  }

  // Clear refresh token cookie
  refreshCookie := s.buildRefreshTokenCookie(ctx, "", time.Time{})
  if err := SetResponseHeader(ctx, "Set-Cookie", refreshCookie); err != nil {
    return errors.Wrap(err, "failed to set refresh cookie")
  }

  return nil
}
```

**Step 3: Commit**

```bash
git add server/router/api/v1/auth_service.go
git commit -m "feat(api): update DeleteSession to handle new token types"
```

---

## Phase 5: Backend - Add PAT Management Endpoints

### Task 13: Add PAT management to user_service.proto

**Files:**
- Modify: `proto/api/v1/user_service.proto`

**Step 1: Add PAT RPCs**

Add to `UserService`:

```protobuf
// ListUserAccessTokens lists personal access tokens for a user.
rpc ListUserAccessTokens(ListUserAccessTokensRequest) returns (ListUserAccessTokensResponse) {
  option (google.api.http) = {get: "/api/v1/{parent=users/*}/accessTokens"};
}

// CreateUserAccessToken creates a new personal access token.
rpc CreateUserAccessToken(CreateUserAccessTokenRequest) returns (CreateUserAccessTokenResponse) {
  option (google.api.http) = {
    post: "/api/v1/{parent=users/*}/accessTokens"
    body: "*"
  };
}

// DeleteUserAccessToken deletes a personal access token.
rpc DeleteUserAccessToken(DeleteUserAccessTokenRequest) returns (google.protobuf.Empty) {
  option (google.api.http) = {delete: "/api/v1/{name=users/*/accessTokens/*}"};
}
```

**Step 2: Add request/response messages**

```protobuf
message ListUserAccessTokensRequest {
  string parent = 1;
}

message ListUserAccessTokensResponse {
  repeated UserAccessToken access_tokens = 1;
}

message UserAccessToken {
  string name = 1;
  string description = 2;
  google.protobuf.Timestamp expires_at = 3;
  google.protobuf.Timestamp created_at = 4;
  google.protobuf.Timestamp last_used_at = 5;
}

message CreateUserAccessTokenRequest {
  string parent = 1;
  string description = 2;
  // Optional expiry duration in days (0 = never expires)
  int32 expires_in_days = 3;
}

message CreateUserAccessTokenResponse {
  UserAccessToken access_token = 1;
  // The actual token value - only returned on creation
  string token = 2;
}

message DeleteUserAccessTokenRequest {
  string name = 1;
}
```

**Step 3: Regenerate proto**

Run: `cd proto && buf generate`

**Step 4: Commit**

```bash
git add proto/
git commit -m "proto: add PAT management endpoints to user_service"
```

---

### Task 14: Implement PAT management endpoints

**Files:**
- Modify: `server/router/api/v1/user_service.go`

**Step 1: Add ListUserAccessTokens**

```go
func (s *APIV1Service) ListUserAccessTokens(ctx context.Context, request *v1pb.ListUserAccessTokensRequest) (*v1pb.ListUserAccessTokensResponse, error) {
  userID, err := ExtractUserIDFromName(request.Parent)
  if err != nil {
    return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
  }

  // Verify permission
  claims := auth.GetUserClaims(ctx)
  if claims == nil || claims.UserID != userID {
    currentUser, _ := s.GetCurrentUser(ctx)
    if currentUser == nil || (currentUser.ID != userID && currentUser.Role != store.RoleHost && currentUser.Role != store.RoleAdmin) {
      return nil, status.Errorf(codes.PermissionDenied, "permission denied")
    }
  }

  tokens, err := s.Store.GetUserPersonalAccessTokens(ctx, userID)
  if err != nil {
    return nil, status.Errorf(codes.Internal, "failed to get access tokens: %v", err)
  }

  accessTokens := make([]*v1pb.UserAccessToken, len(tokens))
  for i, token := range tokens {
    accessTokens[i] = &v1pb.UserAccessToken{
      Name:        fmt.Sprintf("%s/accessTokens/%s", request.Parent, token.TokenId),
      Description: token.Description,
      ExpiresAt:   token.ExpiresAt,
      CreatedAt:   token.CreatedAt,
      LastUsedAt:  token.LastUsedAt,
    }
  }

  return &v1pb.ListUserAccessTokensResponse{AccessTokens: accessTokens}, nil
}
```

**Step 2: Add CreateUserAccessToken**

```go
func (s *APIV1Service) CreateUserAccessToken(ctx context.Context, request *v1pb.CreateUserAccessTokenRequest) (*v1pb.CreateUserAccessTokenResponse, error) {
  userID, err := ExtractUserIDFromName(request.Parent)
  if err != nil {
    return nil, status.Errorf(codes.InvalidArgument, "invalid user name: %v", err)
  }

  // Verify permission
  claims := auth.GetUserClaims(ctx)
  if claims == nil || claims.UserID != userID {
    currentUser, _ := s.GetCurrentUser(ctx)
    if currentUser == nil || currentUser.ID != userID {
      return nil, status.Errorf(codes.PermissionDenied, "permission denied")
    }
  }

  // Generate PAT
  tokenID := util.GenUUID()
  token := auth.GeneratePersonalAccessToken()
  tokenHash := auth.HashPersonalAccessToken(token)

  var expiresAt *timestamppb.Timestamp
  if request.ExpiresInDays > 0 {
    expiresAt = timestamppb.New(time.Now().AddDate(0, 0, int(request.ExpiresInDays)))
  }

  patRecord := &storepb.PersonalAccessTokensUserSetting_PersonalAccessToken{
    TokenId:     tokenID,
    TokenHash:   tokenHash,
    Description: request.Description,
    ExpiresAt:   expiresAt,
    CreatedAt:   timestamppb.Now(),
  }

  if err := s.Store.AddUserPersonalAccessToken(ctx, userID, patRecord); err != nil {
    return nil, status.Errorf(codes.Internal, "failed to create access token: %v", err)
  }

  return &v1pb.CreateUserAccessTokenResponse{
    AccessToken: &v1pb.UserAccessToken{
      Name:        fmt.Sprintf("%s/accessTokens/%s", request.Parent, tokenID),
      Description: request.Description,
      ExpiresAt:   expiresAt,
      CreatedAt:   patRecord.CreatedAt,
    },
    Token: token, // Only returned on creation
  }, nil
}
```

**Step 3: Add DeleteUserAccessToken**

```go
func (s *APIV1Service) DeleteUserAccessToken(ctx context.Context, request *v1pb.DeleteUserAccessTokenRequest) (*emptypb.Empty, error) {
  // Parse name: users/{user_id}/accessTokens/{token_id}
  parts := strings.Split(request.Name, "/")
  if len(parts) != 4 || parts[0] != "users" || parts[2] != "accessTokens" {
    return nil, status.Errorf(codes.InvalidArgument, "invalid access token name")
  }

  userID, err := util.ConvertStringToInt32(parts[1])
  if err != nil {
    return nil, status.Errorf(codes.InvalidArgument, "invalid user ID: %v", err)
  }
  tokenID := parts[3]

  // Verify permission
  claims := auth.GetUserClaims(ctx)
  if claims == nil || claims.UserID != userID {
    currentUser, _ := s.GetCurrentUser(ctx)
    if currentUser == nil || currentUser.ID != userID {
      return nil, status.Errorf(codes.PermissionDenied, "permission denied")
    }
  }

  if err := s.Store.RemoveUserPersonalAccessToken(ctx, userID, tokenID); err != nil {
    return nil, status.Errorf(codes.Internal, "failed to delete access token: %v", err)
  }

  return &emptypb.Empty{}, nil
}
```

**Step 4: Commit**

```bash
git add server/router/api/v1/user_service.go
git commit -m "feat(api): implement PAT management endpoints"
```

---

## Phase 6: Frontend - Token Refresh Integration

### Task 15: Add auth interceptor to connect.ts

**Files:**
- Modify: `web/src/connect.ts`

**Step 1: Create auth state module**

Create `web/src/auth-state.ts`:

```typescript
// In-memory storage for access token (not persisted)
let accessToken: string | null = null;
let tokenExpiresAt: Date | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null, expiresAt?: Date) => {
  accessToken = token;
  tokenExpiresAt = expiresAt || null;
};

export const isTokenExpired = () => {
  if (!tokenExpiresAt) return true;
  // Consider expired 30 seconds before actual expiry for safety
  return new Date() >= new Date(tokenExpiresAt.getTime() - 30000);
};

export const clearAccessToken = () => {
  accessToken = null;
  tokenExpiresAt = null;
};
```

**Step 2: Add auth interceptor**

Update `web/src/connect.ts`:

```typescript
import { createClient, Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { getAccessToken, setAccessToken, isTokenExpired } from "./auth-state";
// ... existing imports ...

let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;

const authInterceptor: Interceptor = (next) => async (req) => {
  // Add access token to request if available
  const token = getAccessToken();
  if (token) {
    req.header.set("Authorization", `Bearer ${token}`);
  }

  try {
    return await next(req);
  } catch (error: any) {
    // Handle unauthenticated error - try to refresh token
    if (error.code === "unauthenticated" && !req.header.get("X-Retry")) {
      // Prevent concurrent refresh attempts
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = refreshAccessToken();
      }

      try {
        await refreshPromise;
        isRefreshing = false;
        refreshPromise = null;

        // Retry with new token
        const newToken = getAccessToken();
        if (newToken) {
          req.header.set("Authorization", `Bearer ${newToken}`);
          req.header.set("X-Retry", "true");
          return await next(req);
        }
      } catch (refreshError) {
        isRefreshing = false;
        refreshPromise = null;
        // Refresh failed - redirect to login
        window.location.href = "/auth";
        throw refreshError;
      }
    }
    throw error;
  }
};

async function refreshAccessToken(): Promise<void> {
  const response = await fetch("/api/v1/auth/refresh", {
    method: "POST",
    credentials: "include", // Include cookies
  });

  if (!response.ok) {
    throw new Error("Failed to refresh token");
  }

  const data = await response.json();
  setAccessToken(data.accessToken, new Date(data.expiresAt));
}

const transport = createConnectTransport({
  baseUrl: window.location.origin,
  useBinaryFormat: true,
  interceptors: [authInterceptor],
});

// ... rest of exports ...
```

**Step 3: Commit**

```bash
git add web/src/connect.ts web/src/auth-state.ts
git commit -m "feat(web): add auth interceptor for token refresh"
```

---

### Task 16: Update user store for new auth flow

**Files:**
- Modify: `web/src/store/user.ts`

**Step 1: Update initialUserStore**

```typescript
import { setAccessToken, clearAccessToken } from "@/auth-state";

export const initialUserStore = async () => {
  try {
    // Step 1: Authenticate and get current user
    const response = await authServiceClient.getCurrentSession({});
    const { user: currentUser, accessToken, accessTokenExpiresAt } = response;

    if (!currentUser) {
      clearAccessToken();
      userStore.state.setPartial({
        currentUser: undefined,
        userGeneralSetting: undefined,
        userMapByName: {},
      });
      return;
    }

    // Store access token in memory
    if (accessToken) {
      setAccessToken(accessToken, accessTokenExpiresAt?.toDate());
    }

    // Step 2: Set current user in store
    userStore.state.setPartial({
      currentUser: currentUser.name,
      userMapByName: {
        [currentUser.name]: currentUser,
      },
    });

    // Step 3: Fetch user settings and stats
    await Promise.all([userStore.fetchUserSettings(), userStore.fetchUserStats()]);
  } catch (error) {
    console.error("Failed to initialize user store:", error);
    clearAccessToken();
  }
};
```

**Step 2: Add logout handler**

```typescript
export const logout = async () => {
  try {
    await authServiceClient.deleteSession({});
  } finally {
    clearAccessToken();
    userStore.state.setPartial({
      currentUser: undefined,
      userGeneralSetting: undefined,
      userMapByName: {},
    });
  }
};
```

**Step 3: Commit**

```bash
git add web/src/store/user.ts
git commit -m "feat(web): update user store for new auth flow"
```

---

## Phase 7: Add RefreshToken to Public Methods

### Task 17: Update acl_config.go

**Files:**
- Modify: `server/router/api/v1/acl_config.go`

**Step 1: Add RefreshToken to public methods**

```go
var PublicMethods = map[string]struct{}{
  // Auth Service
  "/memos.api.v1.AuthService/CreateSession":     {},
  "/memos.api.v1.AuthService/GetCurrentSession": {},
  "/memos.api.v1.AuthService/RefreshToken":      {}, // NEW - needs refresh token cookie only

  // ... rest unchanged ...
}
```

**Step 2: Commit**

```bash
git add server/router/api/v1/acl_config.go
git commit -m "feat(api): add RefreshToken to public methods"
```

---

## Phase 8: Testing

### Task 18: Add tests for new auth flow

**Files:**
- Create: `server/auth/token_test.go`
- Create: `server/router/api/v1/test/auth_test.go`

**Step 1: Add token generation tests**

Create `server/auth/token_test.go`:

```go
package auth

import (
  "testing"
  "time"

  "github.com/stretchr/testify/assert"
  "github.com/stretchr/testify/require"
)

func TestGenerateAccessTokenV2(t *testing.T) {
  secret := []byte("test-secret")

  token, expiresAt, err := GenerateAccessTokenV2(1, "testuser", "USER", "ACTIVE", secret)
  require.NoError(t, err)
  assert.NotEmpty(t, token)
  assert.True(t, expiresAt.After(time.Now()))
  assert.True(t, expiresAt.Before(time.Now().Add(AccessTokenDuration+time.Minute)))
}

func TestParseAccessTokenV2(t *testing.T) {
  secret := []byte("test-secret")

  token, _, err := GenerateAccessTokenV2(1, "testuser", "USER", "ACTIVE", secret)
  require.NoError(t, err)

  claims, err := ParseAccessTokenV2(token, secret)
  require.NoError(t, err)
  assert.Equal(t, "1", claims.Subject)
  assert.Equal(t, "testuser", claims.Username)
  assert.Equal(t, "USER", claims.Role)
  assert.Equal(t, "access", claims.Type)
}

func TestGenerateRefreshToken(t *testing.T) {
  secret := []byte("test-secret")

  token, expiresAt, err := GenerateRefreshToken(1, "token-id-123", secret)
  require.NoError(t, err)
  assert.NotEmpty(t, token)
  assert.True(t, expiresAt.After(time.Now().Add(29*24*time.Hour)))
}

func TestParseRefreshToken(t *testing.T) {
  secret := []byte("test-secret")

  token, _, err := GenerateRefreshToken(1, "token-id-123", secret)
  require.NoError(t, err)

  claims, err := ParseRefreshToken(token, secret)
  require.NoError(t, err)
  assert.Equal(t, "1", claims.Subject)
  assert.Equal(t, "token-id-123", claims.TokenID)
  assert.Equal(t, "refresh", claims.Type)
}

func TestHashPersonalAccessToken(t *testing.T) {
  token := "memos_pat_abc123"
  hash := HashPersonalAccessToken(token)
  assert.NotEmpty(t, hash)
  assert.Len(t, hash, 64) // SHA-256 hex is 64 chars

  // Same input should produce same hash
  hash2 := HashPersonalAccessToken(token)
  assert.Equal(t, hash, hash2)
}
```

**Step 2: Run tests**

Run: `go test ./server/auth/... -v`

**Step 3: Commit**

```bash
git add server/auth/token_test.go
git commit -m "test(auth): add tests for new token types"
```

---

## Phase 9: Update store conversion for new proto types

### Task 19: Update user_setting.go conversions

**Files:**
- Modify: `store/user_setting.go`

**Step 1: Add conversion cases for new types**

Update `convertUserSettingFromRaw`:

```go
case storepb.UserSetting_REFRESH_TOKENS:
  refreshTokensUserSetting := &storepb.RefreshTokensUserSetting{}
  if err := protojsonUnmarshaler.Unmarshal([]byte(raw.Value), refreshTokensUserSetting); err != nil {
    return nil, err
  }
  userSetting.Value = &storepb.UserSetting_RefreshTokens{RefreshTokens: refreshTokensUserSetting}
case storepb.UserSetting_PERSONAL_ACCESS_TOKENS:
  patsUserSetting := &storepb.PersonalAccessTokensUserSetting{}
  if err := protojsonUnmarshaler.Unmarshal([]byte(raw.Value), patsUserSetting); err != nil {
    return nil, err
  }
  userSetting.Value = &storepb.UserSetting_PersonalAccessTokens{PersonalAccessTokens: patsUserSetting}
```

Update `convertUserSettingToRaw`:

```go
case storepb.UserSetting_REFRESH_TOKENS:
  refreshTokensUserSetting := userSetting.GetRefreshTokens()
  value, err := protojson.Marshal(refreshTokensUserSetting)
  if err != nil {
    return nil, err
  }
  raw.Value = string(value)
case storepb.UserSetting_PERSONAL_ACCESS_TOKENS:
  patsUserSetting := userSetting.GetPersonalAccessTokens()
  value, err := protojson.Marshal(patsUserSetting)
  if err != nil {
    return nil, err
  }
  raw.Value = string(value)
```

**Step 2: Commit**

```bash
git add store/user_setting.go
git commit -m "feat(store): add conversion for RefreshTokens and PersonalAccessTokens"
```

---

## Final: Run Full Test Suite

### Task 20: Verify all tests pass

**Step 1: Run backend tests**

```bash
go test ./... -v
```

**Step 2: Run frontend build**

```bash
cd web && pnpm build
```

**Step 3: Run linters**

```bash
golangci-lint run
cd web && pnpm lint
```

**Step 4: Final commit**

```bash
git add .
git commit -m "chore: complete auth redesign implementation"
```

---

## Summary

This plan implements:
1. **Access Token V2**: Short-lived JWT (15 min) with user claims, stateless validation
2. **Refresh Token**: Long-lived JWT (30 days) stored in user_setting, validated against DB
3. **Personal Access Token**: Long-lived tokens for API/scripts, SHA-256 hashed storage
4. **Frontend Integration**: ConnectRPC interceptor for automatic token refresh
5. **Backward Compatibility**: Legacy session and JWT auth still work during migration

**Total Tasks: 20**
**Estimated Files Modified: ~20**
