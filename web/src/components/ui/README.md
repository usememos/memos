# UI Kit (`components/ui`)

shadcn/ui primitives ("new-york" style, zinc base, lucide icons, CSS variables).
This folder is the **single source of styling truth**. Read this before adding a
component or reaching for `className` on a kit component.

## The one rule: use props, not `className`

> Moved to [`.archcore/ui/component-conventions.rule.md`](../../../../.archcore/ui/component-conventions.rule.md).

> Color tokens: moved to [`.archcore/ui/color-conventions.rule.md`](../../../../.archcore/ui/color-conventions.rule.md).

## Variant catalog

> Moved to [`.archcore/ui/component-conventions.rule.md`](../../../../.archcore/ui/component-conventions.rule.md).

Kept here because `.archcore/` does not carry these rows in full:

| Component | variant | size / shape | Notes |
| --- | --- | --- | --- |
| **Tabs** | — | variant: **segmented** · **underline** | Local component (not upstream shadcn). Context-based `Tabs`/`TabsList`/`TabsTrigger`, no Radix. `underline` relies on the consumer's own divider. |
| **DropdownMenu** | item: default · destructive | — | Local destructive item variant + a sub-menu hover-delay hook. |

## Layering (z-index tiers)

> Moved to [`.archcore/ui/color-conventions.rule.md`](../../../../.archcore/ui/color-conventions.rule.md).
