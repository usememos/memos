---
title: "Provisioning validation and API"
status: draft
tags:
  - "config"
---

## Purpose & Scope
Status: Implemented.

This spec defines the safety rules around deployment configuration: cross-resource validation at startup, the authentication invariant for runtime mutations, the API rules for file-backed resources, secret handling, and the database impact. Normative for @store/deployment_config.go, @store/auth_config.go, the `ApplyAuthenticationConfigMutation` driver methods in @store/db/sqlite/auth_config.go, @store/db/mysql/auth_config.go, and @store/db/postgres/auth_config.go, the mutation guards in @server/api/v1/idp_service.go and @server/api/v1/instance_service.go, and `initializeInstanceAccessSetting` in @store/migrator.go. Dependents: administrators using the API and UI, operators, and sign-in flows.
Out of scope: file discovery, per-message field rules, effective merging, and rollout procedures.

## Surface
- Startup check: `validateDeploymentAuthenticationState`; shadow warning: `warnShadowedStoredIdentityProviders`.
- Runtime mutations: `UpsertInstanceGeneralSettingSafely`, `DeleteIdentityProviderSafely`; error `ErrUnsafeAuthenticationConfiguration`; retry bound `authenticationMutationMaxAttempts` (3).
- API guards return `codes.FailedPrecondition` with `... is configured by the deployment`.
- Redacted API fields: IdP client secret, SMTP password, S3 access key secret, AI API keys (@server/api/v1/instance_service_converters.go).
- Admin password path: @server/api/v1/auth_service.go blocks password sign-in only for `RoleUser` when `disallowPasswordAuth` is set.

## Normative Behavior
1. The loader MUST run all file-local validation before snapshot publication.
2. WHEN files affect a relationship between resources, the loader MUST validate it against the resulting effective configuration.
3. IF a `GENERAL` file disables regular-user password sign-in and no effective identity provider exists, THEN the loader MUST reject startup.
4. IF S3 storage lacks the required endpoint, bucket, region, or credentials, THEN the loader MUST reject the file.
5. IF enabled email delivery lacks the required SMTP host, port, or sender, THEN the loader MUST reject the file.
6. WHEN no file configures `GENERAL` or an identity provider, the loader MUST NOT fail on the stored authentication state.
7. WHEN the stored state already disables password sign-in without an identity provider, the loader MUST log a warning instead.
8. WHEN a file shadows a stored provider with the same UID, the loader MUST log a secret-free warning that a stored copy remains.
9. The server MUST keep administrator password sign-in available regardless of `disallowPasswordAuth`.
10. IF a runtime mutation moves from a safe state to password sign-in disabled without an effective identity provider, THEN the store MUST reject it.
11. WHEN a legacy state already violates the invariant, the store MAY accept an unrelated `GENERAL` edit that preserves the violation.
12. IF deleting an identity provider removes the last effective provider from a safe state, THEN the store MUST reject it.
13. WHEN `GENERAL` is updated or an identity provider is deleted, the store MUST validate and write in one serializable transaction.
14. Inside that transaction, the store MUST read stored `GENERAL` and stored providers, combine them with the snapshot and the proposal, then validate.
15. IF the transaction hits a serialization conflict, THEN the store MUST retry up to a bounded number of attempts.
16. The API MUST read effective resources and write only stored resources.
17. IF a request creates a stored provider with a UID held by a file-backed provider, THEN the API MUST return `codes.FailedPrecondition`.
18. IF a request updates or deletes a file-backed provider, THEN the API MUST return `codes.FailedPrecondition`.
19. IF a request updates a file-backed instance-setting group, THEN the API MUST return `codes.FailedPrecondition`.
20. The API MUST run the instance-setting guard before validation and before any field-mask application.
21. The API MUST process mutations of unshadowed stored configuration normally, subject to the authentication invariant.
22. The API MUST redact client secrets, SMTP passwords, S3 secrets, and AI API keys in responses.
23. The API MUST NOT write to mounted files.
24. The API MUST keep test operations that change no stored configuration available, such as testing the effective SMTP configuration.
25. The frontend MUST show normal mutation controls and report the API's `FailedPrecondition` error.
26. WHEN no `ACCESS` row exists at startup, the store MUST create one: `PUBLIC` if the legacy instance URL is nonempty, else `PRIVATE`.

## Constraints & Invariants
- Invariant: a key/`oneof` mismatch, an omitted or unspecified `ACCESS` mode, a duplicate AI provider ID, a transcription provider absent from the AI setting, and a duplicate stable key each prevent publication.
- Rule 11 keeps an upgraded `GENERAL` group editable; the administrator resolves the violation by enabling password sign-in or configuring an identity provider.
- Validation and mutation MUST be one operation, because separate check-then-write calls let concurrent requests each validate an old safe state and together produce an unsafe one.
- Every database driver MUST provide equivalent serializable semantics for this operation; it adds no table or schema migration.
- The frontend MUST NOT receive configuration-source metadata; the API is the sole mutation authority.
- The server MUST treat `/etc/secrets` and every matching file as sensitive plaintext.
- Operators SHOULD set owner-only or application-group-readable filesystem permissions on these files.
- The server MUST NOT log file contents, decoded messages, before/after values, or secret fields.
- Validation errors and startup summaries MUST redact secrets.
- The store MUST NOT persist deployment secrets in `idp`, `system_setting`, a state file, or ownership metadata.
- The snapshot MUST stay process-local; the API exposes only redacted representations.
- No schema change: file-backed resources are never inserted into `idp` or `system_setting`; user-identity links stay database-backed and reference provider UIDs; existing stored configuration remains untouched beneath runtime overrides.
- The `ACCESS` initialization is one-time: after the row exists, instance-URL changes never change access policy. An `ACCESS` file can shadow the row without modifying it.
- The loader MUST NOT delete or scrub rows copied by the earlier database-writing bootstrap, because it cannot distinguish them from UI-created providers.
- The no-persistence guarantee covers this loader only; it does not erase secrets written by earlier versions.

## Failure Behavior
1. IF any startup validation fails, THEN the server MUST fail startup instead of publishing partial configuration.
2. IF a matching file is unreadable or invalid, THEN the server MUST fail startup.
3. IF a runtime mutation is rejected as unsafe, THEN the API MUST return `codes.FailedPrecondition`.
4. IF serialization retries are exhausted, THEN the store MUST return an error and apply no change.

## Conformance
An implementation is conformant when it satisfies behaviors 1–26, the constraints above, and the failure rules. Tests: @store/deployment_config_test.go, @store/test/auth_config_test.go, @server/api/v1/test/configuration_provisioning_test.go.

Given a `GENERAL` file with `disallowPasswordAuth: true` and no stored or file-backed identity provider
When the server starts
Then startup fails and no snapshot is published
