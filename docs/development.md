# Development

Memos is built with a curated tech stack. It is optimized for developer experience and is very easy to start working on the code:

1. It has no external dependency.
2. It requires zero config.
3. 1 command to start backend and 1 command to start frontend, both with live reload support.

## Prerequisites

- [Go](https://golang.org/doc/install)
- [Air](https://github.com/cosmtrek/air#installation) for backend live reload
- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation)

## Steps

1. Pull the source code

   ```bash
   git clone https://github.com/usememos/memos
   ```

2. Start backend server with [`air`](https://github.com/cosmtrek/air) (with live reload)

   ```bash
   air -c scripts/.air.toml
   ```

3. Install frontend dependencies and generate TypeScript code from protobuf

   ```
   cd web && pnpm i && pnpm type-gen
   ```

4. Start the dev server of frontend

   ```bash
   cd web && pnpm dev
   ```

Memos should now be running at [http://localhost:3001](http://localhost:3001) and change either frontend or backend code would trigger live reload.
