package v1

import (
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/store"
)

func (*APIV1Service) parseMemoOrderBy(orderBy string, memoFind *store.FindMemo) error {
	if strings.TrimSpace(orderBy) == "" {
		return errors.New("empty order_by")
	}

	// Split by comma to support multiple sort fields per AIP-132.
	fields := strings.Split(orderBy, ",")

	// Track if we've seen pinned field.
	hasPinned := false
	hasExplicitTimeField := false

	for _, field := range fields {
		parts := strings.Fields(strings.TrimSpace(field))
		if len(parts) == 0 {
			continue
		}

		fieldName := parts[0]
		fieldDirection := "desc" // default per AIP-132 (we use desc as default for time fields)
		if len(parts) > 1 {
			fieldDirection = strings.ToLower(parts[1])
			if fieldDirection != "asc" && fieldDirection != "desc" {
				return errors.Errorf("invalid order direction: %s, must be 'asc' or 'desc'", parts[1])
			}
		}

		switch fieldName {
		case "pinned":
			hasPinned = true
			memoFind.OrderByPinned = true
			// Note: pinned is always DESC (true first) regardless of direction specified.
		case "create_time", "name":
			// Only set if this is the first time field we encounter.
			if !hasExplicitTimeField {
				memoFind.OrderByTimeAsc = fieldDirection == "asc"
			}
			hasExplicitTimeField = true
		case "update_time":
			// Only set if this is the first time field we encounter.
			if !hasExplicitTimeField {
				memoFind.OrderByUpdatedTs = true
				memoFind.OrderByTimeAsc = fieldDirection == "asc"
			}
			hasExplicitTimeField = true
		default:
			return errors.Errorf("unsupported order field: %s, supported fields are: pinned, create_time, update_time, name", fieldName)
		}
	}

	// If only pinned was specified, still need to set a default time ordering.
	if hasPinned && !memoFind.OrderByUpdatedTs && len(fields) == 1 {
		memoFind.OrderByTimeAsc = false // default to desc
	}

	return nil
}
