package api

// RowStatus is the status for a row.
type RowStatus string

const (
	// Normal is the status for a normal row.
	Normal RowStatus = "NORMAL"
	// Archived is the status for an archived row.
	Archived RowStatus = "ARCHIVED"
)

func (e RowStatus) String() string {
	switch e {
	case Normal:
		return "NORMAL"
	case Archived:
		return "ARCHIVED"
	}
	return ""
}
