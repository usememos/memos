package v1

import (
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func convertUserTagIconFromStore(icon *storepb.UserTagMetadata_Icon) *v1pb.UserSetting_TagMetadata_Icon {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *storepb.UserTagMetadata_Icon_Emoji:
		return &v1pb.UserSetting_TagMetadata_Icon{Value: &v1pb.UserSetting_TagMetadata_Icon_Emoji{Emoji: value.Emoji}}
	case *storepb.UserTagMetadata_Icon_Lucide:
		return &v1pb.UserSetting_TagMetadata_Icon{Value: &v1pb.UserSetting_TagMetadata_Icon_Lucide{Lucide: value.Lucide}}
	default:
		return nil
	}
}

func convertUserTagIconToStore(icon *v1pb.UserSetting_TagMetadata_Icon) *storepb.UserTagMetadata_Icon {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *v1pb.UserSetting_TagMetadata_Icon_Emoji:
		return &storepb.UserTagMetadata_Icon{Value: &storepb.UserTagMetadata_Icon_Emoji{Emoji: value.Emoji}}
	case *v1pb.UserSetting_TagMetadata_Icon_Lucide:
		return &storepb.UserTagMetadata_Icon{Value: &storepb.UserTagMetadata_Icon_Lucide{Lucide: value.Lucide}}
	default:
		// Preserve an empty icon so validation rejects it instead of treating it as a reset.
		return &storepb.UserTagMetadata_Icon{}
	}
}
