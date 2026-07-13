# Configuration Provisioning

Status: Implemented

## Summary

Memos should follow Mastodon's deployment-configuration model: configuration supplied by the deployment is loaded directly into each server process and
remains authoritative for that process lifetime. It is not imported into the database and is not tracked as database-owned application state.

The first supported file-backed configuration resources are:

- OAuth2 identity providers.
- Instance settings for general policy, storage, memo behavior, notifications, and AI providers.

Memos scans `/etc/secrets` after database migration and demo seeding, validates every matching file, builds one immutable configuration snapshot, and
publishes that snapshot before HTTP or background services start. Applying a changed file requires a process restart.

Every resource file contains exactly one existing `memos.store` protobuf message encoded as protobuf JSON. No resource envelope, state file, ownership
table, or second persistent copy of a secret is introduced. The process necessarily holds decoded secrets in its private runtime snapshot.

## Design model

Mastodon reads external authentication and other deployment configuration from environment variables or a dotenv file during process initialization. It
does not copy that configuration into an administrator-editable database resource or maintain Terraform-style ownership state.

Memos should use the same lifecycle while adapting the input format to its existing generated store messages:

- Mounted JSON files replace a large collection of environment variables.
- File-backed resources exist in the effective runtime configuration.
- Stored resources continue to exist in the database but are shadowed when a file declares the same stable key.
- UI and API mutations cannot change an actively file-backed resource.
- Removing a file and restarting removes the runtime override; it does not delete or modify the stored resource.

This is deployment configuration, not resource reconciliation. Terms such as adoption, import, unmanage, drift, prune, and Terraform state do not apply.

## Goals

- Accept secrets through mounted files without committing them to seed SQL or command-line arguments.
- Keep each file equal to one generated store protobuf message.
- Load and validate the complete file set before exposing any of it.
- Make deployment configuration authoritative for the lifetime of the process.
- Preserve database-backed UI configuration for keys not supplied by files.
- Prevent API writes from appearing to change an effective file-backed resource.
- Keep secret values out of logs, API responses, caches that expose values, and additional persistence.
- Preserve the administrator password sign-in path when password sign-in is disabled for regular users.

## Non-goals

- Persist file contents or file ownership metadata in the database.
- Add a `provisioning_resource` table or provisioning columns to existing tables.
- Reconcile database state to match a desired resource graph.
- Delete database resources when files disappear.
- Support multiple configuration sources with precedence rules in the first version.
- Write UI changes back into mounted files.
- Watch files or reload configuration without restarting in the first version.
- Support partial field ownership within an instance-setting group.

## Terminology

**Stored configuration**
: Configuration stored in the existing `idp` and `system_setting` database tables.

**Deployment configuration**
: Configuration decoded from matching files during process startup.

**Effective configuration**
: The configuration used by APIs, authentication, and background services. Deployment configuration shadows stored configuration with the same stable key.

**Stable key**
: The identity-provider UID or instance-setting key used to merge deployment and stored configuration.

## File discovery

Memos scans direct children of `/etc/secrets`. The directory may contain unrelated platform secrets; only supported filename patterns are read. Memos does
not recurse into subdirectories and does not create, modify, or delete anything in the directory.

| Filename pattern | Protobuf message | Stable key |
| --- | --- | --- |
| `memos-idp-<label>.json` | `memos.store.IdentityProvider` | `uid` |
| `memos-instance-setting-<label>.json` | `memos.store.InstanceSetting` | `key` |

`<label>` uses lowercase kebab case and must match `[a-z0-9]+(?:-[a-z0-9]+)*`. Matching is case-sensitive and the extension is lowercase `.json`.
For upgrade compatibility, identity-provider filenames accepted by the original bootstrap (`memos-idp-*.json`) continue to load when the label is not
lowercase kebab case, but startup logs a deprecation warning. New files should always use the canonical convention.

Recommended labels mirror the resource key for operator readability:

| Resource | Canonical filename |
| --- | --- |
| Identity provider with UID `primary-sso` | `memos-idp-primary-sso.json` |
| `GENERAL` | `memos-instance-setting-general.json` |
| `STORAGE` | `memos-instance-setting-storage.json` |
| `MEMO_RELATED` | `memos-instance-setting-memo-related.json` |
| `NOTIFICATION` | `memos-instance-setting-notification.json` |
| `AI` | `memos-instance-setting-ai.json` |

