# Authentication APIs

## Sign In

```
POST /api/v1/auth/signin
```

**Request Body**

```json
{
  "username": "john",
  "password": "password123"
}
```

**Response**

```json
{
  "id": 123,
  "username": "john",
  "nickname": "John"
  // other user fields
}
```

**Status Codes**

- 200: Sign in success
- 400: Invalid request
- 401: Incorrect credentials
- 403: User banned
- 500: Internal server error

## SSO Sign In

```
POST /api/v1/auth/signin/sso
```

**Request Body**

```json
{
  "identityProviderId": 123,
  "code": "abc123",
  "redirectUri": "https://example.com/callback"
}
```

**Response**

Same as **Sign In**

**Status Codes**

- 200: Success
- 400: Invalid request
- 401: Authentication failed
- 403: User banned
- 404: Identity provider not found
- 500: Internal server error

## Sign Up

```
POST /api/v1/auth/signup
```

**Request Body**

```json
{
  "username": "mary",
  "password": "password456"
}
```

**Response**

Same as **Sign In**

**Status Codes**

- 200: Sign up success
- 400: Invalid request
- 401: Sign up disabled
- 500: Internal server error

## Sign Out

```
POST /api/v1/auth/signout
```

**Response**

```
true
```

**Status Codes**

- 200: Success
- 500: Internal server error
