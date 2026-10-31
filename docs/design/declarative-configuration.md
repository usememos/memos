# Declarative Configuration

Status: Draft

## Summary

Operators describe the identity providers, instance settings, bootstrap users, and those users' SSO identities an instance should have in configuration files. Memos
treats those files as the desired state, compares them with the actual state in the database, shows the difference as a plan, and applies
the plan as one atomic database transaction. A state record remembers which resources the configuration manages, so Memos can detect
drift, release or destroy resources that leave the configuration, and refuse API writes that would silently diverge from the files.

The model is the one Terraform and Kubernetes made standard: desired state in files, actual state in the system, a state record that links
the two, an explicit plan, and an idempotent apply. The file schema is the public API resource model, so the compatibility promise for
configuration files is the API compatibility policy and nothing separate.

## Design model

A declarative configuration system has five parts. Every decision below is a choice about one of them.

| Part | Memos |
| --- | --- |
| Desired state | JSON documents in a configuration directory, merged into one `memos.api.Configuration` |
| Actual state | The `idp`, `system_setting`, `user`, and `user_identity` tables, read through the store |
| State record | One `CONFIGURATION_STATE` row in `system_setting`: a serial and the list of managed resources, never a value |
| Plan | A deterministic list of per-resource actions computed from desired, actual, and state record, printable as text or JSON |
| Apply | The plan executed inside one serializable transaction, followed by an update of the state record in the same transaction |

Terraform's vocabulary is used throughout: a resource is *managed* when the state record lists it, *drift* is a difference between the
actual state and the last applied desired state, *lifecycle* rules adjust how a resource is planned, a *removed* declaration takes a
resource out of management, and *import* (called *adopt* here) brings an existing resource under management.

Two places deliberately depart from Terraform, and each is called out where it happens:

- Apply is atomic. Terraform applies resource by resource and can stop halfway; every Memos resource lives in one database, so the plan
  either applies completely or not at all.
- Managed resources are read-only through the API. Terraform tolerates drift and corrects it at the next apply; Memos refuses the write
  up front, because a change that silently disappears at the next restart is worse for an administrator than an immediate error.

## Scope

Three different things are called "configuration", and only one of them is declarative configuration.

| Layer | What it is | How it is set | Terraform analogue |
| --- | --- | --- | --- |
| Process | Inputs the binary needs before it can reach the database: `--port`, `--driver`, `--dsn`, `--data`, `--instance-url`, `--config-dir` | Flags and environment variables | The provider block |
| Instance | Database-resident resources that define how the instance behaves for everyone | Declarative files or the admin API | Resources |
| Content | What people make while using the product | UI and API only | Out of scope |

This design covers the instance layer only. The process layer stays in flags, because the files cannot be read until the process layer has
said where the database is. The content layer stays out because it has no operator-chosen names and is edited by every user every day.

### The test for a resource

A resource belongs in the files when all five hold:

1. **Operator-owned.** An administrator decides it, not the person using the product.
2. **Stable name.** The operator chooses the identifier (`identity-providers/company-sso`, `users/admin`), so one file addresses the same
   resource in every environment. Server-generated identifiers such as `memos/{uid}` fail this.
3. **Low cardinality, low churn.** Tens of entries, edited in a reviewed file; not thousands, not hourly.
4. **Wanted identical across environments or before first sign-in.** Staging equals production; a fresh instance is usable without a browser.
5. **Fully expressible.** Everything about it fits in a file; nothing essential is computed at runtime.

Failing one puts the resource in the UI and API.

### Inventory

| Resource | Verdict | Reason |
| --- | --- | --- |
| `instance/settings/{ACCESS, GENERAL, STORAGE, MEMO_RELATED, NOTIFICATION, AI, USAGE_LIMITS}` | In | Policy; the reason the feature exists |
| `instance/settings/BASIC` | Never | Instance secret and schema version are state, not policy |
| `instance/settings/TAGS` | Never | Legacy; tag metadata is per user |
| `identity-providers/*` | In | Authentication infrastructure, needed before the first SSO sign-in |
| `users/*` | In, narrowly | Bootstrap administrators: `username`, `role`, `password`, optionally `displayName` and `email`; the rest of the profile is the user's |
| `spaces/*` | Later | `title` and `description` pass the test; `spaces/*/members` does not, because membership runs through invite and accept |
| `users/*/webhooks/*` | Later | Reproducible wiring for an automation user; content for anyone else |
| `users/*/personalAccessTokens/*` | Later, with care | Bootstrapping an MCP client needs a token before anyone signs in; the value would be a write-only field the operator supplies |
| `users/*/settings/*`, `users/*/views/*` | Never | Personal preferences |
| `users/*/linkedIdentities/*` | In, for declared users | A bootstrap administrator on an SSO-only instance needs a way in before the first sign-in; a declared subject trusts no claim the provider makes. Other users' links are created by signing in |
| `users/*/notifications/*`, `users/*/stats`, `users/*/usage`, `spaces/*/invitations/*` | Never | Transient or computed |
| `memos/*`, `attachments/*`, reactions, shares, comments | Never | Content |

The "In" rows are the whole first version. The "Later" rows are what the machinery must not make hard: the state record keys on resource
name and each kind declares its field classes in one place, so adding a kind is one table in this document and one package.

### Rule for new features

When a change adds an instance setting or an admin-managed resource, ask: would an operator want this in version control, identical in
staging and production, set before anyone signs in? Yes means the same change gives it a field class table below and a fixture. No means it
is a UI concern and the files never learn about it.

## Goals

