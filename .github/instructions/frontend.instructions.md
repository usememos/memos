## Frontend Copilot Instructions

### Tech Stack

- **Framework:** React + Vite
- **UI:** shadcn/ui + Tailwind CSS v4
- **State Management:** MobX
- **Package Manager:** pnpm
- **Color System:** Only use colors defined in `web/src/style.css`
- **Component Imports:** Only via `pnpm dlx shadcn@latest add [component]`

---

### 💡 Guidelines

✅ **Allowed:**

- Use **shadcn/ui components only** (e.g., `Button`, `Input`, `Dialog`)
- Use **Tailwind utility classes** for layout, spacing, typography
- Use **Tailwind `bg-[var(--color-name)]`**, `text-[var(--color-name)]` referencing `web/src/style.css` for colors
- Use **MobX for state management** (`observable`, `computed`, `action`, `useLocalObservable`)
- Use **functional React components** with hooks
- Use **Tailwind v4 utility classes** for responsive layouts

❌ **Not Allowed:**

- Do not import or use **other component libraries** (e.g., Material UI, Ant Design, Chakra)
- Do not use **fixed color utilities** (e.g., `bg-gray-200`, `text-blue-500`)
- Do not use **className strings with hardcoded color values**
- Do not use **inline styles for colors**

---

### 🎨 Color Usage

**All colors must be referenced from `web/src/style.css`**, for example:

```tsx
<div className="bg-[var(--bg-secondary)] text-[var(--text-primary)] p-4">...</div>
```

**Do not use** `bg-gray-200`, `text-gray-900`, etc.

---

### 📦 Adding UI Components

To add new UI components, always use:

```bash
pnpm dlx shadcn@latest add [component]
```

Examples:

```bash
pnpm dlx shadcn@latest add button
```

---

### 🛠️ File Structure

- `web/src/components/` → shared React components
- `web/src/pages/` → route-based pages
- `web/src/store/` → MobX stores
- `web/src/style.css` → color variables and global styles
- `web/src/hooks/` → reusable hooks

---

### 🧩 Component Development Conventions

1. **Functional Components + Hooks:**

   - Use `useState`, `useEffect`.
   - Always type props with `React.FC<Props>` or explicit `Props` interfaces.

2. **State:**

   - Use **MobX** for shared state across components.
   - Use local component state only for purely local UI state.

3. **Styling:**

   - Use Tailwind utility classes, referencing colors from `style.css`.
   - For complex styles, extend via Tailwind plugin if needed.

4. **Shadcn Integration:**

   - Import components only after adding via `pnpm dlx shadcn@latest add [component]`.
   - Do not modify the component source unless necessary; prefer composition and theming.
