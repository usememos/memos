---
title: "Operating deployment configuration"
status: draft
tags:
  - "config"
---

Status: Implemented.

Reader: an operator who runs Memos with deployment-configuration files on one or more server replicas. Task: roll out configuration and version changes safely, clean up provider copies left by the old bootstrap, and allow internal webhook destinations. Actor: the operator.

Every replica loads deployment configuration on its own at startup (@store/deployment_config.go), and Memos does no distributed reconciliation or cache invalidation for this process-local configuration. File-backed settings bypass the database setting cache, so a replica cannot replace a deployment value with a stale cached database value (@store/instance_setting.go).

## Prerequisites
- Administrator password access to Memos; it stays available when `disallowPasswordAuth` is enabled.
- A current database backup.
- A deployment platform that mounts the same files into `/etc/secrets` on every replica and can drain replicas before routing traffic.

## Steps
### Roll out a configuration change
1. Mount identical deployment-configuration files on every replica of one deployment.
2. For authentication or storage changes, choose a rollout that never routes traffic to replicas with different file generations.
3. Restart each replica so it loads the new files.
4. Report a replica ready only after its new snapshot validates and the server starts.

### Cross the version boundary that introduced `ACCESS`
Older replicas ignore `ACCESS` and keep the legacy rule: a nonempty instance URL permits anonymous access.
5. Drain all older replicas before changing `ACCESS`.
6. Drain all older replicas before routing traffic to replicas whose policy differs from the legacy rule.
7. Never serve traffic from old and new replicas with different effective access policies.

### Roll back across the `ACCESS` boundary
8. Set the legacy instance URL to match the intended policy: nonempty for public, empty for private.
9. Drain the newer replicas.
10. Complete the rollback.

### Clean up provider copies from the database-writing bootstrap
Versions with the original `memos-idp-*.json` bootstrap copied providers, including client secrets, into the `idp` table. The loader does not delete them.
11. Back up the database and confirm administrator password access.
12. Remove the identity-provider file temporarily and restart Memos, so the stored provider is no longer shadowed.
13. Delete or update the stored provider through the administrator UI or API, or with equivalent offline database maintenance.
14. Restore the file and restart Memos.

### Allow internal webhook destinations
Webhook delivery blocks private and reserved IP destinations by default (@internal/webhook/validate.go).
15. List only the required exact hostnames, IP addresses, or CIDRs.
16. Pass them with `--webhook-private-network-allowlist`, or set `MEMOS_WEBHOOK_PRIVATE_NETWORK_ALLOWLIST`.
17. Repeat the flag or separate entries with commas.
18. Replace any `--allow-private-webhooks` flag or `MEMOS_ALLOW_PRIVATE_WEBHOOKS` variable with the allowlist.

```text
--webhook-private-network-allowlist hooks.internal,10.20.0.0/16
```

## Verification
- Each replica logs `loaded deployment configuration` with the expected `identityProviders` and `instanceSettings` counts.
- Each replica prints `Access mode: private` or `Access mode: public` at startup (@cmd/memos/main.go); all serving replicas print the same value.
- After cleanup, startup no longer logs `deployment identity provider shadows a stored provider`.
- Startup logs no deprecation warning for `--allow-private-webhooks`.

## Common Issues
- **An instance is anonymous-readable although stored `ACCESS` is `PRIVATE`.** Cause: an older replica still serves traffic with a nonempty instance URL. Fix: drain older replicas, or empty the instance URL before rollback.
- **An old provider and its secret reappear after a file is removed.** Cause: the stored copy from the old bootstrap was never cleaned up. Fix: run steps 11–14.
- **Replicas give different sign-in or storage behavior.** Cause: replicas mount different file generations. Fix: mount identical files and restart every replica.
- **A startup warning says `--allow-private-webhooks` is deprecated.** Cause: the legacy flag disables private-network protection globally. Fix: step 18.
- **Startup fails with `failed to configure private webhook destinations`.** Cause: an allowlist entry is empty or is not a hostname, IP address, or CIDR. Fix: correct the entry.
