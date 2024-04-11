package store

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/pkg/errors"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// MigrateWorkspaceSetting migrates workspace setting from v1 to v2.
func (s *Store) MigrateWorkspaceSetting(ctx context.Context) error {
	workspaceSettings, err := s.ListWorkspaceSettings(ctx, &FindWorkspaceSetting{})
	if err != nil {
		return errors.Wrap(err, "failed to list workspace settings")
	}

	workspaceBasicSetting, err := s.GetWorkspaceBasicSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get workspace basic setting")
	}

	workspaceGeneralSetting, err := s.GetWorkspaceGeneralSetting(ctx)
	if err != nil {
		return errors.Wrap(err, "failed to get workspace general setting")
	}

	for _, workspaceSetting := range workspaceSettings {
		matched := true
		var baseValue any
		// nolint
		json.Unmarshal([]byte(workspaceSetting.Value), &baseValue)
		if workspaceSetting.Name == "server-id" {
			workspaceBasicSetting.ServerId = workspaceSetting.Value
		} else if workspaceSetting.Name == "secret-session" {
			workspaceBasicSetting.SecretKey = workspaceSetting.Value
		} else if workspaceSetting.Name == "allow-signup" {
			workspaceGeneralSetting.DisallowSignup = !baseValue.(bool)
		} else if workspaceSetting.Name == "disable-password-login" {
			workspaceGeneralSetting.DisallowPasswordLogin = baseValue.(bool)
		} else if workspaceSetting.Name == "additional-style" {
			workspaceGeneralSetting.AdditionalStyle = baseValue.(string)
		} else if workspaceSetting.Name == "additional-script" {
			workspaceGeneralSetting.AdditionalScript = baseValue.(string)
		} else if workspaceSetting.Name == "instance-url" {
			workspaceGeneralSetting.InstanceUrl = workspaceSetting.Value
		} else {
			matched = false
		}

		if matched {
			if err := s.DeleteWorkspaceSetting(ctx, &DeleteWorkspaceSetting{
				Name: workspaceSetting.Name,
			}); err != nil {
				return errors.Wrap(err, fmt.Sprintf("failed to delete workspace setting: %s", workspaceSetting.Name))
			}
		}
	}

	if _, err := s.UpsertWorkspaceSettingV1(ctx, &storepb.WorkspaceSetting{
		Key:   storepb.WorkspaceSettingKey_WORKSPACE_SETTING_BASIC,
		Value: &storepb.WorkspaceSetting_BasicSetting{BasicSetting: workspaceBasicSetting},
	}); err != nil {
		return errors.Wrap(err, "failed to upsert workspace basic setting")
	}

	if _, err := s.UpsertWorkspaceSettingV1(ctx, &storepb.WorkspaceSetting{
		Key:   storepb.WorkspaceSettingKey_WORKSPACE_SETTING_GENERAL,
		Value: &storepb.WorkspaceSetting_GeneralSetting{GeneralSetting: workspaceGeneralSetting},
	}); err != nil {
		return errors.Wrap(err, "failed to upsert workspace general setting")
	}

	return nil
}
