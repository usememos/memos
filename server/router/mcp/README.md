# MCP Server

This package implements a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server embedded in the Memos HTTP process. It exposes memo operations as MCP tools, making Memos accessible to any MCP-compatible AI client (Claude Desktop, Cursor, Zed, etc.).

## Endpoint

```
POST /mcp   (tool calls, initialize)
GET  /mcp   (optional SSE stream for server-to-client messages)
```

Transport: [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) (single endpoint, MCP spec 2025-03-26).

## Authentication

Every request must include a Personal Access Token (PAT):

```
Authorization: Bearer <your-PAT>
```

PATs are long-lived tokens created in Settings → My Account → Access Tokens. Short-lived JWT session tokens are not accepted. Requests without a valid PAT receive `HTTP 401`.

## Tools

All tools are scoped to the authenticated user's memos.

| Tool | Description | Required params | Optional params |
|---|---|---|---|
| `list_memos` | List memos | — | `page_size` (int, max 100), `filter` (CEL expression) |
| `get_memo` | Get a single memo | `name` | — |
| `search_memos` | Full-text search | `query` | — |
| `create_memo` | Create a memo | `content` | `visibility` |
| `update_memo` | Update content or visibility | `name` | `content`, `visibility` |
| `delete_memo` | Delete a memo | `name` | — |

**`name`** is the memo resource name, e.g. `memos/abc123`.

**`visibility`** accepts `PRIVATE` (default), `PROTECTED`, or `PUBLIC`.

**`filter`** accepts CEL expressions supported by the memo filter engine, e.g.:
- `content.contains("keyword")`
- `visibility == "PUBLIC"`
- `has_task_list`

## Connecting Claude Code

```bash
claude mcp add --transport http memos http://localhost:5230/mcp \
  --header "Authorization: Bearer <your-PAT>"
```

Use `--scope user` to make it available across all projects:

```bash
claude mcp add --scope user --transport http memos http://localhost:5230/mcp \
  --header "Authorization: Bearer <your-PAT>"
```

## Package Structure

| File | Responsibility |
|---|---|
| `mcp.go` | `MCPService` struct, constructor, route registration |
| `auth_middleware.go` | Echo middleware — validates Bearer token, sets user ID in context |
| `tools_memo.go` | Tool registration and six memo tool handlers |
