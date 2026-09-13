package v1

import (
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func convertMemoViewIconFromStore(icon *storepb.MemoViewsUserSetting_MemoView_Icon) *v1pb.MemoView_Icon {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *storepb.MemoViewsUserSetting_MemoView_Icon_Emoji:
		return &v1pb.MemoView_Icon{Value: &v1pb.MemoView_Icon_Emoji{Emoji: value.Emoji}}
	case *storepb.MemoViewsUserSetting_MemoView_Icon_Lucide:
		return &v1pb.MemoView_Icon{Value: &v1pb.MemoView_Icon_Lucide{Lucide: value.Lucide}}
	default:
		return nil
	}
}

func convertMemoViewIconToStore(icon *v1pb.MemoView_Icon) *storepb.MemoViewsUserSetting_MemoView_Icon {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *v1pb.MemoView_Icon_Emoji:
		return &storepb.MemoViewsUserSetting_MemoView_Icon{Value: &storepb.MemoViewsUserSetting_MemoView_Icon_Emoji{Emoji: value.Emoji}}
	case *v1pb.MemoView_Icon_Lucide:
		return &storepb.MemoViewsUserSetting_MemoView_Icon{Value: &storepb.MemoViewsUserSetting_MemoView_Icon_Lucide{Lucide: value.Lucide}}
	default:
		// Preserve an empty icon so validation rejects it instead of treating it as a reset.
		return &storepb.MemoViewsUserSetting_MemoView_Icon{}
	}
}
