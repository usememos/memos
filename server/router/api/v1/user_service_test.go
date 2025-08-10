package v1

import (
	"reflect"
	"testing"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	storepb "github.com/usememos/memos/proto/gen/store"
)

func TestMergeUserSettingWithMask(t *testing.T) {
	tests := []struct {
		name     string
		existing *storepb.UserSetting
		incoming *v1pb.UserSetting
		key      storepb.UserSetting_Key
		paths    []string
		expected *v1pb.UserSetting
	}{
		{
			name: "adds new field without removing existing fields",
			existing: &storepb.UserSetting{
				UserId: 1,
				Key:    storepb.UserSetting_GENERAL,
				Value: &storepb.UserSetting_General{
					General: &storepb.GeneralUserSetting{
						MemoVisibility: "PROTECTED",
					},
				},
			},
			incoming: &v1pb.UserSetting{
				Value: &v1pb.UserSetting_GeneralSetting_{
					GeneralSetting: &v1pb.UserSetting_GeneralSetting{
						Appearance: "light",
					},
				},
			},
			key:   storepb.UserSetting_GENERAL,
			paths: []string{"appearance"},
			expected: &v1pb.UserSetting{
				Value: &v1pb.UserSetting_GeneralSetting_{
					GeneralSetting: &v1pb.UserSetting_GeneralSetting{
						Appearance:     "light",
						MemoVisibility: "PROTECTED",
					},
				},
			},
		},
		{
			name: "adds new field when no existing fields exist",
			existing: &storepb.UserSetting{
				UserId: 1,
				Key:    storepb.UserSetting_GENERAL,
				Value:  &storepb.UserSetting_General{},
			},
			incoming: &v1pb.UserSetting{
				Value: &v1pb.UserSetting_GeneralSetting_{
					GeneralSetting: &v1pb.UserSetting_GeneralSetting{
						Theme: "whitewall",
					},
				},
			},
			key:   storepb.UserSetting_GENERAL,
			paths: []string{"theme"},
			expected: &v1pb.UserSetting{
				Value: &v1pb.UserSetting_GeneralSetting_{
					GeneralSetting: &v1pb.UserSetting_GeneralSetting{
						Theme: "whitewall",
					},
				},
			},
		},
		{
			name: "updates existing field without removing existing fields",
			existing: &storepb.UserSetting{
				UserId: 1,
				Key:    storepb.UserSetting_GENERAL,
				Value: &storepb.UserSetting_General{
					General: &storepb.GeneralUserSetting{
						Appearance:     "dark",
						MemoVisibility: "PUBLIC",
					},
				},
			},
			incoming: &v1pb.UserSetting{
				Value: &v1pb.UserSetting_GeneralSetting_{
					GeneralSetting: &v1pb.UserSetting_GeneralSetting{
						Appearance: "light",
					},
				},
			},
			key:   storepb.UserSetting_GENERAL,
			paths: []string{"appearance"},
			expected: &v1pb.UserSetting{
				Value: &v1pb.UserSetting_GeneralSetting_{
					GeneralSetting: &v1pb.UserSetting_GeneralSetting{
						Appearance:     "light",
						MemoVisibility: "PUBLIC",
					},
				},
			},
		},
		{
			name: "updates multiple fields without removing existing fields",
			existing: &storepb.UserSetting{
				UserId: 1,
				Key:    storepb.UserSetting_GENERAL,
				Value: &storepb.UserSetting_General{
					General: &storepb.GeneralUserSetting{
						Appearance: "system",
					},
				},
			},
			incoming: &v1pb.UserSetting{
				Value: &v1pb.UserSetting_GeneralSetting_{
					GeneralSetting: &v1pb.UserSetting_GeneralSetting{
						Appearance:     "dark",
						Theme:          "paper",
						MemoVisibility: "PROTECTED",
					},
				},
			},
			key:   storepb.UserSetting_GENERAL,
			paths: []string{"theme", "memoVisibility", "appearance"},
			expected: &v1pb.UserSetting{
				Value: &v1pb.UserSetting_GeneralSetting_{
					GeneralSetting: &v1pb.UserSetting_GeneralSetting{
						Appearance:     "dark",
						MemoVisibility: "PROTECTED",
						Theme:          "paper",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			actual := mergeUserSettingWithMask(tt.existing, tt.incoming, tt.key, tt.paths)

			if !reflect.DeepEqual(actual, tt.expected) {
				t.Errorf("expected %v but got %v", tt.expected, actual)
			}
		})
	}
}
