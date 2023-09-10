package v2

import (
	apiv2pb "github.com/usememos/memos/proto/gen/api/v2"
	"github.com/usememos/memos/store"
)

func convertRowStatusFromStore(rowStatus store.RowStatus) apiv2pb.RowStatus {
	switch rowStatus {
	case store.Normal:
		return apiv2pb.RowStatus_ACTIVE
	case store.Archived:
		return apiv2pb.RowStatus_ARCHIVED
	default:
		return apiv2pb.RowStatus_ROW_STATUS_UNSPECIFIED
	}
}

func convertRowStatusToStore(rowStatus apiv2pb.RowStatus) store.RowStatus {
	switch rowStatus {
	case apiv2pb.RowStatus_ACTIVE:
		return store.Normal
	case apiv2pb.RowStatus_ARCHIVED:
		return store.Archived
	default:
		return store.Normal
	}
}
