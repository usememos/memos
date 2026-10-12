# provider

Backends that memos talks to on behalf of an instance, each configured by an
instance setting and reached through an interface so the implementation can be
swapped.

| Package | Backend |
| --- | --- |
| `ai/` | speech-to-text and audio-capable LLM providers (OpenAI, Gemini) |
| `idp/` | identity providers for SSO (OAuth2) |
| `storage/` | attachment object storage (local disk, S3) |

Layering: `provider` may import `proto/gen` and `internal`. It must not import
`store`, `core`, or `server`; `store` resolves the configured provider and hands
it to callers.
