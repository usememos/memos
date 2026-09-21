# Configuration Provisioning

## Summary

> Moved to [`.archcore/config/deployment-configuration-model.adr.md`](../.archcore/config/deployment-configuration-model.adr.md).

## Design model

> Moved to [`.archcore/config/deployment-configuration-model.adr.md`](../.archcore/config/deployment-configuration-model.adr.md).

## Goals

> Moved to [`.archcore/config/deployment-configuration-model.adr.md`](../.archcore/config/deployment-configuration-model.adr.md).

## Non-goals

> Moved to [`.archcore/config/deployment-configuration-model.adr.md`](../.archcore/config/deployment-configuration-model.adr.md).

## Terminology

> Moved to [`.archcore/config/file-discovery.spec.md`](../.archcore/config/file-discovery.spec.md) and [`.archcore/config/effective-configuration.spec.md`](../.archcore/config/effective-configuration.spec.md).

## File discovery

> Moved to [`.archcore/config/file-discovery.spec.md`](../.archcore/config/file-discovery.spec.md).

## Identity-provider files

> Moved to [`.archcore/config/file-formats.spec.md`](../.archcore/config/file-formats.spec.md).

## Instance-setting files

> Moved to [`.archcore/config/file-formats.spec.md`](../.archcore/config/file-formats.spec.md).

## Configuration format compatibility

> Moved to [`.archcore/config/file-formats.spec.md`](../.archcore/config/file-formats.spec.md).

## Runtime configuration snapshot

> Moved to [`.archcore/config/effective-configuration.spec.md`](../.archcore/config/effective-configuration.spec.md).

## Effective configuration resolution

> Moved to [`.archcore/config/effective-configuration.spec.md`](../.archcore/config/effective-configuration.spec.md).

## Validation and authentication safety

> Moved to [`.archcore/config/provisioning-validation.spec.md`](../.archcore/config/provisioning-validation.spec.md).

## API behavior

> Moved to [`.archcore/config/provisioning-validation.spec.md`](../.archcore/config/provisioning-validation.spec.md).

## Frontend behavior

> Moved to [`.archcore/config/provisioning-validation.spec.md`](../.archcore/config/provisioning-validation.spec.md).

## Security

> Moved to [`.archcore/config/provisioning-validation.spec.md`](../.archcore/config/provisioning-validation.spec.md) and [`.archcore/config/operating-deployment-configuration.guide.md`](../.archcore/config/operating-deployment-configuration.guide.md).

## Multiple server replicas

> Moved to [`.archcore/config/operating-deployment-configuration.guide.md`](../.archcore/config/operating-deployment-configuration.guide.md).

## Database and migration impact

> Moved to [`.archcore/config/provisioning-validation.spec.md`](../.archcore/config/provisioning-validation.spec.md) and [`.archcore/config/operating-deployment-configuration.guide.md`](../.archcore/config/operating-deployment-configuration.guide.md).

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
9. Initializes and reads the dedicated ACCESS policy independently from the canonical external instance URL.

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
- One-time legacy ACCESS initialization and persistence across later instance-URL changes.
- Immediate cross-replica database-backed ACCESS reads and explicit PRIVATE/PUBLIC API behavior.

## Research references

> Moved to [`.archcore/config/deployment-configuration-model.adr.md`](../.archcore/config/deployment-configuration-model.adr.md).
