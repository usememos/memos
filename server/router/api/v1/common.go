package v1

import (
	"encoding/base64"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

const (
	// DefaultPageSize is the default page size for requests.
	DefaultPageSize = 10
	// MaxPageSize is the maximum page size for requests.
	MaxPageSize = 1000
)

func convertStateFromStore(rowStatus store.RowStatus) v1pb.State {
	switch rowStatus {
	case store.Normal:
		return v1pb.State_NORMAL
	case store.Archived:
		return v1pb.State_ARCHIVED
	default:
		return v1pb.State_STATE_UNSPECIFIED
	}
}

func convertStateToStore(state v1pb.State) store.RowStatus {
	switch state {
	case v1pb.State_ARCHIVED:
		return store.Archived
	default:
		return store.Normal
	}
}

func getPageToken(limit int, offset int) (string, error) {
	return marshalPageToken(&v1pb.PageToken{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
}

func marshalPageToken(pageToken *v1pb.PageToken) (string, error) {
	b, err := proto.Marshal(pageToken)
	if err != nil {
		return "", errors.Wrapf(err, "failed to marshal page token")
	}
	return base64.StdEncoding.EncodeToString(b), nil
}

func unmarshalPageToken(s string, pageToken *v1pb.PageToken) error {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return errors.Wrapf(err, "failed to decode page token")
	}
	if err := proto.Unmarshal(b, pageToken); err != nil {
		return errors.Wrapf(err, "failed to unmarshal page token")
	}
	return nil
}

func isSuperUser(user *store.User) bool {
	return user.Role == store.RoleAdmin
}