- One file format with one compatibility policy: files are public API resources in protobuf JSON.
- A plan that shows exactly what apply will change, with secrets redacted, before anything is written.
- Atomic, idempotent apply: the same files applied twice produce an empty second plan; a failed apply changes nothing.
- A state record that makes removal, release, adoption, and drift explicit instead of inferred.
- Administrators can see which resources the configuration manages and why an edit is refused.
- Secrets reach the files only through references to the environment or to other files; the state record stores no values.
- Validation without a database, planning without writes, and apply from both the CLI and server startup.
- Headless bootstrap: an instance can come up with its administrator, identity provider, and policy without a browser.

## Non-goals

- Field-level ownership of one resource by several managers (Kubernetes server-side apply). A resource is managed whole, with
  `ignoreChanges` to release individual fields.
- Watching the directory and re-applying without a restart or an explicit `apply`.
- Managing anything outside the "In" rows of the inventory above.
- Writing API changes back into the files.
- A remote state backend. The state record lives in the instance database.
- Templates, modules, or variables beyond `${env:…}` and `${file:…}` substitution.

## Terminology

**Desired state**
: The merged `Configuration` document decoded from every file in the configuration directory.

**Actual state**
: The resources currently stored in the database, read without caches.

**State record**
: The `CONFIGURATION_STATE` row. It lists managed resources and the last apply; it never stores values.

**Managed resource**
: A resource listed in the state record. Its managed fields are read-only through the API.

**Plan**
: The ordered list of actions that turn the actual state into the desired state, together with the drift and adoption it detected.

**Drift**
: A managed resource whose actual state differs from the desired state. With the API guard in place, drift can only come from direct
database edits, a restored backup, or a change to the files.

**Adopt**
: Bringing a resource that already exists in the database under management because the desired state declares it.

**Release**
: Removing a resource from the state record without changing it in the database.

**Destroy**
: Removing a resource from the state record and deleting it, or for a singleton setting group, resetting it to its defaults.

## Configuration source

### Directory

Memos reads every regular file named `*.json` in one directory, in lexical filename order, without recursing. The directory comes from
`--config-dir` or `MEMOS_CONFIG_DIR`; the default is `/etc/memos/config`. A missing directory means an empty desired state. An unreadable
directory or file is an error. Symlinks that resolve to regular files are followed, because Kubernetes Secret and ConfigMap volumes are
symlink farms. Files larger than 1 MiB are rejected. Files with other extensions are ignored so the directory can hold unrelated mounts.

Lexical order affects only diagnostics. As in a Terraform root module, all files form one configuration; a resource may be declared in
exactly one file, and declaring the same resource name twice is an error that names both files.

### Document

Every file is one `memos.api.Configuration` message in protobuf JSON:

```proto
// Configuration is one declarative configuration document. All files in the
// configuration directory are merged into one Configuration.
message Configuration {
  // Identity providers to manage, by resource name.
  repeated IdentityProvider identity_providers = 1;
  // Instance setting groups to manage, by resource name.
  repeated InstanceSetting instance_settings = 2;
  // Users to manage, by resource name. Intended for bootstrap administrators.
  repeated User users = 3;
  // Lifecycle rules for declared resources.
  repeated Lifecycle lifecycle = 4;
  // Resources to take out of management.
  repeated Removed removed = 5;
  // SSO identities of declared users, by resource name: which identity-provider
  // subject signs in as which user.
  repeated LinkedIdentity linked_identities = 6;
}

// Lifecycle adjusts how one declared resource is planned. Mirrors Terraform's
// lifecycle meta-argument.
message Lifecycle {
  // Required. The resource name the rule applies to.
  string resource = 1;
  // Field paths, in JSON name form, that the configuration does not manage.
  // Apply never writes them after creation and the API guard never protects them.
  repeated string ignore_changes = 2;
  // A removed entry cannot destroy the resource while the last apply set this.
  bool prevent_destroy = 3;
  // Increment to resend write-only fields such as User.password. Mirrors the
  // `_wo_version` convention of Terraform write-only arguments.
  int32 write_only_version = 4;
}

// Removed takes a resource out of management. Mirrors Terraform's removed block.
message Removed {
  // Required. The resource name.
  string resource = 1;
  // Delete the resource (or reset a setting group) instead of only releasing it.
  bool destroy = 2;
}
```

The message lives in `proto/api/configuration.proto` next to `Plan`. It is a public API message: `buf breaking`,
`proto/api/CHANGELOG.md`, and the review-time compatibility check apply to it exactly as to every request and response message.

Example `/etc/memos/config/instance.json`:

```json
{
  "identityProviders": [
    {
      "name": "identity-providers/company-sso",
      "type": "OAUTH2",
      "title": "Company SSO",
      "config": {
        "oauth2Config": {
          "clientId": "memos",
          "clientSecret": "${env:OIDC_CLIENT_SECRET}",
          "authUrl": "https://idp.example.com/oauth/authorize",
          "tokenUrl": "https://idp.example.com/oauth/token",
          "userInfoUrl": "https://idp.example.com/oauth/userinfo",
          "scopes": ["openid", "profile", "email"],
          "fieldMapping": { "identifier": "sub", "displayName": "name", "email": "email" }
        }
      }
    }
  ],
  "instanceSettings": [
    { "name": "instance/settings/ACCESS", "accessSetting": { "accessMode": "INSTANCE_ACCESS_MODE_PRIVATE" } },
    {
      "name": "instance/settings/GENERAL",
      "generalSetting": {
        "disallowPasswordAuth": true,
        "disallowUserRegistration": false,
        "customProfile": { "title": "Company Memos" }
      }
    }
  ],
  "users": [
    { "name": "users/admin", "username": "admin", "role": "ADMIN", "password": "${file:/run/secrets/memos-admin-password}" }
  ],
  "linkedIdentities": [
    { "name": "users/admin/linkedIdentities/company-sso", "externalUid": "${env:ADMIN_SSO_SUBJECT}" }
  ],
  "lifecycle": [
    { "resource": "users/admin", "preventDestroy": true, "writeOnlyVersion": 1 }
  ]
}
```

