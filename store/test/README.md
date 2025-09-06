# Store tests

## How to test store with MySQL?

1. Create a database in your MySQL server.
2. Run the following command with two environment variables set:

```bash
DRIVER=mysql DSN=root@/memos_test go test -v ./store/test/...
```

- `DRIVER` should be set to `mysql`.
- `DSN` should be set to the DSN of your MySQL server.

## How to test distributed caching with Redis?

1. Start a Redis server locally or use a remote Redis instance.
2. Run the following command with the Redis URL environment variable set:

```bash
REDIS_URL=redis://localhost:6379 go test -v ./store/test/ -run "Cache|Redis|Hybrid|DistributedSession"
```

- `REDIS_URL` should be set to your Redis server URL.
- If `REDIS_URL` is not set, Redis-dependent tests will be skipped.

## Available cache tests

- `TestCacheInterface` - Tests cache interface compliance (works without Redis)
- `TestCacheStatus` - Tests cache status reporting (works without Redis) 
- `TestRedisCache` - Tests Redis cache implementation (requires Redis)
- `TestHybridCache` - Tests hybrid local+Redis cache (requires Redis)
- `TestDistributedSessionStore` - Tests session sharing across multiple store instances (requires Redis)
- `TestDistributedSessionPerformanceStore` - Performance tests for distributed sessions (requires Redis)

## Running comprehensive cache tests

Use the provided script for full cache testing:

```bash
./test_cache_comprehensive.sh
```

This script will automatically detect Redis availability and run appropriate tests.
