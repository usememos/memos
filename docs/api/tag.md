# Tag APIs

## Create Tag

```
POST /api/v1/tag
```

**Request Body**

```json
{
  "name": "python"
}
```

**Response**

```
"python"
```

**Status Codes**

- 200: Created
- 400: Invalid request
- 500: Internal server error

## Get Tag List

```
GET /api/v1/tag
```

**Response**

```json
["python", "golang", "javascript"]
```

**Status Codes**

- 200: OK
- 401: Unauthorized
- 500: Internal server error

## Suggest Tags

```
GET /api/v1/tag/suggestion
```

**Response**

```json
["django", "flask", "numpy"]
```

**Status Codes**

- 200: OK
- 401: Unauthorized
- 500: Internal server error

## Delete Tag

```
POST /api/v1/tag/delete
```

**Request Body**

```json
{
  "name": "outdated_tag"
}
```

**Status Codes**

- 200: Deleted
- 400: Invalid request
- 401: Unauthorized
- 500: Internal server error
