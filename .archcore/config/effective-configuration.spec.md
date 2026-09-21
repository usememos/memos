---
title: "Effective configuration resolution"
status: draft
tags:
  - "config"
---

## Purpose & Scope
Status: Implemented.

This spec defines how the server publishes deployment configuration as one runtime snapshot and resolves effective configuration from it and from stored configuration. Stored configuration lives in the `idp` and `system_setting` tables. Effective configuration is what APIs, authentication, and background services use: deployment configuration shadows stored configuration with the same stable key (identity-provider UID or instance-setting key).
Normative for the `Store` facade: @store/deployment_config.go, @store/idp.go, @store/instance_setting.go, and the startup order in @cmd/memos/main.go and @store/migrator.go. Dependents: API services in @server/api/v1/, SSO sign-in, and background runners that read instance settings.
Out of scope: file discovery, file content validation, and mutation guards.

## Surface
- Snapshot: `deploymentConfiguration`, maps keyed by provider UID and setting key, held by `Store` (@store/store.go).
- Effective reads: `ListIdentityProviders`, `GetIdentityProvider`, `ListInstanceSettings`, `GetInstanceSetting`, and the typed getters such as `GetInstanceGeneralSetting` and `GetInstanceAccessSetting`.
- Stored (raw) reads: `listStoredIdentityProviders`, `GetStoredIdentityProvider`, `getRawInstanceSetting`, `GetStoredInstanceSetting`.
- Source checks: `IsIdentityProviderDeploymentConfigured`, `IsInstanceSettingDeploymentConfigured`.
- Instance-setting cache: `instanceSettingCache`, default TTL ten minutes (@store/store.go).
- Startup order: migrate the database → apply the demo seed when enabled → create a missing `ACCESS` row from legacy instance-URL behavior → read matching files → decode and validate every resource → validate affected cross-resource invariants → publish one snapshot → construct HTTP and background services → accept requests.

## Normative Behavior
1. WHEN the server starts, it MUST load deployment configuration after migration and demo seeding and before service construction.
2. The loader MUST NOT write to the database while loading.
3. The loader MUST read stored configuration through raw access only, avoiding recursive effective resolution.
4. WHEN every matching file validates, the loader MUST publish one snapshot for the process lifetime.
5. WHILE the process runs, the store MUST ignore file changes made after startup.
6. The store MUST keep canonical snapshot messages private.
7. WHEN an effective getter returns a snapshot resource, the store MUST return a deep clone.
8. The store MUST apply read-time defaults and redaction only to clones.
9. The store MUST NOT insert canonical snapshot messages into the instance-setting TTL cache.
10. WHEN identity providers are listed, the store MUST return the union of stored and file-backed providers by UID.
11. WHEN a file-backed provider has the UID of a stored provider, the store MUST return the file-backed provider in place of it.
12. The store MUST return stored providers in database insertion order, with a shadowing provider at the shadowed position.
13. The store MUST append providers that exist only in deployment configuration, in UID order.
14. WHEN a lookup filters identity providers by database ID, the store MUST return stored providers only.
15. Authentication MUST resolve the same effective provider collection as list and get operations.
16. WHEN an effective instance setting is read, the store MUST check the snapshot before the database cache.
17. WHEN a file declares a setting key, the store MUST shadow the complete `system_setting` row with that key.
18. The store MUST resolve other setting groups from stored values and existing application defaults.
19. WHILE no file declares `ACCESS`, the `ACCESS` getter MUST read the database directly, bypassing the ten-minute cache.
20. WHEN a mutation service handles a request, it MUST check the snapshot source before loading a raw row.

## Constraints & Invariants
- Invariant: callers never obtain a mutable map or message owned by the snapshot. Generated protobuf messages are mutable pointers, so the store enforces this with clones; one request, runner, defaulting helper, or redaction path cannot change what another goroutine observes.
- Invariant: a cached database value never overwrites the snapshot.
- Invariant: publication is atomic because the snapshot is published only after complete validation. No cross-database transaction is required, because loading performs no database writes.
- A file-backed identity provider has no database ID and MUST NOT be passed to a driver update or delete operation.
- Removing a file and restarting reveals any shadowed stored provider or setting; it neither restores file values nor deletes stored rows.
- The `ACCESS` cache bypass makes a change from public to private visible to every replica on its next policy check, instead of leaving a stale public authorization decision in another process.
- The demo seed writes `MEMO_RELATED` but not `GENERAL`, so a `GENERAL` file supplies the complete effective settings without putting authentication policy in demo data.
- Operators moving a stored provider to a file SHOULD keep the same UID, so existing user-identity links keep working.
- Operators SHOULD remove or update the shadowed stored provider before removing the file, when the old stored configuration should not reappear.

## Failure Behavior
1. IF any matching file fails validation, THEN the loader MUST NOT publish a snapshot.
2. IF any matching file fails validation, THEN the server MUST fail startup.
3. IF reading stored configuration fails during loading, THEN the server MUST fail startup.
4. IF no `ACCESS` setting is stored or its mode is unspecified, THEN the `ACCESS` getter MUST return `INSTANCE_ACCESS_MODE_PRIVATE`.

## Conformance
An implementation is conformant when it satisfies behaviors 1–20, holds the invariants above, and follows the failure rules. Tests in @store/deployment_config_test.go cover runtime-only providers, shadowing without stored changes, defensive clones, atomic publication, and stored ordering.

Given stored providers `a` then `b`, and files for `b` and `c`
When identity providers are listed
Then the order is stored `a`, file-backed `b`, file-backed `c`
