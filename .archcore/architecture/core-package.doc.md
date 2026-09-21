---
title: "Core package responsibilities"
status: draft
tags:
  - "architecture"
---

## Overview

@core holds business rules that do not depend on HTTP or SQL. A package lands here when it needs several store calls, or a decision, that more than one transport applies the same way. `core` imports `store`, `provider`, `markdown`, `filter`, `proto/gen`, and `internal`, and does not import `server` or `cmd`.

## Content

| Package | Owns |
| --- | --- |
| @core/access | Who may read a memo, given viewer, Space membership, and share links. |
| @core/notification | Building and dispatching inbox and email notifications. |
| @core/memopayload | Rebuilding a memo's derived payload from its Markdown. |
| @core/memoexport | The Memos Export Format container and records used for export and import. |

New resource-specific rules extracted from @server/api/v1 go here, one package per resource.

## Examples
Not recorded in the source.
