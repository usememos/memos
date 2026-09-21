---
title: "Provisioning file discovery"
status: draft
tags:
  - "config"
---

## Purpose & Scope
Status: Implemented.

This spec defines how the Memos server finds deployment-configuration files at startup: which directory entries it reads, warns about, or ignores, what each accepted file must be, and what startup logs report. Deployment configuration is configuration decoded from matching files during process startup; it is never written to the database.
Normative for `LoadDeploymentConfiguration` and `LoadDeploymentConfigurationDir` in @store/deployment_config.go, called from @cmd/memos/main.go. Dependents: operators who mount secret volumes, including Kubernetes Secret volumes, and the effective-configuration resolution that consumes the loaded resources.
Out of scope: the message fields and per-type validation of each file, snapshot publication and merging with stored configuration, and cross-resource authentication validation.

## Surface
- Directory: `/etc/secrets` (`DefaultDeploymentConfigurationDir` in @store/deployment_config.go); direct children only.
- Supported filename patterns. Matching is case-sensitive, the extension is lowercase `.json`, and `<label>` matches `[a-z0-9]+(?:-[a-z0-9]+)*`:
  - `memos-idp-<label>.json` holds one `memos.store.IdentityProvider` (@proto/store/idp.proto); its stable key is `uid`.
  - `memos-instance-setting-<label>.json` holds one `memos.store.InstanceSetting` (@proto/store/instance_setting.proto); its stable key is `key`.
- Legacy identity-provider names: any `memos-idp-*.json` accepted by the original database-writing bootstrap (`isIdentityProviderDeploymentFilename`).
- Canonical filenames: identity provider with UID `primary-sso` → `memos-idp-primary-sso.json`; `ACCESS` → `memos-instance-setting-access.json`; `GENERAL` → `memos-instance-setting-general.json`; `STORAGE` → `memos-instance-setting-storage.json`; `MEMO_RELATED` → `memos-instance-setting-memo-related.json`; `NOTIFICATION` → `memos-instance-setting-notification.json`; `AI` → `memos-instance-setting-ai.json`.
- Per-file size limit: 1 MiB (`maxDeploymentConfigurationSize`).
- Startup summary log: `loaded deployment configuration` with `identityProviders` and `instanceSettings` counts.

## Normative Behavior
1. WHEN the server starts, the loader MUST scan only the direct children of `/etc/secrets`.
2. The loader MUST NOT recurse into subdirectories.
3. The loader MUST NOT create, modify, or delete any entry in the directory.
4. The loader MUST read only entries whose names match a supported filename pattern.
5. WHEN a name matches `memos-idp-*.json` but its label is not lowercase kebab case, the loader MUST still load the file.
6. WHEN the loader loads a legacy identity-provider filename, it MUST log a deprecation warning.
7. WHEN a name begins with `memos-` and matches no supported pattern, the loader MUST log a warning.
8. WHEN a name does not begin with `memos-`, the loader MUST ignore the entry without a log line.
9. The loader MUST read matching files in lexical filename order.
10. The loader MUST take resource identity from the `uid` or `key` inside the message, not from the filename label.
11. The loader MUST accept a regular file or a platform-managed symlink that resolves to a regular file.
12. WHEN loading succeeds, the loader MUST log matched counts by resource type without file contents.

## Constraints & Invariants
- Each matching file MUST be a valid protobuf JSON representation of the expected message.
- Each matching file MUST NOT contain unknown fields.
- Each matching file MUST NOT exceed 1 MiB.
- Each matching file MUST contain exactly one resource.
- A matching file MAY contain plaintext secrets, because the directory is treated as sensitive.
- File order has no configuration semantics; lexical order exists only to make diagnostics deterministic.
- Invariant: renaming a file changes neither account links nor effective resource identity, because the label is descriptive, not authoritative.
- New files SHOULD use the canonical lowercase-kebab-case pattern.
- Labels SHOULD mirror the resource key, for operator readability.
- Invariant: the unrelated platform secrets the directory may also hold are never read.
- An SSO-only deployment MUST mount both an identity-provider file and `memos-instance-setting-general.json` with `disallowPasswordAuth` enabled. The public demo seed (@store/seed/sqlite/01__dump.sql) holds no authentication policy, so the demo does not supply it.
- The loader validates and publishes these two resources together during startup.
- WHEN first-time SSO users should be created automatically, the deployment MUST keep `disallowUserRegistration` disabled (@server/api/v1/auth_service_sso.go).

## Failure Behavior
1. IF `/etc/secrets` does not exist, THEN the loader MUST publish an empty deployment configuration and let startup continue.
2. IF the directory is readable and holds no matching file, THEN the loader MUST treat the scan as a no-op.
3. IF the directory is unreadable, THEN the server MUST fail startup.
4. IF a matching file is unreadable, THEN the server MUST fail startup and name the file.
5. IF a matching file does not resolve to a regular file, THEN the server MUST fail startup.
6. IF a matching file exceeds 1 MiB, THEN the server MUST fail startup.
7. IF protobuf JSON decoding fails, THEN the loader MUST report the unknown field name or a generic decode message, never field values.

## Conformance
An implementation is conformant when it satisfies behaviors 1–12, holds the constraints above, and fails startup per the failure rules. Tests in @store/deployment_config_test.go cover unrelated files, a missing directory, legacy filenames, symlinks, the size bound, and redacted decode errors.

Given `/etc/secrets` holds `memos-idp-primary-sso.json`, `memos-backup.txt`, and `db-password`
When the server starts
Then the provider loads, `memos-backup.txt` produces a warning, and `db-password` is ignored silently
