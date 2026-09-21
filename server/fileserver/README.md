# Fileserver Package

> Moved to [`.archcore/fileserver/serving-contract.spec.md`](../../.archcore/fileserver/serving-contract.spec.md).

## Authorization

- Unlinked attachment (no memo): creator or admin only

## Serving behavior

- **Caching**: public attachments get `public, no-cache`; private ones `private, no-store`; avatars and thumbnails `public, max-age=3600`.
