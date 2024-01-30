package v2

import (
	"context"
	"encoding/base64"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"

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

func getCurrentUser(ctx context.Context, s *store.Store) (*store.User, error) {
	username, ok := ctx.Value(usernameContextKey).(string)
	if !ok {
		return nil, nil
	}
	user, err := s.GetUser(ctx, &store.FindUser{
		Username: &username,
	})
	if err != nil {
		return nil, err
	}
	return user, nil
}

func getPageToken(limit int, offset int) (string, error) {
	return marshalPageToken(&apiv2pb.PageToken{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
}

func marshalPageToken(pageToken *apiv2pb.PageToken) (string, error) {
	b, err := proto.Marshal(pageToken)
	if err != nil {
		return "", errors.Wrapf(err, "failed to marshal page token")
	}
	return base64.StdEncoding.EncodeToString(b), nil
}

func unmarshalPageToken(s string, pageToken *apiv2pb.PageToken) error {
	b, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return errors.Wrapf(err, "failed to decode page token")
	}
	if err := proto.Unmarshal(b, pageToken); err != nil {
		return errors.Wrapf(err, "failed to unmarshal page token")
	}
	return nil
}
