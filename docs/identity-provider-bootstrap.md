# Identity Provider Bootstrap

Memos automatically reconciles OAuth2 identity providers from JSON files before the server starts. This is useful when a deployment platform provides configuration as mounted secret files.

By default, Memos scans `/etc/secrets` for files named `memos-idp-*.json`:

```bash
memos
```

For example, `/etc/secrets/memos-idp-primary.json` can contain:

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
      "scopes": ["profile", "email"],
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

Each file contains exactly one `memos.store.IdentityProvider` encoded as protobuf JSON. The database-generated numeric `id` must be omitted; `uid` is the provider's stable identifier.

After database migrations and demo seeding, Memos reads all matching files in filename order and validates every provider before writing anything. Each provider is then created or updated by its stable `uid`; providers omitted from the files are left unchanged. Reapplying the files is safe and updates credentials on restart, which supports secret rotation. Duplicate provider UIDs across files are rejected.

A missing directory or a directory without matching files is a normal no-op. If a matching file is unreadable, oversized, or invalid, Memos does not start. Files with other names are ignored so the directory can safely contain unrelated secrets. Keep files containing `clientSecret` outside source control and provide them through the deployment platform's secret-management facility.
