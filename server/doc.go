// Package server is the HTTP process: it boots the net/http server, mounts every
// transport (server/api, server/fileserver, server/frontend, server/mcp),
// and owns HTTP-only concerns such as auth tokens and process configuration.
//
// Layering: server may import core, store, provider, markdown, filter, and
// internal. Nothing imports server except cmd.
package server
