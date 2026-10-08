package api

import (
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func convertMemoViewIconFromStore(icon *storepb.MemoViewsUserSetting_MemoView_Icon) *apipb.MemoView_Icon {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *storepb.MemoViewsUserSetting_MemoView_Icon_Emoji:
		return &apipb.MemoView_Icon{Value: &apipb.MemoView_Icon_Emoji{Emoji: value.Emoji}}
	case *storepb.MemoViewsUserSetting_MemoView_Icon_Lucide:
		return &apipb.MemoView_Icon{Value: &apipb.MemoView_Icon_Lucide{Lucide: value.Lucide}}
	default:
		return nil
	}
}

func convertMemoViewIconToStore(icon *apipb.MemoView_Icon) *storepb.MemoViewsUserSetting_MemoView_Icon {
	if icon == nil {
		return nil
	}
	switch value := icon.Value.(type) {
	case *apipb.MemoView_Icon_Emoji:
		return &storepb.MemoViewsUserSetting_MemoView_Icon{Value: &storepb.MemoViewsUserSetting_MemoView_Icon_Emoji{Emoji: value.Emoji}}
	case *apipb.MemoView_Icon_Lucide:
		return &storepb.MemoViewsUserSetting_MemoView_Icon{Value: &storepb.MemoViewsUserSetting_MemoView_Icon_Lucide{Lucide: value.Lucide}}
	default:
		// Preserve an empty icon so validation rejects it instead of treating it as a reset.
		return &storepb.MemoViewsUserSetting_MemoView_Icon{}
	}
}
