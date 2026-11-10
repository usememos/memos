package store

// Encryption persistence keeps wrapped vault keys out of user settings and user
// listings. MemoPayload.EncryptedContent is protocol JSON, never plaintext. The
// memo_encryption registry supplies SQL uniqueness and compare-and-swap without
// depending on driver-specific JSON extraction. Its revision advances in the
// same transaction as the payload; failed writes roll both back. Encryption kind
// cannot change, so preflight rejection of relations and attachments cannot race
// a later plaintext-to-encrypted conversion. Transactional mutation endpoints
// repeat these checks before applying bindings and relations. MySQL and SQLite remove
// encryption rows explicitly in their existing deletion transactions; PostgreSQL
// uses cascading foreign keys. SQLite config disables FK enforcement. Vault creation and MySQL encrypted
// memo creation lock the live owner before inserting, matching account deletion.
// Additional MySQL cascade constraints triggered intermittent error 1615
// (prepared statement needs to be re-prepared) in full-store deletion tests;
// explicit cleanup follows the existing driver lifecycle pattern.
//
// A full database backup must include encryption_vault, encryption_passkey, memo_encryption, and
// memo together. Restores preserve vault/object IDs exactly. Portable memo
// export/import intentionally does not support encrypted records.
//
// Version 1 accepts canonical RFC 4122 UUID v4 identifiers, standard padded base64, AES-GCM 12-byte
// nonces, and 48-byte wrapped keys (32-byte keys plus a 16-byte tag). Body
// ciphertext is capped at 1 MiB plus its 16-byte tag; envelope JSON is capped at
// 1.5 MiB and vault JSON at 4096 bytes. Version 1 fixes Argon2id to 64 MiB,
// 3 iterations, 4 lanes, a 16-byte salt, and 32-byte output. The server validates
// shape, bounds, identity, and revision; it cannot authenticate ciphertext or
// enforce plaintext semantics.
//
// Optional passkey wrappers live separately so v1 vault readers and passphrase
// changes preserve them. Enrollment locks the user before checking vault identity,
// uniqueness and the ten-record cap. Passkey JSON is capped at 4096 bytes and
// includes a canonical unpadded base64url credential ID (1–1024 decoded bytes),
// a lowercase ASCII hostname RP ID, and a 32-byte standard-base64 PRF salt. The server
// never receives PRF output and adds no WebAuthn login or signature verification.
