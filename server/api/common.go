package api

import (
	"encoding/base64"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"

	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

const (
	// DefaultPageSize is the default page size for requests.
	DefaultPageSize = 50
	// MaxPageSize is the maximum page size for requests.
	MaxPageSize = 1000
)

func convertStateFromStore(rowStatus store.RowStatus) apipb.State {
	switch rowStatus {
	case store.Normal:
		return apipb.State_NORMAL
	case store.Archived:
		return apipb.State_ARCHIVED
	default:
		return apipb.State_STATE_UNSPECIFIED
	}
}

func convertStateToStore(state apipb.State) store.RowStatus {
	switch state {
	case apipb.State_ARCHIVED:
		return store.Archived
	default:
		return store.Normal
	}
}

func getPageToken(limit int, offset int) (string, error) {
	return marshalPageToken(&apipb.PageToken{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
}

func normalizePageSize(pageSize int32) int {
	limit := int(pageSize)
	if limit <= 0 {
		return DefaultPageSize
	}
	if limit > MaxPageSize {
		return MaxPageSize
	}
	return limit
}

func marshalPageToken(pageToken *apipb.PageToken) (string, error) {
	b, err := proto.Marshal(pageToken)
	if err != nil {
		return "", errors.Wrapf(err, "failed to marshal page token")
	}
	return base64.StdEncoding.EncodeToString(b), nil
}

func unmarshalPageToken(s string, pageToken *apipb.PageToken) error {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return errors.Wrapf(err, "failed to decode page token")
	}
	if err := proto.Unmarshal(b, pageToken); err != nil {
		return errors.Wrapf(err, "failed to unmarshal page token")
	}
	return nil
}
