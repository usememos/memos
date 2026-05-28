package v1

import (
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func convertMotionMediaFromStore(motion *storepb.MotionMedia) *v1pb.MotionMedia {
	if motion == nil {
		return nil
	}

	return &v1pb.MotionMedia{
		Family:                  v1pb.MotionMediaFamily(motion.Family),
		Role:                    v1pb.MotionMediaRole(motion.Role),
		GroupId:                 motion.GroupId,
		PresentationTimestampUs: motion.PresentationTimestampUs,
		HasEmbeddedVideo:        motion.HasEmbeddedVideo,
	}
}

func convertMotionMediaToStore(motion *v1pb.MotionMedia) *storepb.MotionMedia {
	if motion == nil {
		return nil
	}

	return &storepb.MotionMedia{
		Family:                  storepb.MotionMediaFamily(motion.Family),
		Role:                    storepb.MotionMediaRole(motion.Role),
		GroupId:                 motion.GroupId,
		PresentationTimestampUs: motion.PresentationTimestampUs,
		HasEmbeddedVideo:        motion.HasEmbeddedVideo,
	}
}

func getAttachmentMotionMedia(attachment *store.Attachment) *storepb.MotionMedia {
	if attachment == nil || attachment.Payload == nil {
		return nil
	}
	return attachment.Payload.MotionMedia
}

func isAndroidMotionContainer(motion *storepb.MotionMedia) bool {
	return motion != nil &&
		motion.Family == storepb.MotionMediaFamily_ANDROID_MOTION_PHOTO &&
		motion.Role == storepb.MotionMediaRole_CONTAINER &&
		motion.HasEmbeddedVideo
}

func ensureAttachmentPayload(payload *storepb.AttachmentPayload) *storepb.AttachmentPayload {
	if payload != nil {
		return payload
	}
	return &storepb.AttachmentPayload{}
}

func isMultiMemberMotionGroup(attachments []*store.Attachment) bool {
	if len(attachments) < 2 {
		return false
	}
	for _, attachment := range attachments {
		motion := getAttachmentMotionMedia(attachment)
		if motion == nil || motion.GroupId == "" {
			return false
		}
	}
	return true
}
