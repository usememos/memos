# Memo Resource APIs

## Bind Resource to Memo

```
POST /api/v1/memo/:memoId/resource
```

**Request Body**

```json
{
  "resourceId": 123
}
```

**Response**

```
true
```

**Status Codes**

- 200: OK
- 400: Invalid request
- 401: Unauthorized
- 404: Memo/Resource not found
- 500: Internal server error

## Get Memo Resources

```
GET /api/v1/memo/:memoId/resource
```

**Response**

```json
[
  {
    "id": 123,
    "filename": "example.png"
    // other resource fields
  }
]
```

**Status Codes**

- 200: OK
- 500: Internal server error

## Unbind Resource from Memo

```
DELETE /api/v1/memo/:memoId/resource/:resourceId
```

**Status Codes**

- 200: OK
- 401: Unauthorized
- 404: Memo/Resource not found
- 500: Internal server error
