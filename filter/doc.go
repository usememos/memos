// Package filter compiles the CEL filter expressions accepted by the list
// endpoints into an intermediate representation and renders that IR into SQL
// for each database driver. The schema of filterable memo and user fields
// lives here.
//
// Layering: filter imports only third-party packages and internal. It must not
// import store, core, or server; the SQL drivers import filter, not the other
// way round.
package filter