### Decoding

Decoding is strict, as `terraform validate` and `kubectl apply --validate=strict` are:

- Unknown fields are errors. They catch misspellings and files written for a newer Memos.
- Fields marked `deprecated = true` in the proto decode normally and produce one warning per field naming the replacement. The decoder
  walks the message descriptor for set fields; protojson itself has no deprecation hook.
- Output-only fields (`create_time`, `update_time`, `avatar_url` and similar) are errors when set, because the configuration cannot
  manage them.
- Enum values are accepted by name only; numeric enum values are errors, because numbers are not part of the compatibility promise.

### Value substitution

Before decoding, string values of the form `${env:NAME}` and `${file:/absolute/path}` are replaced by the environment variable or the
file contents with trailing line breaks removed. A variable set to the empty string is a value, not an error. `$${` escapes a literal `${`. Substitution applies to the whole string value only; a reference embedded in a longer
string is an error, which keeps the rule simple and keeps secrets from being concatenated into URLs by accident. An unset variable, an
unreadable file, or a file above 64 KiB is an error that names the reference, never the value.

Substitution is how secrets enter the configuration. The files themselves can then be committed to version control or baked into an
image with no secret in them, which is the practice both Terraform (`TF_VAR_…`, sensitive variables) and Kubernetes (`valueFrom`) push
operators toward. Plain secret values in a file remain allowed for deployments that mount the file itself as a secret.

## Resources

Resource identity is the API resource name. It is the plan address, the state record key, and the join key for adoption and for the API
guard. Renaming a file never changes identity; changing a `name` is a destroy of the old resource and a create of the new one, as in
Terraform.

Each kind declares what apply writes and what it leaves alone. In Terraform terms, these are the attributes the provider marks
`Required`, `Optional`, `Optional+Computed`, `Sensitive`, and `WriteOnly`.

### IdentityProvider

| Field | Class |
| --- | --- |
| `name` | identity, `identity-providers/{idp}` |
| `type`, `title`, `identifierFilter`, `config` | managed |
| `config.oauth2Config.clientSecret` | managed, sensitive |

The resource is managed whole: an omitted field is applied as its protobuf default. The stored client secret is readable through the
store, so it is compared like any other field, and the plan prints it as `(sensitive)`.

Destroy deletes the provider. Linked identities keep their `provider` value; sign-in through that provider stops until a provider with the
same name exists again, at which point the links work unchanged. The authentication invariant (below) is checked before a destroy is
planned.

### InstanceSetting

| Field | Class |
| --- | --- |
| `name` | identity, `instance/settings/{setting}` |
| the `oneof` value matching the key | managed whole |
| SMTP password, S3 secret, AI API keys | managed, sensitive |

Allowed keys: `ACCESS`, `GENERAL`, `STORAGE`, `MEMO_RELATED`, `NOTIFICATION`, `AI`, `USAGE_LIMITS`. `BASIC` holds the instance secret and
schema version and is never configurable. `TAGS` is retained only for compatibility and is not configurable.

A setting group is a singleton: it cannot be created or deleted, only updated. Destroy therefore means "reset to the defaults a fresh
instance would have" (`ACCESS` becomes `PRIVATE`, `STORAGE` becomes local storage, and so on), and the plan prints it as `reset`. Managed
whole: a field omitted from the file is applied as its protobuf default, so a file is the complete group and never a patch.

Read-time defaults that the store applies to zero values (a default local storage, a default file path template) apply to configured
values exactly as to values written through the API, because both paths write the same stored message.

### User

| Field | Class |
| --- | --- |
| `name` | identity, `users/{user}` |
| `username` | managed, must equal the `{user}` segment |
| `role` | managed |
| `displayName`, `email` | optional: managed only when declared, otherwise left as the user set them |
| `password` | write-only; required to create the user unless a linked identity is declared for it |

Users are included for one purpose: bringing up an instance without a browser. The user owns their profile, so the configuration manages
only what it declares. Presence is taken from the JSON document, not from the decoded message, so `"displayName": ""` manages the field as
empty while omitting it leaves the field alone.

`password` is write-only in the Terraform 1.11 sense: it is never readable, never stored in the state record, never compared, and never
protected by the API guard, so the administrator can change their own password in the UI. Apply sends it on create and whenever the
resource's `lifecycle.writeOnlyVersion` is greater than the version recorded in the state record. Resending on every apply would undo a
password change at every restart; resending only on an explicit version bump is the behavior Terraform standardized on for the same reason.
A user with a declared linked identity signs in through its provider, so it may be created without a password: apply then gives it a
random password nobody knows, exactly as the sign-in path provisions a new SSO user. Declaring a password later, with a version bump,
sets one.

Configuration never deletes a user. Deleting one deletes their memos and attachment files and must respect the spaces they belong to,
which is the deletion flow in Settings, with its confirmations. A `removed` entry with `destroy: true` for a user is therefore a plan
error; `destroy: false` releases the user, who can then be deleted in Settings. `preventDestroy` still guards a user's identity provider
and settings, and is recommended for every declared user for the day that changes.

### LinkedIdentity

| Field | Class |
| --- | --- |
| `name` | identity, `users/{user}/linkedIdentities/{idp}`: the user and the identity provider it links |
| `externalUid` | managed: the provider's subject that signs in as the user |
| `identityProvider` | output only; it repeats the name |

