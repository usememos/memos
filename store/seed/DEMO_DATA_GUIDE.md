# Demo Data Guide

This document describes the demo data used to showcase Memos features in demo mode.

## Overview

The demo data includes **6 carefully selected memos** that showcase the key features of Memos without overwhelming new users.

## Demo User

- **Username**: `demo`
- **Password**: `secret` (default password)
- **Role**: ADMIN
- **Nickname**: Demo User

## Demo Memos (6 total)

### 1. Welcome Message (Pinned) ⭐
**Tags**: `#welcome` `#getting-started`

A welcoming introduction that highlights key features of Memos.

**Features showcased**:
- H1/H2 headings
- Bold text
- Bullet lists
- Horizontal rules
- Multiple tags

---

### 2. Task Management Demo
**Tags**: `#todo/work`

Realistic weekly task list with three categories showing different work contexts.

**Features showcased**:
- Task lists (checkboxes)
- Hierarchical tags (`#todo/work`)
- Mixed completed/incomplete tasks
- H2/H3 headings
- Multiple sections

---

### 3. Code Snippet Reference
**Tags**: `#dev/git`

Practical Git commands reference with code examples in multiple languages.

**Features showcased**:
- Multiple code blocks
- Bash syntax highlighting
- JavaScript syntax highlighting
- Inline code
- Hierarchical tags (`#dev/git`)

---

### 4. Meeting Notes with Table
**Tags**: `#meeting/standup`

Professional meeting notes with structured data in a table format.

**Features showcased**:
- Markdown tables
- Bold text
- Bullet lists
- Hierarchical tags (`#meeting/standup`)
- Organized sections

---

### 5. Quick Idea
**Tags**: `#ideas/apps` `#ai`

Short-form idea capture demonstrating quick note-taking.

**Features showcased**:
- Brief memo format
- Emoji usage
- Multiple tags
- Bold text

---

### 6. Sponsor Message (Pinned) ⭐
**Tags**: `#sponsor`

Sponsor message with image and external link.

**Features showcased**:
- External links
- Markdown image
- Pinned memo
- Clean formatting

---

## Additional Features

### Memo Relations
- Memo #3 (Git commands) references Memo #1 (Welcome)

### Reactions
Multiple memos have reactions to showcase the reaction system:
- Welcome: 🎉 👍
- Tasks: ✅
- Quick idea: 💡
- Sponsor: 🚀

### System Settings
Configured with popular reactions:
- 👍 💛 🔥 👏 😂 👌 🚀 👀 🤔 🤡 ❓ +1 🎉 💡 ✅

## Coverage of Markdown Features

| Feature | Demo Memos |
|---------|-----------|
| Headings (H1-H3) | 1, 2, 3, 4 |
| Bold text | All |
| Links | 6 |
| Images | 6 |
| Code blocks | 3 |
| Inline code | 3 |
| Task lists | 2 |
| Bullet lists | 1, 2, 4 |
| Tables | 4 |
| Horizontal rules | 1 |
| Hierarchical tags | All |
| Emoji | 5 |
| Pinned memos | 1, 6 |

## Tag Hierarchy

The demo showcases hierarchical tag organization:

```
#welcome
#getting-started
#todo
  └─ #todo/work
#dev
  └─ #dev/git
#meeting
  └─ #meeting/standup
#ideas
  └─ #ideas/apps
#ai
#sponsor
```

## Use Cases Demonstrated

1. **Getting Started**: Welcome message with feature overview
2. **Work Management**: Tasks and meetings
3. **Developer Tools**: Code snippet references
4. **Quick Capture**: Brief idea notes
5. **Sponsor Content**: Product showcases with images

## Design Principles

1. **Quality over Quantity**: 6 focused memos instead of overwhelming users
2. **Realistic Content**: All memos use realistic, relatable scenarios
3. **Diverse Use Cases**: Covers professional, technical, and creative contexts
4. **Visual Appeal**: Clean formatting with emojis used naturally
5. **Feature Coverage**: Core features demonstrated without redundancy
6. **Hierarchical Organization**: Shows multi-level tag organization
7. **Clean and Scannable**: Easy to browse and understand at a glance

## Testing Demo Mode

To run with demo data:

```bash
# Start in demo mode
go run ./cmd/memos --demo --port 8081

# Or use the binary
./memos --demo

# Demo database location
./build/memos_demo.db
```

Login with:
- Username: `demo`
- Password: `secret`

## Updating Demo Data

1. Edit `store/seed/sqlite/01__dump.sql`
2. Delete `build/memos_demo.db` if it exists
3. Restart server in demo mode
4. New demo data will be loaded automatically

## Notes

- All memos are set to PUBLIC visibility
- **Two memos are pinned**: Welcome (#1) and Sponsor (#6)
- User has ADMIN role to showcase all features
- Reactions are distributed across memos
- One memo relation demonstrates linking
- Content is optimized for the compact markdown styles
- Demo size is intentionally small (6 memos) to avoid overwhelming new users
