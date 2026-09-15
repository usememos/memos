// Package store is the persistence layer: the Store facade, the Driver
// interface implemented by store/db/{sqlite,mysql,postgres,d1}, migrations, seed
// data, and the in-memory cache.
//
// Layering: store may import provider, markdown, filter, proto/gen, and
// internal. It must not import core or server; business rules that need
// several store calls live in core.
package store