A linked identity exists for one case: an administrator declared in the files, on an instance where sign-in is through an identity
provider. Without it the first sign-in through the provider provisions a new account, because the sign-in path matches a provider and
subject and nothing else. Matching on an email or a username claim instead was rejected: a provider's email claim is not proof of
ownership on this instance, the OAuth2 mapping has no verified-email claim, and a provider username is chosen by whoever signs up there.
A declared subject trusts no claim: the operator reads it once from the provider and writes it down, and the sign-in path is unchanged.

The user must be declared in the same configuration. The declaration is what makes the binding trustworthy, so a link for an undeclared
user is a schema error, and a link stays managed only while its user is. One subject signs in as one user, so a subject declared twice is
a schema error, and plan fails when the subject is already linked to a different user rather than taking it over. The provider must exist
after apply, declared or stored. A link the user made by signing in with the declared subject is adopted; a different stored subject for
that provider is replaced, since the user has one link per provider.

Destroy deletes the link; the user keeps the account and can sign in with the password, or link again by signing in through the provider
once the link is released. `ignoreChanges` does not apply, since `externalUid` is the whole resource.

## State record

Terraform keeps a state file because the files alone cannot answer three questions: which existing resources are managed, what was removed
from the files since the last apply, and what was last sent for values that cannot be read back. The same three questions apply here.

The answer is one document, exactly the shape of a Terraform state file: a serial and a list of resources. It is stored as one row of
`system_setting` under the key `CONFIGURATION_STATE`, the table that already holds the instance's other JSON-encoded state such as `BASIC`.
Terraform's own `pg` backend stores its state the same way, one document per row. Keeping the record in the database, next to the resources
it describes, lets apply update both in one transaction, which a state file on disk never can, and lets every replica read it.

```proto
// proto/store/instance_setting.proto

enum InstanceSettingKey {
  // ...
  // CONFIGURATION_STATE is the declarative configuration state record.
  CONFIGURATION_STATE = 10;
}

// InstanceConfigurationState is the declarative configuration state record. It is
// state, not a setting: hidden from the API, never configurable, never a value.
message InstanceConfigurationState {
  // Increases by one per apply that changed something.
  int64 serial = 1;
  // SHA-256 of the merged document with sensitive and write-only values masked.
  string config_digest = 2;
  int64 applied_ts = 3;
  // "cli" or "startup", followed by the hostname.
  string applied_by = 4;
  // The Memos version that applied.
  string version = 5;
  repeated ManagedResource resources = 6;

  message ManagedResource {
    // The API resource name.
    string name = 1;
    // "IdentityProvider", "InstanceSetting", or "User".
    string kind = 2;
    // The filename the resource was declared in.
    string source = 3;
    // JSON-name field paths: ["*"] for whole-resource kinds, the declared
    // field list for users.
    repeated string managed_fields = 4;
    int32 write_only_version = 5;
    int64 applied_ts = 6;
    // The lifecycle ignoreChanges paths, which managed_fields covers but apply
    // does not write after creation and the API guard does not protect.
    repeated string ignored_fields = 7;
    // SHA-256 of the declared value last applied, sensitive and write-only
    // values masked; how a plan tells drift from a file change.
    string digest = 8;
    // The lifecycle preventDestroy last applied.
    bool prevent_destroy = 9;
    // The resource names the declaration names: the users a usage-limits
    // setting lists.
    repeated string references = 10;
  }
}
```

- The row is state, not a setting. The store's setting reads skip its key, the API's setting reads reject it as unsupported,
  `UpdateInstanceSetting` rejects it, and a file may not declare it.
- `serial` is the Terraform state serial. Apply reads, and on MySQL and PostgreSQL locks, the record at the start of its transaction
  and writes it back with `serial + 1` only when the row still holds what it read, inserting it only when it is still absent;
  serializable isolation makes this the lock, and the conditional write turns any lost update into a retry.
- `config_digest` identifies a configuration generation in logs and the API without being derivable into a secret. It is informational:
  plan never uses it to skip work, and a change to it alone, such as deleting a leftover `removed` entry, is not a change to apply.
- `digest` does per resource what the state record otherwise cannot: it identifies the declared value last applied, so a plan can tell
  whether a difference comes from the file or from an edit made outside it. A change to a sensitive value alone leaves it unchanged,
  so such an update reads as drift; it is still applied.
- `prevent_destroy` is recorded because a `removed` entry can only name a resource no file declares any longer, and so no lifecycle rule
  can still name it. Destroying a resource that set it takes two applies, as in Terraform: one without `preventDestroy`, then the removal.
- `managed_fields` and `references` are what the API guard reads, so a replica that never opened the files still enforces ownership.
- Nothing in the document is a configured value. A database dump exposes which resources are managed and nothing more.

The record is tens of entries and a few kilobytes. It would outgrow one row only with thousands of managed resources, SQL queries over them,
or several writers updating parts of it independently; none of these exist, and if a later kind crossed that line, the document can be
split into a table then with a one-off migration that reads the row.

## Plan

Plan reads the desired state, the actual state, and the state record, and produces one action per resource in a deterministic order. It
never writes. The actions, with their Terraform equivalents:

| Action | Meaning | Terraform |
| --- | --- | --- |
| `create` | Declared, absent from database and state record | `+` |
| `adopt` | Declared, present in database, absent from state record; shown with the field diff that apply will write | `import` block |
| `update` | Declared and managed; actual differs from desired in a managed field | `~` |
| `no-op` | Declared and managed; no difference | unchanged |
| `destroy` | `removed` with `destroy: true` for an identity provider; for a user it is an `error`, see User | `-` |
| `reset` | `destroy` of a setting group | `-` then `+` |
| `release` | `removed` with `destroy: false`; state record row removed, database untouched | `removed { destroy = false }` |
| `error` | Managed, no longer declared, and no `removed` entry | — |

