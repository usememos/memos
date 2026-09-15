# Store tests

## How to test store with MySQL?

1. Create a database in your MySQL server.
2. Run the following command with two environment variables set:

```go
DRIVER=mysql DSN=root@/memos_test go test -v ./test/store/...
```

- `DRIVER` should be set to `mysql`.
- `DSN` should be set to the DSN of your MySQL server.

## How to test store with Cloudflare D1?

`DRIVER=d1` runs the suite against an in-process emulation of the D1 REST API
(`store/db/d1/d1test`), so no Cloudflare account is needed:

```go
DRIVER=d1 go test -v ./store/test/...
```

To run against a real database instead, set `D1_DSN` to
`d1://<account_id>/<database_id>?token=<api_token>`. That database is shared
by every test and is not reset between them, so run one test at a time with
`-run` and expect to clean it up afterwards.
