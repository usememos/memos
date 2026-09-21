---
title: "Deployment configuration model"
status: draft
tags:
  - "config"
---

## Context
Status: Implemented.

Operators need to supply OAuth2 client secrets, SMTP passwords, S3 credentials, and AI API keys without committing them to seed SQL or command-line arguments. An earlier database-writing bootstrap scanned `/etc/secrets` for `memos-idp-*.json` and reconciled the providers into the `idp` table, so every client secret gained a second, database-owned copy. Memos replaced it with a process-local loader in @store/deployment_config.go, called from @cmd/memos/main.go before any service is constructed. The model follows Mastodon, which reads deployment configuration from environment variables or a dotenv file at process initialization ([Mastodon configuration](https://docs.joinmastodon.org/admin/config/), [OmniAuth initializer](https://github.com/mastodon/mastodon/blob/main/config/initializers/3_omniauth.rb)) and copies none of it into an administrator-editable database resource.

## Decision
Adopt Mastodon's deployment-configuration model: each Memos server process decodes OAuth2 `memos.store.IdentityProvider` and `memos.store.InstanceSetting` protobuf-JSON files from `/etc/secrets` into one validated, immutable, process-local snapshot that shadows stored configuration by stable key for the process lifetime and is never written to the database.

## Decision Details
Stored configuration is the existing `idp` and `system_setting` tables. Deployment configuration is what the process decodes from matching files at startup. Effective configuration is what APIs, authentication, and background services use: deployment configuration shadows stored configuration with the same stable key, the identity-provider UID or the instance-setting key.
The first supported resources are OAuth2 identity providers and the instance settings for access policy, general policy, storage, memo behavior, notifications, and AI providers.
Loading runs after database migration and demo seeding. The complete file set is validated before any part of it is exposed, and the snapshot is published before HTTP or background services start. A changed file takes effect only after a process restart.
Each file holds exactly one existing generated `memos.store` message (@proto/store/idp.proto, @proto/store/instance_setting.proto). The design adds no resource envelope, state file, ownership table, or second persistent copy of a secret; the process holds decoded secrets only in its private runtime snapshot (@store/store.go).
Stored resources stay in the database beneath a file that declares the same key. UI and API mutations cannot change an actively file-backed resource. Removing the file and restarting removes the override and neither deletes nor modifies the stored resource.
This is deployment configuration, not resource reconciliation: adoption, import, unmanage, drift, prune, and Terraform state do not apply.
Secret values stay out of logs, API responses, caches that expose values, and any additional persistence. The administrator password sign-in path stays available when password sign-in is disabled for regular users.
Outside the first version: partial field ownership within an instance-setting group, and writing UI changes back into mounted files.
Other references surveyed: [GitLab OpenID Connect](https://docs.gitlab.com/administration/auth/oidc/), [Keycloak startup import](https://www.keycloak.org/server/importExport), [Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/). No per-reference verdict is recorded.

## Alternatives Considered
- **Environment variables or a dotenv file, as in Mastodon:** rejected because the configured resources would need a large collection of environment variables; mounted JSON files in the existing store-message format replace them.
- **Secrets in seed SQL or command-line arguments:** rejected because the goal is to accept secrets without committing them to seed SQL or command-line arguments.
- **Import into the database, as the earlier bootstrap did:** rejected because it turns deployment configuration into database-owned application state and leaves a second persistent copy of each secret.
- **Terraform-style resource reconciliation:** rejected because it needs ownership state, such as a `provisioning_resource` table or provisioning columns, and deletes or rewrites stored resources to match a desired resource graph, while this model leaves stored configuration untouched.
- **Multiple configuration sources with precedence rules:** deferred because the first version supports one source, the mounted files.
- **File watching or reload without restart:** deferred because the first version loads the snapshot once per process.

## Consequences
### Positive
- Deployment secrets are never inserted into `idp` or `system_setting`, and no ownership metadata or state file exists.
- Database-backed UI configuration keeps working for every key that no file supplies.
- Removing a file and restarting restores the stored resource unchanged; no stored row is deleted.
- An invalid file set is never partly exposed, because publication follows complete validation.
- Deployment configuration is authoritative for the process lifetime; an API write cannot appear to change an effective file-backed resource.
### Tradeoffs
- Every configuration change needs a process restart.
- Decoded secrets stay in process memory for the process lifetime.
- Administrators cannot edit a file-backed resource through the UI or API; they change the mounted file.
- A shadowed stored resource persists and becomes effective again after its file is removed.
- One source only: a file replaces its complete instance-setting group, with no per-field ownership and no precedence between sources.
