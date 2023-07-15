# Resource APIs

## Upload Resource

### Upload File

```
POST /api/v1/resource/blob
```

**Request Form**

- `file`: Upload file

**Response**

```json
{
  "id": 123,
  "filename": "example.png"
  // other fields
}
```

**Status Codes**

- 200: OK
- 400: Invalid request
- 401: Unauthorized
- 413: File too large
- 500: Internal server error

### Create Resource

```
POST /api/v1/resource
```

**Request Body**

```json
{
  "filename": "example.png",
  "externalLink": "https://example.com/image.png"
}
```

**Response**

Same as **Upload File**

**Status Codes**

- 200: OK
- 400: Invalid request
- 401: Unauthorized
- 500: Internal server error

## Get Resource List

```
GET /api/v1/resource
```

**Parameters**

- `limit` (optional): Limit number of results
- `offset` (optional): Offset of first result

**Response**

```json
[
  {
    "id": 123,
    "filename": "example.png"
    // other fields
  },
  {
    "id": 456,
    "filename": "doc.pdf"
    // other fields
  }
]
```

**Status Codes**

- 200: OK
- 401: Unauthorized
- 500: Internal server error

## Update Resource

```
PATCH /api/v1/resource/:resourceId
```

**Request Body**

```json
{
  "filename": "new_name.png"
}
```

**Response**

Same as **Get Resource List**

**Status Codes**

- 200: OK
- 400: Invalid request
- 401: Unauthorized
- 404: Not found
- 500: Internal server error

## Delete Resource

```
DELETE /api/v1/resource/:resourceId
```

**Status Codes**

- 200: Deleted
- 401: Unauthorized
- 404: Not found
- 500: Internal server error