The filename label remains descriptive rather than authoritative. The `uid` or `key` inside the message is the resource identity, so renaming a file does
not change account links or effective resource identity. Files are read in lexical order only to produce deterministic diagnostics; ordering has no
configuration semantics.

Each matching file:

- Must be a valid protobuf JSON representation of the expected message.
- Must not contain unknown fields.
- Must not exceed 1 MiB.
- Must contain exactly one resource.
- May contain plaintext secrets because the containing directory is treated as sensitive.
- May be a regular file or a platform-managed symlink that resolves to a regular file, as used by Kubernetes Secret volumes.

A missing directory or a readable directory without matching files is a normal no-op. An unreadable directory or matching file is a startup error. Startup
logs include matched counts by resource type so a misspelled filename is visible without logging file contents. A direct child beginning with `memos-` but
not matching a supported pattern produces a warning; unrelated filenames are silently ignored.

### SSO-only deployments

An SSO-only deployment mounts both an identity-provider file and `memos-instance-setting-general.json` with `disallowPasswordAuth` enabled. These resources
are validated and published together during startup. The public demo seed does not contain authentication policy, so both files must be mounted to enable
SSO-only behavior. Keep `disallowUserRegistration` disabled when first-time SSO users should be created automatically.

## Identity-provider files

An identity-provider file contains exactly one `memos.store.IdentityProvider`. The database-generated `id` must be omitted. `uid` is required and is the
stable key.

Example `/etc/secrets/memos-idp-primary-sso.json`:

```json
{
  "uid": "primary-sso",
  "name": "Company SSO",
  "type": "OAUTH2",
  "identifierFilter": "",
  "config": {
    "oauth2Config": {
      "clientId": "client-id",
      "clientSecret": "client-secret",
      "authUrl": "https://idp.example.com/oauth/authorize",
      "tokenUrl": "https://idp.example.com/oauth/token",
      "userInfoUrl": "https://idp.example.com/oauth/userinfo",
      "scopes": ["openid", "profile", "email"],
      "fieldMapping": {
        "identifier": "sub",
        "displayName": "name",
        "email": "email",
        "avatarUrl": "picture"
      }
    }
  }
}
```

Initial validation supports only OAuth2 providers and requires:

- A valid, nonempty UID and display name.
- Client ID and client secret.
- Authorization, token, and user-info URLs.
- At least one scope, with no empty scope entries.
- A field-mapping object with a nonempty identifier field.

Duplicate UIDs across files are rejected.

User identity links already use the provider UID as their stable provider value. A file-backed provider therefore does not need a database-generated IdP ID
to preserve account links or complete SSO sign-in.

## Instance-setting files

An instance-setting file contains exactly one `memos.store.InstanceSetting`. `key` is required and is the stable key. The populated `oneof` must match the
key.

Example `/etc/secrets/memos-instance-setting-general.json`:

```json
{
  "key": "GENERAL",
  "generalSetting": {
    "disallowUserRegistration": false,
    "disallowPasswordAuth": true,
    "additionalScript": "",
    "additionalStyle": "",
    "weekStartDayOffset": 1,
    "disallowChangeUsername": false,
    "disallowChangeNickname": false,
    "customProfile": {
      "title": "Company Memos",
      "description": "Internal notes",
      "logoUrl": "https://example.com/logo.png"
    }
  }
}
```

Example `/etc/secrets/memos-instance-setting-notification.json`:

```json
{
  "key": "NOTIFICATION",
  "notificationSetting": {
    "email": {
      "enabled": true,
      "smtpHost": "smtp.example.com",
      "smtpPort": 587,
      "smtpUsername": "memos",
      "smtpPassword": "smtp-secret",
      "fromEmail": "memos@example.com",
      "fromName": "Memos",
      "replyTo": "support@example.com",
      "useTls": true,
      "useSsl": false
    }
  }
}
```

Supported keys:

| Key | Deployment use |
| --- | --- |
| `GENERAL` | Registration, authentication, branding, scripts, styles, and user-profile policy |
| `STORAGE` | Attachment storage type, limits, paths, and S3 credentials |
| `MEMO_RELATED` | Memo limits, editing behavior, and reactions |
| `NOTIFICATION` | SMTP transport and credentials |
| `AI` | AI providers, API keys, and transcription defaults |

Rejected keys:

- `BASIC` contains the instance secret key and database schema version. Replacing the secret key invalidates sessions, while replacing the schema version
  interferes with database migration state.
