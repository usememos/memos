# MemoEditor Architecture

## Overview

MemoEditor uses a three-layer architecture for better separation of concerns and testability.

## Architecture

```
┌─────────────────────────────────────────┐
│   Presentation Layer (Components)       │
│   - EditorToolbar, EditorContent, etc.  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│   State Layer (Reducer + Context)       │
│   - state/, useEditorContext()          │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│   Service Layer (Business Logic)        │
│   - services/ (pure functions)          │
└─────────────────────────────────────────┘
```

## Directory Structure

```
MemoEditor/
├── state/                  # State management (reducer, actions, context)
├── services/              # Business logic (pure functions)
├── components/            # UI components
├── hooks/                 # React hooks (utilities)
├── Editor/               # Core editor component
├── Toolbar/              # Toolbar components
├── constants.ts
└── types/
```

## Key Concepts

### State Management

Uses `useReducer` + Context for predictable state transitions. All state changes go through action creators.

### Services

Pure TypeScript functions containing business logic. No React hooks, easy to test.

### Components

Thin presentation components that dispatch actions and render UI.

## Usage

```typescript
import MemoEditor from "@/components/MemoEditor";

<MemoEditor
  memoName="memos/123"
  onConfirm={(name) => console.log('Saved:', name)}
  onCancel={() => console.log('Cancelled')}
/>
```

## Testing

Services are pure functions - easy to unit test without React.

```typescript
const state = mockEditorState();
const result = await memoService.save(state, { memoName: 'memos/123' });
```
