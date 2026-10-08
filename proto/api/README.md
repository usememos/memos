# Memos API Design

This API design should follow the guidelines and best practices outlined in the [Google API Improvement Proposals (AIPs)](https://google.aip.dev/).

The package is `memos.api`. It carries no version marker; breaking changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## File Layout

1. The service, then shared top-level types used by more than one group.
2. One block per resource group, in service order: the resource message, then the group's request/response messages in
   RPC order, then helper messages used only by that group.

Within a group, order RPCs `List`, `Get`, `BatchGet`, `Create`, `Update`, `Delete`, `BatchDelete`, then custom methods.

## Messages

- Resources: `name` first, timestamps (`create_time`, `update_time`, others) last.
- Requests: `parent` or `name`, the payload, `update_mask`, then `page_size`, `page_token`, `filter`, `order_by`, and
  other options.
- Responses: items, then `next_page_token`.
- Fields first, then nested enums, then nested messages.
- Number fields 1..N in declaration order. A new field takes the next number; never reuse or renumber a released field
  outside a recorded breaking change.
- `google.api.resource` lists `type`, `pattern`, `singular`, `plural`; omit `name_field: "name"`.

## Comments

- Every service, RPC, message, enum and field has a comment. RPC comments start with the RPC name.
- Fields with `google.api.field_behavior` start with the matching prefix: `Identifier.`, `Required.`, `Optional.`,
  `Output only.`, or `Input only.`. Fields without the annotation get no prefix.
- Resource-name fields end with a `Format: memos/{memo}` line.
- Describe what the server does, not what it might do.
