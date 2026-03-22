# MCP Server

This package implements a [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server embedded in the Memos HTTP process. It exposes memo operations as MCP tools, making Memos accessible to any MCP-compatible AI client (Claude Desktop, Cursor, Zed, etc.).

## Endpoint

```
POST /mcp   (tool calls, initialize)
GET  /mcp   (optional SSE stream for server-to-client messages)
```

Transport: [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) (single endpoint, MCP spec 2025-03-26).

## Capabilities

The server advertises the following MCP capabilities:

| Capability | Enabled | Details |
|---|---|---|
| Tools | Yes | List changed notifications supported |
| Resources | Yes | Subscribe + list changed supported |
| Prompts | Yes | List changed notifications supported |
| Logging | Yes | Structured log events |

## Authentication

Every request must include a Personal Access Token (PAT):

```
Authorization: Bearer <your-PAT>
```

PATs are long-lived tokens created in Settings → My Account → Access Tokens. Short-lived JWT session tokens are also accepted. Requests without a valid token receive `HTTP 401`.

## Tools

### Memo Tools

| Tool | Description | Required params | Optional params |
|---|---|---|---|
| `list_memos` | List memos | — | `page_size`, `page`, `state`, `order_by_pinned`, `filter` (CEL) |
| `get_memo` | Get a single memo | `name` | — |
| `search_memos` | Full-text search | `query` | — |
| `create_memo` | Create a memo | `content` | `visibility` |
| `update_memo` | Update a memo | `name` | `content`, `visibility`, `pinned`, `state` |
| `delete_memo` | Delete a memo | `name` | — |
| `list_memo_comments` | List comments | `name` | — |
| `create_memo_comment` | Add a comment | `name`, `content` | — |

### Tag Tools

| Tool | Description | Required params |
|---|---|---|
| `list_tags` | List all tags with counts | — |

### Attachment Tools

| Tool | Description | Required params | Optional params |
|---|---|---|---|
| `list_attachments` | List user's attachments | — | `page_size`, `page`, `memo` |
| `get_attachment` | Get attachment metadata | `name` | — |
| `delete_attachment` | Delete an attachment | `name` | — |
| `link_attachment_to_memo` | Link attachment to memo | `name`, `memo` | — |

### Relation Tools

| Tool | Description | Required params | Optional params |
|---|---|---|---|
| `list_memo_relations` | List relations (refs + comments) | `name` | `type` |
| `create_memo_relation` | Create a reference relation | `name`, `related_memo` | — |
| `delete_memo_relation` | Delete a reference relation | `name`, `related_memo` | — |

### Reaction Tools

| Tool | Description | Required params |
|---|---|---|
| `list_reactions` | List reactions on a memo | `name` |
| `upsert_reaction` | Add a reaction emoji | `name`, `reaction_type` |
| `delete_reaction` | Remove a reaction | `id` |

## Resources

| URI Template | Description | MIME Type |
|---|---|---|
| `memo://memos/{uid}` | Memo content with YAML frontmatter | `text/markdown` |

## Prompts

| Prompt | Description | Arguments |
|---|---|---|
| `capture` | Quick-save a thought as a memo | `content` (required), `tags`, `visibility` |
| `review` | Search and summarize memos on a topic | `topic` (required) |
| `daily_digest` | Summarize recent memo activity | `days` |
| `organize` | Suggest tags/relations for unorganized memos | `scope` |

## Resource Names

- Memos: `memos/<uid>` (e.g. `memos/abc123`)
- Attachments: `attachments/<uid>` (e.g. `attachments/def456`)

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
| `mcp.go` | `MCPService` struct, constructor, route registration, auth middleware |
| `tools_memo.go` | Memo CRUD tools + helpers (JSON types, visibility/access checks) |
| `tools_tag.go` | Tag listing tool |
| `tools_attachment.go` | Attachment listing, metadata, deletion, linking tools |
| `tools_relation.go` | Memo relation (reference) tools |
| `tools_reaction.go` | Reaction (emoji) tools |
| `resources_memo.go` | Memo resource template handler |
| `prompts.go` | Prompt handlers (capture, review, daily_digest, organize) |