- `TAGS` is retained for backward compatibility; active tag metadata is stored per user.

Only one file may declare a given setting key.

### Complete-group replacement

An instance-setting group is the smallest deployment-configured unit. A file replaces the complete effective group. A scalar omitted from protobuf JSON is
stored in the decoded message as its protobuf default; omission does not preserve a field from the database value.

Some existing setting getters apply application defaults after decoding zero values. For example, STORAGE defaults to local storage, a 30 MiB upload limit,
and `assets/{timestamp}_{uuid}_{filename}` when the corresponding decoded fields are unspecified. The effective behavior is therefore the decoded file plus
the same read-time defaults used for database-backed configuration.

Empty secret fields in a file mean empty values; they never mean "preserve the database secret." Credential-preservation behavior used by UI updates does
not apply to deployment configuration.

### AI normalization

AI deployment configuration uses deterministic, self-contained normalization rather than the UI update path:

- Every provider requires an explicit stable `id`; the loader never generates one.
- Every provider requires a title, a supported provider type, and an API key.
- An empty OpenAI endpoint becomes `https://api.openai.com/v1`.
- An empty Gemini endpoint becomes `https://generativelanguage.googleapis.com/v1beta`.
- Duplicate provider IDs are rejected.
- A transcription provider ID must reference a provider in the same effective AI setting.
- Model, language, and prompt use the same length limits as API-managed settings.
- No provider, API key, or transcription value is copied from the shadowed database setting.

## Configuration format compatibility

Using store protobuf JSON makes the selected messages a supported deployment-configuration interface even though the messages remain internal to the
application. For every provisionable message, Memos must preserve:

- Existing protobuf JSON field names.
- Existing enum names and meanings.
- Stable resource-key and `oneof` mappings.
- Previously valid omissions for fields that have defaults.

New optional fields and enum values may be added. A provisionable field may be deprecated, but its existing JSON spelling must continue to decode for the
supported upgrade window. Field names must not be reused with a different meaning. New validation should not invalidate an existing safe configuration
without an upgrade note and a documented replacement.

Unknown fields remain startup errors because this catches misspellings and configuration written for a newer, incompatible Memos version. Compatibility
tests should keep representative JSON fixtures from earlier releases and decode them with the current loader.

## Runtime configuration snapshot

The loader builds an immutable snapshot containing maps keyed by provider UID and setting key. It does not mutate the database while loading. The `Store`
owns this snapshot so all existing consumers resolve configuration through one boundary.

Startup follows this sequence:

```text
Initialize or migrate database
  -> apply demo seed when enabled
  -> read all matching deployment-configuration files
  -> decode and validate every resource
  -> validate affected cross-resource invariants
  -> publish one immutable runtime snapshot
  -> construct HTTP and background services
  -> accept requests
```

If any matching file is invalid, no snapshot is published and startup fails. Atomicity comes from publishing the snapshot only after complete validation;
no cross-database transaction abstraction is required because deployment configuration performs no database writes.

The snapshot is loaded once. Files changed after startup have no effect until the process restarts.

### Immutability and copy semantics

Generated protobuf messages are mutable pointers, so immutability must be enforced rather than assumed:

- Canonical snapshot messages remain private to the `Store`.
- Effective getters return deep clones, using `proto.Clone`, rather than canonical pointers.
- Read-time defaults and redaction are applied only to clones.
- Canonical snapshot messages are never inserted into the existing instance-setting TTL cache.
- Callers cannot obtain a mutable map or message owned by the snapshot.

This prevents one request, background runner, defaulting helper, or redaction path from changing configuration observed by another goroutine.

### Effective and stored access

The store facade has an explicit separation between effective reads and stored-resource access:

- Normal list/get operations used by authentication, APIs, and background services return effective configuration.
- Internal raw list/get operations read only the database and are used by migration, snapshot planning, and permitted mutation paths.
- Mutation services check the snapshot source before loading a raw database row.
- A file-backed IdP has no database ID and must never be passed to a driver update or delete operation.
- The loader reads stored configuration through raw access before publishing the snapshot, avoiding recursive effective resolution.

## Effective configuration resolution

### Identity providers

List and get operations return the union of stored and file-backed providers by UID:

- A file-backed provider shadows a stored provider with the same UID.
- Stored providers with other UIDs remain available.
- Authentication resolves the same effective provider collection.
- Removing the file and restarting reveals any stored provider that had been shadowed; it does not restore values from the file.
- Stored providers retain their database insertion order, and a file-backed provider that shadows one occupies the same position. Providers that exist only
  in deployment configuration are appended in UID order, keeping existing API and sign-in ordering stable while remaining deterministic.

