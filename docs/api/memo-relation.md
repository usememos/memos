# Memo Relation APIs

## Create Memo Relation

```
POST /api/v1/memo/:memoId/relation
```

**Request Body**

```json
{
  "relatedMemoId": 456,
  "type": "REFERENCE"
}
```

**Response**

```json
{
  "memoId": 123,
  "relatedMemoId": 456,
  "type": "REFERENCE"
}
```

**Status Codes**

- 200: OK
- 400: Invalid request
- 500: Internal server error

## Get Memo Relations

```
GET /api/v1/memo/:memoId/relation
```

**Response**

```json
[
  {
    "memoId": 123,
    "relatedMemoId": 456,
    "type": "REFERENCE"
  }
]
```

**Status Codes**

- 200: OK
- 500: Internal server error

## Delete Memo Relation

```
DELETE /api/v1/memo/:memoId/relation/:relatedMemoId/type/:relationType
```

**Status Codes**

- 200: Deleted
- 400: Invalid request
- 500: Internal server error