Each `update` lists the changed field paths, in JSON names from the resource such as `generalSetting.customProfile.title`, with old and
new values; sensitive fields print `(sensitive)` on both sides, and write-only fields print `(write-only, version N)`. An `update` caused
by drift rather than by a file change is marked `drift`: the resource's declaration has the same `digest` as when it was last applied, so
the instance changed. A managed resource deleted outside the configuration is a `create` marked `drift`. This is the signal an operator
needs to find an out-of-band edit.

Both sides are compared as a write would leave them. The declared value is normalized the way a stored write normalizes it, with default
AI endpoints and the normalized storage registry, so an omitted default is not a perpetual difference. Usage limits name users, so plan
resolves the names against the database and fails for a user that does not exist. A change only to what the state record holds, such as
a new lifecycle rule, is still a change: apply writes the record and nothing else.

### Removal is explicit

A managed resource missing from the files is a plan error, not an implicit destroy. Terraform destroys by default and added `removed`
blocks because implicit destruction of a shared resource is the most common serious mistake; `kubectl apply` prunes only with an explicit
flag. The configuration is edited by hand, and an accidentally deleted identity-provider block locking every user out of an instance is
exactly the mistake to make impossible. Declaring the removal is still declarative: the file states the intent, and once applied the entry
is a no-op that may be deleted.

### Adoption is implicit

A declared resource that already exists is adopted and brought to the desired state. Terraform requires an explicit `import` because a
cloud account may hold a same-named resource the operator did not intend to manage; here resource names are instance-global and the
intent of declaring `identity-providers/company-sso` when one exists is unambiguous. The plan shows the adoption and the diff, so nothing
is hidden.

### Ordering and dependencies

Actions are ordered so every intermediate state is valid even though apply is atomic (the order matters for the plan text and for the
invariant check): identity provider creates and updates, then instance setting updates and resets, then user creates and updates, then linked identity
creates, updates, and destroys, then identity provider destroys. Within a group, resource names sort lexically.

### Validation

Validation runs in three layers, and the first two are the same code the API uses:

1. Schema: strict decoding, substitution, resource name format, the `oneof` matching the setting key, `username` matching `{user}`, a
   linked identity's user declared and its subject declared once.
2. Resource: the per-resource rules the API applies on create and update, called from one shared package per resource under `core/`
   (S3 credentials present for an S3 storage, SMTP host and sender present when email is enabled, AI providers have IDs and keys,
   `ACCESS` mode is explicit, week start offset in range, `defaultStorageId` names a declared storage, storage IDs unique and non-empty,
   every S3 storage complete). A rule that exists in one path and not the other is a bug, and the shared package is how that is
   enforced. The packages check the complete value as it will be stored; a write path's own conveniences, such as the API treating an
   empty secret as "keep the stored one" or generating a missing AI provider ID, run before validation and never inside it. An update
   does not re-check a storage it leaves unchanged, so a storage stored before a rule existed does not block editing the others; a
   declared file has no such exemption, since it states the whole value. An OAuth2 provider needs a client ID, absolute HTTP(S)
   endpoints, and an identifier mapping; a client secret and scopes stay optional because public clients have neither.
3. Cross-resource: rules that hold over the whole desired state. The authentication invariant: when the effective `GENERAL` setting
   disables password sign-in for regular users, at least one identity provider must exist after apply. It is checked against the planned
   end state, so a plan that both deletes the last provider and leaves password sign-in disabled fails before anything is written. And a
   linked identity's provider must exist after apply, and its subject must not be linked to another user.

`memos config validate` runs layer 1 and 2 without a database. `memos config plan` runs all three. Without a database, the users a
`USAGE_LIMITS` setting names get stand-in IDs for layer 2, since its rules depend only on the list's shape; whether those users exist is
checked by `plan`.

### Compatibility of files across releases

Because the schema is the public API, a file written for release N decodes under release N+1 unless `proto/api/CHANGELOG.md` says
otherwise, and a removed field goes through the existing `Deprecated` entry for at least one release before a `Breaking` entry removes it.
The decoder's deprecation warning is what makes that window useful to operators.

Two mechanisms keep the promise honest:

- `core/configuration/testdata/compat/<release>/` holds the example files from this document as they were at each release, and
  `testdata/compat/unreleased/` the current ones until a release ships and they are copied to a directory named for its tag. A test decodes
  every fixture with the current decoder. Removing a field makes the test fail until the fixture is updated in the same change, which
  forces the `CHANGELOG.md` entry into the same review.
- The `CHANGELOG.md` template gains one line under `Breaking`: when a field is removed, state that configuration files setting it are
  rejected from this release and which replacement to write.

## Apply

Apply executes a plan inside one serializable transaction:

1. Open the transaction. Read the state record and its serial.
2. Compute the plan from the actual state inside the transaction; this is the plan `memos config apply` prints, so what it shows is what
   it applied even if the instance changed since a separate `plan`. The CLI has no interactive prompt because it runs from automation.
3. Apply every action through the store's transaction-scoped writes, which keep the store's own rules: a normalized storage registry,
   normalized email addresses, unique usernames and addresses, and the last active administrator. An `ignoreChanges` path is written
   with its stored value, and a user gets only the fields the plan lists.
4. Write the state record with the new managed set and `serial + 1`, conditional on the serial read in step 1.
5. Commit. A serialization failure or a failed conditional write rolls back and runs the transaction again, up to five attempts with
   jittered backoff so replicas that start together do not keep colliding; any other error rolls back and fails.
