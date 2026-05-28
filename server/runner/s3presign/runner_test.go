package s3presign

import (
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestCloneAttachmentPayloadPreservesMotionMedia(t *testing.T) {
	payload := &storepb.AttachmentPayload{
		Payload: &storepb.AttachmentPayload_S3Object_{
			S3Object: &storepb.AttachmentPayload_S3Object{
				Key: "photos/live.jpg",
			},
		},
		MotionMedia: &storepb.MotionMedia{
			Family:  storepb.MotionMediaFamily_ANDROID_MOTION_PHOTO,
			Role:    storepb.MotionMediaRole_CONTAINER,
			GroupId: "motion-group",
		},
	}

	cloned := cloneAttachmentPayload(payload)
	require.NotNil(t, cloned)
	require.NotSame(t, payload, cloned)
	require.Equal(t, payload.MotionMedia, cloned.MotionMedia)

	cloned.GetS3Object().LastPresignedTime = timestamppb.Now()
	require.Nil(t, payload.GetS3Object().LastPresignedTime)
	require.Equal(t, "motion-group", cloned.MotionMedia.GroupId)
}
