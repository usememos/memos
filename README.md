# Memos (Cloudflare Workers fork)

A personal fork of [usememos/memos](https://github.com/usememos/memos), migrated from the original
self-hosted Go server to **Cloudflare Workers**, **D1**, **R2**, and **Cloudflare Access** for auth.

- `worker/` — the TypeScript backend (Connect-RPC over Workers, D1, R2). See [worker/README.md](worker/README.md)
  for architecture, local development, and deployment.
- `web/` — the React/Vite frontend (mostly unchanged from upstream; talks to the Worker over Connect).
- `proto/` — shared protobuf contracts, code-generated into both `worker/src/gen/` and `web/src/types/proto/`.

There is no Go code, no Docker image, and no self-hosted binary in this repo anymore — see
[worker/README.md](worker/README.md) for the full deployment guide.

## License

Memos is open-source software licensed under the [MIT License](LICENSE).