6. In-process caches for instance settings, users, and storage drivers are reset after commit, and a user whose password apply changed
   loses every session, as after an administrator's password reset.

A plan with no changes commits nothing and leaves `serial` unchanged.

Atomicity is the main thing this design gets for free that Terraform cannot. There is no partially applied state, no refresh of a half
world, and no need for a separate lock: serializable isolation plus the serial check is the lock. SQLite gets this from an immediate
transaction, PostgreSQL from `SERIALIZABLE`, MySQL from `SERIALIZABLE` with `SELECT … FOR UPDATE` on the state row.

### When apply runs

- `memos config apply` from the CLI, against the instance database. This is the canonical path for a deployment pipeline: run it as a job
  before rolling the replicas, the same place database migration runs. It migrates the database first, exactly as server startup does,
  so it also bootstraps a fresh instance before its first start.
- Server startup, controlled by `--config-apply=startup|off` (`MEMOS_CONFIG_APPLY`), default `startup`, and `--config-dir`
  (`MEMOS_CONFIG_DIR`). The sequence is migrate, apply, seed (demo mode), then construct services. The demo seed runs after apply so its content attaches to
  the users the configuration declares; it creates a user only when none exists. A plan error or apply failure stops startup, as an
  invalid `nginx.conf` stops nginx; the process never serves with a configuration it could not apply.

`off` is for fleets that apply through the job and want replicas to never touch the files. Replicas started with `off` still read the
state record, so the API guard works everywhere.

### Multiple replicas

Every replica with `startup` applies at boot. With identical files, the first to commit makes the changes and every later one computes
an empty plan. Serializable isolation makes a race between two replicas safe: one commits, the other retries and finds nothing to do.

A rolling update can run two configuration generations at once, and the last replica to restart wins. That is inherent to applying from
each process and is why the job path exists. The state record's `applied_by` and `version` fields and the startup log line make a flapping
generation visible: the log reports the serial, the digest, the counts per action, and the resource names changed, never values.

Replicas that are already running do not see a setting applied by another process until their setting cache expires (ten minutes), with
the exception of `ACCESS`, which bypasses the cache. A deployment that changes settings should restart its replicas, which a rollout does
anyway. The API guard reads the state record from the database on every guarded write, so ownership changes apply on every replica at
once.

## Ownership and the API

### The guard

A mutation through the API that would change a managed field of a managed resource fails with `FAILED_PRECONDITION` and an
`google.rpc.ErrorInfo` detail:

```text
reason:   MANAGED_BY_CONFIGURATION
domain:   memos.api
metadata: resource = identity-providers/company-sso
          source   = instance.json
          fields   = title,config.oauth2Config.scopes
```

The guard is a rule in `core/configuration` applied by `CreateIdentityProvider`, `UpdateIdentityProvider`, `DeleteIdentityProvider`,
`UpdateInstanceSetting`, `UpdateUser`, `DeleteUser`, `CreateLinkedIdentity`, and `DeleteLinkedIdentity`. It makes three checks, each
refused with the same error:

- **Change.** `UpdateIdentityProvider`, `UpdateInstanceSetting`, and `UpdateUser` compare the request against the stored resource and
  refuse only when a managed field would change.
- **Existence.** `CreateIdentityProvider` and `CreateLinkedIdentity` refuse a name the configuration manages, so the resource cannot
  exist twice; `DeleteIdentityProvider`, `DeleteUser`, and `DeleteLinkedIdentity` refuse to delete a managed resource.
- **Reference.** `UpdateUser` refuses a username change and `DeleteUser` a deletion when a managed resource names the user, such as a
  managed usage-limits setting listing it, though the user is not itself managed; `DeleteIdentityProvider` refuses a provider a managed
  linked identity names. The next plan could not resolve the name, and a startup apply would stop the server. The error names the
  resource, the referring resource in `metadata.referenced_by`, and its file; the operator removes the name there and applies first.

Consequences:

- A whole-group `UpdateInstanceSetting` that resends the managed values unchanged succeeds, so a settings page can save an unrelated field
  the configuration released with `ignoreChanges`.
- Write-only fields are never guarded. The administrator changes their password freely.
- Fields in `ignoreChanges` are never guarded.

Terraform does not enforce ownership; Grafana provisioning does (`allowUiUpdates: false`), and Kubernetes server-side apply reports a
conflict. Refusing is chosen over tolerate-and-revert because the person at the settings page should learn now, not at the next restart.
Drift remains possible from direct database edits and backups, and the plan reports it. The guard's read and the API's write are two
steps, so an apply that starts managing a resource between them lets that one write through; the next plan reports it as drift.

Each update computes what it changes after the API's own conveniences: an empty secret meaning "keep the stored one" is resolved first,
so resending a form with the secret left blank changes nothing. Usage limits name users only in their API form, so their stored values
are compared instead.

### Configuration status

Administrators see what is managed through one admin-only `InstanceService` RPC. It is absent from `server/api/acl_config.go`, which
lists only public methods, so it requires authentication; the handler then requires an administrator. Like `GetInstanceProfile`, it is a
singleton read at a fixed path with an empty request:

```proto
service InstanceService {
  rpc GetConfigurationStatus(GetConfigurationStatusRequest) returns (ConfigurationStatus) {
    option (google.api.http) = {get: "/api/instance/configuration"};
  }
}

message ConfigurationStatus {
  int64 serial = 1;
  string config_digest = 2;
  string applied_by = 3;
  string version = 4;
  repeated ManagedResource managed_resources = 5;
  google.protobuf.Timestamp apply_time = 6;

  message ManagedResource {
    string resource = 1;
    string source = 2;
    repeated string managed_fields = 3;
    repeated string ignored_fields = 4;
  }
}
```