Operators migrating an existing stored provider to a file should keep the same UID so existing user-identity links continue to work. They should remove or
update the shadowed stored provider before later removing the file if they do not want the old database configuration to reappear.

### Instance settings

Every effective instance-setting getter checks the runtime snapshot before its database cache:

- A file-backed group completely shadows the `system_setting` row with the same key.
- Other setting groups continue to use stored values and existing application defaults.
- The runtime snapshot must never be overwritten by a cached database value.
- Removing a file and restarting returns the group to its stored database value.

The demo seed writes `MEMO_RELATED` but does not write `GENERAL`. Loading deployment configuration after seeding supplies the complete effective General
settings without embedding deployment authentication policy in demo data.

## Validation and authentication safety

All file-local validation runs before snapshot publication. Relationships between file-backed resources are validated against the resulting effective
configuration when the desired files affect that relationship.

At minimum, validation rejects:

- A file-backed `GENERAL` setting that disables password authentication for regular users when the resulting effective configuration has no identity
  provider.
- An instance-setting key whose populated `oneof` does not match the key.
- S3 storage without the required endpoint, bucket, region, or credentials.
- Enabled email delivery without the required SMTP host, port, or sender.
- Duplicate AI provider IDs.
- Transcription referencing an AI provider ID absent from the effective AI setting.
- Duplicate stable keys across files.

An unrelated file must not turn an existing database condition into a new startup failure. For example, a STORAGE-only file does not fail startup merely
because the database already disables regular-user password sign-in while containing no IdP; Memos logs that existing condition as a warning. A file that
configures GENERAL or an IdP evaluates the authentication invariant against the resulting effective state.

The administrator password path remains available regardless of `disallowPasswordAuth`. Runtime mutations reject transitions from a safe authentication
state to one where password sign-in is disabled for regular users without an effective IdP. An unrelated edit may preserve an already-existing legacy
violation so an upgrade does not make the complete `GENERAL` group uneditable; the administrator can resolve that state by enabling password sign-in or
configuring an IdP. Deleting the last effective IdP from a previously safe state remains rejected.

The validation and database mutation must be one serializable store operation. In particular, updating `GENERAL` and deleting an IdP cannot use separate
check-then-write calls, because concurrent requests could each validate an old safe state and together produce an unsafe state. The narrow runtime mutation
operation:

1. Starts a serializable database transaction.
2. Reads the stored `GENERAL` setting and stored IdPs inside that transaction.
3. Combines them with the immutable file snapshot and the proposed mutation.
4. Validates the resulting effective authentication state.
5. Applies the stored-resource mutation and commits.
6. Retries serialization conflicts a bounded number of times.

This transaction is required for runtime authentication-policy safety, not for loading deployment files. It adds no table or schema migration. Each
database driver must provide equivalent transaction semantics for this narrow operation.

## API behavior

The API operates on effective resources for reads and stored resources for permitted writes.

Mutation behavior:

- Creating a stored IdP with a UID reserved by a file-backed provider returns `codes.FailedPrecondition`.
- Updating or deleting a file-backed IdP returns `codes.FailedPrecondition`.
- Updating a file-backed instance-setting group returns `codes.FailedPrecondition`.
- The instance-setting guard runs before validation or future field-mask application, so every masked update to a file-backed group is rejected.
- Mutations of unshadowed stored configuration continue normally, subject to authentication safety invariants.
- API responses continue to redact client secrets, SMTP passwords, S3 secrets, and AI API keys.

No API operation writes to the mounted files. Test operations that do not change stored configuration, such as testing the effective SMTP configuration,
remain available.

## Frontend behavior

The frontend does not receive configuration-source metadata. It presents the normal mutation controls and reports the API's `FailedPrecondition` error when
an administrator attempts to create, update, or delete a deployment-managed resource. The API remains the sole authority for mutation enforcement.

## Security

- Treat `/etc/secrets` and every matching file as sensitive plaintext.
- Recommend owner-only or application-group-readable filesystem permissions.
- Never log file contents, decoded messages, before/after values, or secret fields.
- Redact secrets from validation errors and startup summaries.
- Do not persist deployment secrets in `idp`, `system_setting`, a state file, or ownership metadata.
- Fail startup on an invalid or unreadable matching file rather than publishing partial configuration.
- Keep the immutable snapshot process-local and expose only redacted API representations.

