# Memos Project - AI Assistant Instructions

## Frontend Refactoring Goal

**PRIORITY**: Replace all MUI Joy UI (@mui/joy) and @usememos/mui components with shadcn/ui + Tailwind CSS v4

## Key Rules

1. **Replace all MUI components** with shadcn/ui + Tailwind v4
2. **Never modify generated shadcn/ui files** from `pnpm dlx shadcn@latest add`
3. **Use https://tweakcn.com/ for custom variants** when standard components need customization

## Setup Commands

```bash
# Initialize shadcn/ui
pnpm dlx shadcn@latest init

# Add components
pnpm dlx shadcn@latest add [component]
```

## Migration Pattern

```typescript
// OLD
import { Button, Card, Input } from "@mui/joy";

// NEW
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
```

## When Suggesting Changes

- Include `pnpm dlx shadcn@latest add [component]` commands
- Use Tailwind classes for styling
- Mention https://tweakcn.com/ for custom variants
- Preserve TypeScript types and accessibility

## Target Files

Files containing `@mui/joy` or `@usememos/mui` imports
