# Memo APIs

## Create Memo

```
POST /api/v1/memo
```

**Request Body**

```json
{
  "content": "Memo content",
  "visibility": "PUBLIC",
  "resourceIdList": [123, 456],
  "relationList": [{ "relatedMemoId": 789, "type": "REFERENCE" }]
}
```

**Response**

```json
{
  "id": 1234,
  "content": "Memo content",
  "visibility": "PUBLIC"
  // other fields
}
```

**Status Codes**

- 200: Created
- 400: Invalid request
- 401: Unauthorized
- 403: Forbidden to create public memo
- 500: Internal server error

## Get Memo List

```
GET /api/v1/memo
```

**Parameters**

- `creatorId` (optional): Filter by creator ID
- `visibility` (optional): Filter visibility, `PUBLIC`, `PROTECTED` or `PRIVATE`
- `rowStatus` (optional): Filter Status, `ARCHIVE`, `NORMAL`, Default `NORMAL`
- `pinned` (optional): Filter pinned memo, `true` or `false`
- `tag` (optional): Filter memo with tag
- `content` (optional): Search in content
- `limit` (optional): Limit number of results
- `offset` (optional): Offset of first result

**Response**

```json
[
  {
    "id": 1234,
    "content": "Memo 1"
    // other fields
  },
  {
    "id": 5678,
    "content": "Memo 2"
    // other fields
  }
]
```

## Get Memo By ID

```
GET /api/v1/memo/:memoId
```

**Response**

```json
{
  "id": 1234,
  "content": "Memo content"
  // other fields
}
```

**Status Codes**

- 200: Success
- 403: Forbidden for private memo
- 404: Not found
- 500: Internal server error

## Update Memo

```
PATCH /api/v1/memo/:memoId
```

**Request Body**

```json
{
  "content": "Updated content",
  "visibility": "PRIVATE"
}
```

**Response**

Same as **Get Memo By ID**

**Status Codes**

- 200: Updated
- 400: Invalid request
- 401: Unauthorized
- 403: Forbidden
- 404: Not found
- 500: Internal server error

## Delete Memo

```
DELETE /api/v1/memo/:memoId
```

**Status Codes**

- 200: Deleted
- 401: Unauthorized
- 403: Forbidden
- 404: Not found
- 500: Internal server error