## Multiple server replicas

Every replica independently loads deployment configuration at startup, as Mastodon processes independently load environment configuration. All replicas in
one deployment must mount identical files.

A rolling deployment can temporarily run old and new configuration generations at the same time. Memos does not attempt distributed reconciliation or
cache invalidation for this process-local configuration. Deployments changing authentication or storage configuration should use a rollout strategy that
does not route traffic to replicas with different file generations, and readiness must be reported only after the new snapshot validates successfully.

Because file-backed settings bypass the database setting cache, a replica cannot replace a deployment value with a stale cached database value.

## Database and migration impact

This design requires no database schema changes and no migrations:

- File-backed IdPs are not inserted into `idp`.
- File-backed settings are not inserted into `system_setting`.
- Existing user-identity links remain database-backed and continue to reference provider UIDs.
- Existing stored configuration remains untouched beneath runtime overrides.

### Transition from the database-writing bootstrap

Versions with the original `memos-idp-*.json` bootstrap copied file-backed IdPs, including client secrets, into the `idp` table during migration. The new
loader cannot reliably distinguish those rows from providers created through the UI, so it must not delete or scrub them automatically.

When a file shadows a stored provider with the same UID, startup logs a secret-free warning that a stored copy remains. Operators who previously used the
database-writing bootstrap should clean up explicitly:

1. Back up the database and retain administrator password access.
2. Temporarily remove the IdP file and restart Memos so the stored provider is no longer shadowed.
3. Delete or update the stored provider through the administrator UI or API, or perform equivalent offline database maintenance.
4. Restore the file and restart Memos.

Until that cleanup is complete, the old stored provider and secret remain in the database and can reappear if the file is removed. The no-persistence
guarantee applies to the new loader; it does not claim to erase secrets written by earlier versions.

## Implementation

The implementation:

1. Replaces the database-writing IdP bootstrap with a typed deployment-configuration loader.
2. Decodes and validates `memos-instance-setting-*.json` resources.
3. Loads configuration after migration and demo seeding but before service construction.
4. Publishes an immutable provider/settings snapshot owned by the store facade, with clone-on-read semantics.
5. Resolves file-backed values before database values and caches for IdP authentication and instance settings.
6. Uses explicit raw database reads for snapshot planning and permitted mutation paths.
7. Validates affected startup state and uses a narrow serializable transaction for runtime authentication mutations.
8. Enforces deployment ownership through API mutation guards and returns `codes.FailedPrecondition` for rejected writes.

## Test strategy

The implementation requires tests for:

- Every canonical filename pattern, legacy identity-provider filename compatibility, and supported message type.
- Unknown fields, oversized files, unreadable files, invalid protobuf JSON, and invalid enum values.
- Duplicate provider UIDs and setting keys.
- Rejection of `BASIC`, `TAGS`, and key/`oneof` mismatches.
- Complete validation before snapshot publication.
- Store-proto JSON compatibility fixtures from earlier releases.
- Effective merging and shadowing by provider UID and setting key.
- Stable stored ordering and deterministic placement of deployment-only identity providers.
- Removal of a file taking effect after constructing a new process snapshot without deleting stored configuration.
- Existing user-identity links working with a file-backed provider of the same UID.
- File-backed settings bypassing database cache entries.
- Clone-on-read behavior and race tests proving snapshot messages cannot be mutated by callers.
- Authentication safety for startup and runtime IdP deletion.
- Concurrent `GENERAL` updates and IdP deletion preserving the runtime authentication invariant across database drivers.
- An unrelated deployment file not failing because of untouched pre-existing authentication state.
- Storage read-time defaults, SMTP validation, and deterministic AI normalization without database secret preservation.
- Missing-directory behavior and matched-file count logging.
- Mutation guards, including requests carrying field masks.
- A stored provider shadowed by a file producing a secret-free legacy-bootstrap warning.
- Secret redaction in errors, logs, and API responses.

## Research references

- [Mastodon environment configuration](https://docs.joinmastodon.org/admin/config/)
- [Mastodon OmniAuth initialization](https://github.com/mastodon/mastodon/blob/main/config/initializers/3_omniauth.rb)
- [GitLab OpenID Connect configuration](https://docs.gitlab.com/administration/auth/oidc/)
- [Keycloak startup import](https://www.keycloak.org/server/importExport)
- [Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
