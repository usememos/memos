# Public Access

Status: Implemented

## Summary

Whether anonymous visitors may browse an instance is controlled by an explicit administrator setting, not by the canonical instance URL. A fresh or unconfigured instance is private by default.

## Behavior

When public access is **disabled** (the default):

- Anonymous visitors are redirected to the sign-in page in the web UI.
- Anonymous API requests are limited to setup, sign-in, sign-up, identity-provider discovery, and share-token routes.
- Attachments and avatars require authentication.
- RSS feeds (`/explore/rss.xml`, `/u/:username/rss.xml`) return `404`.

When public access is **enabled**:

- Anonymous visitors may browse public memos in Explore and public user profiles.
- Attachments linked from public memos and user avatars are served without authentication.
- RSS feeds for public memos are available.

Authenticated users are never restricted by this setting. Memo visibility (public, protected, private) continues to be enforced independently. Share-token routes keep working on private instances.

## Configuration

Toggle **Settings > System > Access > Allow public access** as an administrator. The change takes effect immediately after saving; no restart is required.

Deployment-managed instances (a `memos-instance-setting-GENERAL.json` file in `/etc/secrets`) reject changes to the whole GENERAL setting with a failed-precondition error, as with the other options on that page.

## Relationship to `MEMOS_INSTANCE_URL`

`--instance-url` / `MEMOS_INSTANCE_URL` remains the canonical URL used for link generation, OAuth redirect URLs, RSS enclosure URLs, and deployment metadata. It no longer influences access control. You can:

- Keep the instance private while still configuring a canonical URL.
- Allow public access without configuring a canonical URL, although a canonical URL is recommended so generated links are stable.

## Upgrade note

Earlier releases treated a non-empty instance URL as permission for anonymous access. After upgrading, such instances remain configured with the URL but become private until an administrator enables **Allow public access**.
