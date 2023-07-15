# User APIs

## Create User

```
POST /api/v1/user
```

**Request Body**

```json
{
  "username": "john",
  "role": "USER",
  "email": "john@example.com",
  "nickname": "John",
  "password": "password123"
}
```

**Response**

```json
{
  "id": 123,
  "username": "john",
  "role": "USER",
  "email": "john@example.com",
  "nickname": "John",
  "avatarUrl": "",
  "createdTs": 1596647800,
  "updatedTs": 1596647800
}
```

**Status Codes**

- 200: Success
- 400: Validation error
- 401: Unauthorized
- 403: Forbidden to create host user
- 500: Internal server error

## Get User List

```
GET /api/v1/user
```

**Response**

```json
[
  {
    "id": 123,
    "username": "john",
    "role": "USER"
    // other fields
  },
  {
    "id": 456,
    "username": "mary",
    "role": "ADMIN"
    // other fields
  }
]
```

**Status Codes**

- 200: Success
- 500: Internal server error

## Get User By ID

```
GET /api/v1/user/:id
```

**Response**

```json
{
  "id": 123,
  "username": "john",
  "role": "USER"
  // other fields
}
```

**Status Codes**

- 200: Success
- 404: Not found
- 500: Internal server error

## Update User

```
PATCH /api/v1/user/:id
```

**Request Body**

```json
{
  "username": "johnny",
  "email": "johnny@example.com",
  "nickname": "Johnny",
  "avatarUrl": "https://avatars.example.com/u=123"
}
```

**Response**

```json
{
  "id": 123,
  "username": "johnny",
  "role": "USER",
  "email": "johnny@example.com",
  "nickname": "Johnny",
  "avatarUrl": "https://avatars.example.com/u=123",
  "createdTs": 1596647800,
  "updatedTs": 1596647900
}
```

**Status Codes**

- 200: Success
- 400: Validation error
- 403: Forbidden
- 404: Not found
- 500: Internal server error

## Delete User

```
DELETE /api/v1/user/:id
```

**Status Codes**

- 200: Success
- 403: Forbidden
- 404: Not found
- 500: Internal server error

## Get Current User

```
GET /api/v1/user/me
```

**Response**

Same as **Get User By ID**

**Status Codes**

- 200: Success
- 401: Unauthorized
- 500: Internal server error