The response carries names, sources, and field paths; never values.

### Web presentation

The web app reads the status once per session, and only for administrators. Every place that edits a managed resource:

- Shows the existing `InfoChip` reading "Managed by configuration" with the source file, and a tooltip saying to edit the file and apply it.
  A settings group shows it only when one of its own fields is managed, so a group the configuration releases through `ignoreChanges`
  carries no chip.
- Disables the controls for managed fields, each by the JSON-name path it edits, so an ignored path stays editable. Storage locks its
  registry, default storage, and S3 fields together because the page edits them as one value; usage limits lock as one ordered list.
- Hides Delete for a managed identity provider or user, and disables Edit for a managed provider. In the user dialog the username and role
  of a managed user are disabled; the password stays editable because it is write-only. The linked identities of the account hide Unlink
  for a declared link.

An administrator-only Configuration section lists the managed resources, their files and managed fields, and the serial and last apply.
A write refused anyway, from a second tab or a stale page, shows the server's message, which names the file. The labels and disabled
controls are presentation; the API is the authority.

## CLI

```text
memos config validate [--config-dir DIR]
    Decode and validate the files without a database. Exit 0 or 1.

memos config plan [--config-dir DIR] [--json] [--detailed-exitcode]
    Print the plan. With --detailed-exitcode: 0 no changes, 1 error, 2 changes, matching terraform plan.

memos config apply [--config-dir DIR] [--json]
    Migrate the database, plan, apply in one transaction, and print the plan applied. Exit 1 on any error; nothing is written on error.

memos config state [--json]
    Print the state record: managed resources, serial, last apply.
```

Text plan output follows Terraform's conventions so operators recognise it:

```text
Plan: 1 to create, 1 to update, 0 to destroy; 1 to adopt.

  + identity-providers/company-sso        (instance.json)
  ~ instance/settings/GENERAL              (instance.json)  adopt
      generalSetting.disallowPasswordAuth: false -> true
      generalSetting.customProfile.title:  "memos" -> "Company Memos"
  ~ users/admin                            (instance.json)  drift
      role: USER -> ADMIN
```

The JSON form is the `Plan` message from `configuration.proto`, so a pipeline can gate on it without parsing text. The commands
that read the database take `--data`, `--driver`, and `--dsn` (or `MEMOS_DATA`, `MEMOS_DRIVER`, `MEMOS_DSN`) as `memos` does, and every
command uses the same `--config-dir` default and `MEMOS_CONFIG_DIR` variable. `plan` never creates or migrates a database: it fails when
the SQLite file does not exist or the schema is not the one this binary migrates to.

## Security

- The configuration directory and every file in it may contain secrets and are treated as such; the documentation recommends owner-only
  permissions and references over inline values.
- Neither the plan, the logs, the state record, nor `ConfigurationStatus` ever contains a configured value. Sensitive fields are the fields
  the API already redacts in responses; the engine and the API share that one list.
- Substitution errors name the reference, not the content; decode errors name the field, not the value.
- Write-only values are held in memory only for the duration of apply.
- `GetConfigurationStatus` is admin-only. `memos config` commands need database access and therefore the same trust as the server.
- A failed apply leaves the database and the state record exactly as they were.

## Database and migration impact

No schema change. The state record is one enum value and one message in `proto/store/instance_setting.proto`. The store runs a
serializable transaction itself, with retries, through one helper that the authentication mutation now shares. The `Driver` interface
supplies only what differs by database: the retry classification, and transaction-scoped forms of the setting read and the two
conditional setting writes.

## Implementation layout

| Path | Holds |
| --- | --- |
| `proto/api/configuration.proto` | `Configuration`, `Lifecycle`, `Removed`, `Plan` |
| `proto/api/instance_service.proto` | `GetConfigurationStatus`, `ConfigurationStatus` |
| `core/configuration/` | Reading and substituting files, decoding, the plan engine, the digest, the API guard rule |
| `core/identityprovider/`, `core/instancesetting/`, `core/user/` | Per-resource validation shared by the API and the plan engine; API↔store conversion for identity providers and instance settings, since files are API messages and `core` cannot import `server/api` |
| `store/configuration_state.go`, `store/transaction.go` | State record read and write; the serializable transaction helper with retries |
| `server/api/instance_service_configuration.go` | `GetConfigurationStatus`; the guard the mutating handlers call |
| `cmd/memos/config.go` | The `memos config` subcommands |
| `web/src/` | The managed label, disabled controls, and error presentation |

### Delivery

The work starts from zero: the first change removes the previous startup configuration loader, its runtime shadowing of stored
resources, its API checks, and its design document, so no two configuration models ever coexist. Then eight changes, each shippable alone,
in the order an operator adopts Terraform: validate, then plan, then apply, then enforcement.

