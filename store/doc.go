// Package store is the persistence layer: the Store facade, the Driver
// interface implemented by store/db/{sqlite,mysql,postgres}, migrations, seed
// data, and the in-memory cache.
//
// Writes that must validate what they read run in runSerializable, which owns
// the transaction and its retries; a driver supplies only the SQL that differs
// by database, as methods that take the *sql.Tx.
//
// Layering: store may import provider, markdown, filter, proto/gen, and
// internal. It must not import core or server; business rules that need
// several store calls live in core.
package store
