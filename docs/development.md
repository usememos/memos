# Development

Memos is built with a curated tech stack. It is optimized for developer experience and is very easy to start working on the code:

1. It has no external dependency.
2. It requires zero config.
3. 1 command to start backend and 1 command to start frontend, both with live reload support.

## Prerequisites

- [Go](https://golang.org/doc/install)
- [Air](https://github.com/cosmtrek/air#installation) for backend live reload
- [Buf](https://buf.build/docs/installation)
- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation)

## Steps

1. pull source code

   ```bash
   git clone https://github.com/usememos/memos
   ```

2. start backend using air(with live reload)

   ```bash
   air -c scripts/.air.toml
   ```

3. generate TypeScript code from protobuf with `buf`

   ```
   cd proto && buf generate
   ```

4. start frontend dev server

   ```bash
   cd web && pnpm i && pnpm dev
   ```

Memos should now be running at [http://localhost:3001](http://localhost:3001) and change either frontend or backend code would trigger live reload.