| # | Change | Stands alone because |
| --- | --- | --- |
| 0 | Remove the previous loader, shadow reads, API checks, tests, and design document | A deletion with a passing test suite; the instance runs on stored configuration only |
| 1 | Shared resource validation in `core/identityprovider`, `core/instancesetting`, `core/user`; the API handlers call it | Refactor with tests. New API errors: identity providers are validated (they were stored unchecked, and an omitted `config` or `field_mapping` panicked), every changed S3 storage must be complete, and `BASIC` cannot be written |
| 2 | `Configuration`, `Lifecycle`, `Removed` protos; reading, substitution, strict decoding; `memos config validate`; first compatibility fixture; the `CHANGELOG.md` template line; API↔store conversion for identity providers and instance settings moved into `core/` | No database, no runtime change; operators can start writing files |
| 3 | State record message and store access; the serializable transaction helper, which the authentication mutation moves onto | No callers but tests. Independent of 1 and 2 |
| 4 | Plan engine, text and JSON output, `memos config plan --detailed-exitcode` | Read-only against a real database; the first operational value. Needs 1 to 3 |
| 5 | Apply, `memos config apply`, `memos config state` | CLI only, opt-in through a job; startup untouched |
| 6 | The guard in the mutating handlers; `GetConfigurationStatus` | Reads the state record, so it covers CLI-applied resources at once |
| 7 | `--config-apply` at startup, default `startup` | Startup integration only; everything it calls already exists |
| 8 | Web presentation: managed label, disabled controls, error display, the Configuration section | Last, after mockups |

Changes 1, 2, and 3 are independent and can proceed in parallel. The smallest useful release point is after 5: validate, plan, and apply
from a job.

## Test strategy

- Decoding: every kind; unknown, deprecated, output-only, and numeric-enum fields; substitution success, missing reference, embedded
  reference, escape; duplicate names across files; oversized file; symlink; missing directory.
- Plan: each action for each kind; adoption diff; drift marking; missing-without-`removed` error; `preventDestroy`; `ignoreChanges`
  excluded from diff and guard; `writeOnlyVersion` bump resends and no bump does not; ordering; authentication invariant over the end
  state; determinism (same inputs, byte-identical plan).
- Apply: idempotence (second apply is empty); atomic failure leaves rows and state record untouched; serial compare-and-set under two
  concurrent applies on every driver; cache reset; startup sequence and startup failure on an invalid plan.
- Guard: every guarded RPC refuses a managed-field change and accepts an unmanaged-field change, with the `ErrorInfo` detail; write-only
  and ignored fields pass.
- Status RPC: admin-only, no values in the response.
- Compatibility: fixtures from each release decode; a fixture with a removed field fails the test.
- Secrets: plan text and JSON, logs, state rows, and the status response contain no configured secret, checked by grepping test output
  for the planted values.

## Alternatives considered

**Field-level ownership for every kind (Kubernetes server-side apply).** It would let a file manage two fields of a setting group while
the UI manages the rest. It needs per-field managers, list merge semantics, and a conflict model, and the settings UI edits whole groups.
Whole-resource ownership with `ignoreChanges` covers the real cases with one concept.

**Dedicated state tables.** A `configuration_run` row and a `configuration_resource` row per managed resource. Queryable by SQL and
indexed by name, at the cost of two tables in three drivers plus `LATEST.sql`, for a record of tens of entries that is read once per apply
and cached in process. The single document keeps every property the design needs; the tables can be introduced later if the record
ever outgrows a row.

**Columns on the resource tables.** A `managed_source` column on `idp`, `system_setting`, and `user`, as Kubernetes keeps `managedFields`
on each object. More invasive than the tables above, since it alters three existing tables in three drivers, and awkward for singleton
setting groups.

**A state file in `--data`.** Terraform's literal design. It breaks with several replicas, is not in the same transaction as the resources,
and diverges from database backups.

**Runtime override without state.** Load files into memory, let them shadow database rows for the process lifetime, write nothing. It
needs no tables and no plan, but it cannot answer what happens when a file disappears, cannot show an administrator what is managed
without re-reading files on every replica, has no drift concept, and ties the file format to internal storage messages that have no
compatibility policy.

**Implicit destroy (Terraform's default).** Rejected for the reasons given under "Removal is explicit".

**Explicit import (Terraform's default).** Rejected for the reasons given under "Adoption is implicit".

**Environment variables.** Fine for a dozen scalars; identity providers, storage registries, and AI provider lists are nested and
repeated. Substitution gives environment variables their proper role, carrying secrets into a structured document.

**HCL or YAML.** HCL is Terraform's and would need a new parser and a schema mapping; YAML is a superset of JSON and adds a dependency for
comments and less quoting. Protobuf JSON is already the API's wire format and needs nothing new. YAML remains an open question.

## Open questions

- YAML input alongside JSON.
- A `PlanConfiguration` RPC so the status page can show drift without shell access; it needs the files on the serving replica.
- Further kinds once the machinery exists: spaces, user webhooks, personal access tokens for automation.
- Whether `memos config apply` should refuse to run against a database a newer Memos version has migrated.

## References

- Terraform: [State](https://developer.hashicorp.com/terraform/language/state),
  [`lifecycle` meta-argument](https://developer.hashicorp.com/terraform/language/meta-arguments/lifecycle),
  [`import` blocks](https://developer.hashicorp.com/terraform/language/import),
  [`removed` blocks](https://developer.hashicorp.com/terraform/language/resources/syntax#removing-resources),
  [write-only arguments](https://developer.hashicorp.com/terraform/language/resources/ephemeral/write-only),
  [`plan -detailed-exitcode`](https://developer.hashicorp.com/terraform/cli/commands/plan#detailed-exitcode)
- Kubernetes: [Declarative management with `kubectl apply`](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/declarative-config/),
  [Server-side apply and field management](https://kubernetes.io/docs/reference/using-api/server-side-apply/)
- Argo CD: [Automated sync, prune, and self-heal](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/)
- Grafana: [Provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
- Keycloak: [Importing and exporting realms](https://www.keycloak.org/server/importExport)
- Google AIP: [AIP-122 Resource names](https://google.aip.dev/122), [AIP-193 Errors](https://google.aip.dev/193),
  [AIP-203 Field behavior](https://google.aip.dev/203)
