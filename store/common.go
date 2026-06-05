package store

import "google.golang.org/protobuf/encoding/protojson"

var (
	protojsonUnmarshaler = protojson.UnmarshalOptions{
		AllowPartial:   true,
		DiscardUnknown: true,
	}
)

// RowStatus is the status for a row.
type RowStatus string

const (
	// Normal is the status for a normal row.
	Normal RowStatus = "NORMAL"
	// Archived is the status for an archived row.
	Archived RowStatus = "ARCHIVED"
	// Draft is the status for an unpublished draft memo row.
	Draft RowStatus = "DRAFT"
)

func (r RowStatus) String() string {
	return string(r)
}
