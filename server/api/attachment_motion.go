package api

import (
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

func convertMotionMediaFromStore(motion *storepb.MotionMedia) *apipb.MotionMedia {
	if motion == nil {
		return nil
	}

	return &apipb.MotionMedia{
		Family:                  apipb.MotionMediaFamily(motion.Family),
		Role:                    apipb.MotionMediaRole(motion.Role),
		GroupId:                 motion.GroupId,
		PresentationTimestampUs: motion.PresentationTimestampUs,
		HasEmbeddedVideo:        motion.HasEmbeddedVideo,
	}
}

func convertMotionMediaToStore(motion *apipb.MotionMedia) *storepb.MotionMedia {
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
