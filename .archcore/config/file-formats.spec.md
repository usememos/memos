---
title: "Provisioning file formats"
status: draft
tags:
  - "config"
---

## Purpose & Scope
Status: Implemented.

This spec defines the content of deployment-configuration files: which `memos.store` message each file holds, which fields are required, how the loader validates and normalizes each resource, and which JSON spellings stay compatible across releases. Using store protobuf JSON makes these messages a supported deployment interface, although the messages stay internal to the application.
Normative for `validateDeploymentIdentityProvider`, `validateAndNormalizeDeploymentInstanceSetting`, and `normalizeDeploymentAISetting` in @store/deployment_config.go, and for contributors who change @proto/store/idp.proto or @proto/store/instance_setting.proto. Dependents: operators who write the files.
Out of scope: filename discovery, merging with stored configuration, and the authentication invariant across resources.

## Surface
- Identity-provider file: one `memos.store.IdentityProvider` with `uid`, `name`, `type`, `identifierFilter`, and `config.oauth2Config` fields `clientId`, `clientSecret`, `authUrl`, `tokenUrl`, `userInfoUrl`, `scopes`, `fieldMapping` (`identifier`, `displayName`, `email`, `avatarUrl`).
- Instance-setting file: one `memos.store.InstanceSetting` with `key` and the `oneof` that matches it, for example `generalSetting`, `accessSetting`, or `notificationSetting.email`.
- Supported keys and deployment use: `ACCESS` (private or public access policy); `GENERAL` (registration, authentication, branding, scripts, styles, user-profile policy); `STORAGE` (attachment storage type, limits, paths, S3 credentials); `MEMO_RELATED` (memo limits, editing, reactions); `NOTIFICATION` (SMTP transport and credentials); `AI` (providers, API keys, transcription defaults).
- Rejected keys: `BASIC`, `TAGS`.
- Instance URL: `--instance-url` flag or `MEMOS_INSTANCE_URL` (@cmd/memos/main.go), normalized by `normalizeInstanceURL` in @internal/profile/profile.go.
- Read-time defaults: @store/instance_setting.go.

## Normative Behavior
1. WHEN an identity-provider file sets the database-generated `id`, the loader MUST reject the file.
2. The loader MUST require a valid, nonempty `uid` and a nonempty `name`.
3. The loader MUST accept only OAuth2 providers.
4. The loader MUST require a nonempty `clientId` and `clientSecret`.
5. The loader MUST require authorization, token, and user-info URLs.
6. The loader MUST require at least one scope and reject empty scope entries.
7. The loader MUST require a field mapping with a nonempty `identifier`.
8. WHEN an instance-setting file is loaded, the loader MUST require `key` and a populated `oneof` that matches it.
9. WHEN `key` is `ACCESS`, the loader MUST require `INSTANCE_ACCESS_MODE_PRIVATE` or `INSTANCE_ACCESS_MODE_PUBLIC` explicitly.
10. WHEN `key` is `BASIC` or `TAGS`, the loader MUST reject the file.
11. The loader MUST let a file replace the complete effective group of its key.
12. The loader MUST decode an omitted scalar as its protobuf default, not as the stored database value.
13. WHEN effective settings are read, the store MUST apply the same read-time defaults it applies to stored configuration.
14. WHEN a secret field is empty in a file, the loader MUST treat it as an empty value.
15. WHEN an AI provider has no `id`, the loader MUST reject it instead of generating one.
16. The loader MUST require every AI provider to have a title, a supported provider type, and an API key.
17. WHEN an OpenAI provider has an empty endpoint, the loader MUST set `https://api.openai.com/v1`.
18. WHEN a Gemini provider has an empty endpoint, the loader MUST set `https://generativelanguage.googleapis.com/v1beta`.
19. The loader MUST reject duplicate AI provider IDs.
20. WHEN transcription names a provider ID, the loader MUST require that provider in the same AI setting.
21. The loader MUST apply to transcription model, language, and prompt the same length limits as API-managed settings.
22. WHEN the server starts, it MUST trim surrounding whitespace and trailing slashes from the instance URL.

## Constraints & Invariants
- `BASIC` is rejected because it holds the instance secret key and the database schema version: replacing the key invalidates sessions, and replacing the version interferes with migration state.
- `TAGS` is rejected because it is kept only for backward compatibility; active tag metadata is stored per user.
- Two files MUST NOT declare the same setting key.
- Two files MUST NOT declare the same identity-provider UID.
- Invariant: user-identity links already use the provider UID as their stable value, so a file-backed provider does not need a database-generated IdP ID to preserve account links or complete SSO sign-in.
- An instance-setting group is the smallest deployment-configured unit; partial field ownership inside a group does not exist.
- Example read-time default: `STORAGE` falls back to local storage, a 30 MiB upload limit, and `assets/{timestamp}_{uuid}_{filename}`.
- Invariant: credential preservation used by UI updates never applies to deployment configuration.
- Invariant: no AI provider, API key, or transcription value is copied from a shadowed stored setting.
- The instance URL MUST be an absolute HTTP(S) URL without credentials, a query, or a fragment. It is separate from `ACCESS` and does not change who may access the instance.
- For every provisionable message, contributors MUST preserve existing protobuf JSON field names.
- Contributors MUST preserve existing enum names and meanings.
- Contributors MUST preserve stable resource-key and `oneof` mappings.
- Contributors MUST preserve previously valid omissions of fields that have defaults.
- Contributors MAY add optional fields and enum values.
- Contributors MAY deprecate a provisionable field.
- A deprecated field's existing JSON spelling MUST still decode for the supported upgrade window.
- Contributors MUST NOT reuse a field name with a different meaning.
- New validation SHOULD NOT invalidate an existing safe configuration without an upgrade note and a documented replacement.
- Unknown fields stay startup errors, because they catch misspellings and configuration written for a newer, incompatible Memos version.
- Compatibility tests SHOULD keep representative JSON fixtures from earlier releases and decode them with the current loader.

## Failure Behavior
1. IF any rule in behaviors 1–10, 15, 16, 19, 20, or 21 fails, THEN the loader MUST fail startup and name the file.
2. IF the instance URL violates its constraint, THEN the server MUST fail profile validation before startup.
3. IF a validation error is reported, THEN the loader MUST NOT include secret values in it.

## Conformance
An implementation is conformant when it satisfies behaviors 1–22, the constraints above, and the failure rules. Tests: @store/deployment_config_test.go.

Given `memos-instance-setting-access.json` contains `{"key": "ACCESS", "accessSetting": {}}`
When the server starts
Then startup fails, because the access mode is omitted
