# Development

Memos is built with a curated tech stack. It is optimized for developer experience and is very easy to start working on the code:

1. It has no external dependency.
2. It requires zero config.
3. 1 command to start backend and 1 command to start frontend, both with live reload support.

## Tech Stack

| Frontend                                 | Backend                           |
| ---------------------------------------- | --------------------------------- |
| [React](https://react.dev/)              | [Go](https://go.dev/)             |
| [Tailwind CSS](https://tailwindcss.com/) | [SQLite](https://www.sqlite.org/) |
| [Vite](https://vitejs.dev/)              |                                   |
| [pnpm](https://pnpm.io/)                 |                                   |

## Prerequisites

- [Go](https://golang.org/doc/install)
- [Air](https://github.com/cosmtrek/air#installation) for backend live reload
- [Node.js](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation)

## Steps

(Using PowerShell)

1. pull source code

   ```powershell
   git clone https://github.com/usememos/memos
   # or
   gh repo clone usememos/memos
   ```

2. cd into the project root directory

   ```powershell
   cd memos
   ```

3. start backend using air (with live reload)

   ```powershell
   air -c .\scripts\.air-windows.toml
   ```

4. start frontend dev server

   ```powershell
   cd web; pnpm i; pnpm dev
   ```

Memos should now be running at [http://localhost:3001](http://localhost:3001) and changing either frontend or backend code would trigger live reload.

## Building

Frontend must be built before backend. The built frontend must be placed in the backend ./server/dist directory. Otherwise, you will get a "No frontend embeded" error.

### Frontend

```powershell
Move-Item "./server/dist" "./server/dist.bak"
cd web; pnpm i --frozen-lockfile; pnpm build; cd ..;
Move-Item "./web/dist" "./server/" -Force
```

### Backend

```powershell
go build -o ./build/memos.exe ./main.go
```

## ❕ Notes

- Start development servers easier by running the provided `start.ps1` script.
  This will start both backend and frontend in detached PowerShell windows:

  ```powershell
  .\scripts\start.ps1
  ```

- Produce a local build easier using the provided `build.ps1` script to build both frontend and backend:

  ```powershell
  .\scripts\build.ps1
  ```

  This will produce a memos.exe file in the ./build directory.
