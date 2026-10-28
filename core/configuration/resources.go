package configuration

import (
	"fmt"

	"github.com/pkg/errors"

	"github.com/usememos/memos/core/identityprovider"
	"github.com/usememos/memos/core/instancesetting"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// checkResources runs the rules each resource must meet before it is stored,
// the same rules the API applies, on every merged resource. A declared value
// is the whole value, so nothing is exempt as unchanged.
func checkResources(desired *Desired) []string {
	var problems []string
	report := func(name string, err error) {
		problems = append(problems, fmt.Sprintf("%s: %s: %v", desired.Sources[name], name, err))
	}
	config := desired.Configuration
	for _, provider := range config.IdentityProviders {
		if err := identityprovider.Validate(identityprovider.ToStore(provider)); err != nil {
			report(provider.GetName(), err)
		}
	}
	for _, setting := range config.InstanceSettings {
		stored, err := instanceSettingToStore(setting)
		if err != nil {
			report(setting.GetName(), err)
			continue
		}
		if err := instancesetting.Validate(stored); err != nil {
			report(setting.GetName(), err)
		}
	}
	for _, user := range config.Users {
		if user.GetEmail() != "" {
			if _, err := store.NormalizeEmail(user.GetEmail()); err != nil {
				report(user.GetName(), err)
			}
		}
	}
	return problems
}

// instanceSettingToStore converts a declared setting as apply will write it.
// Usage limits name users, which only a database can resolve, so each named
// user gets a stand-in ID here; the structural rules do not depend on which.
// Whether the users exist is checked when the configuration is planned.
func instanceSettingToStore(setting *apipb.InstanceSetting) (*storepb.InstanceSetting, error) {
	stored := instancesetting.ToStore(setting)
	switch stored.Key {
	case storepb.InstanceSettingKey_AI:
		instancesetting.NormalizeAISetting(stored.GetAiSetting())
	case storepb.InstanceSettingKey_USAGE_LIMITS:
		standInIDs := map[string]int32{}
		for _, limit := range setting.GetUsageLimitsSetting().GetLimits() {
			for _, name := range limit.GetUsers() {
				if kind, _, err := ParseResourceName(name); err != nil || kind != KindUser {
					return nil, errors.Errorf("usageLimitsSetting names %q, which is not a user name", name)
				}
				if _, ok := standInIDs[name]; !ok {
					standInIDs[name] = int32(len(standInIDs) + 1)
				}
			}
		}
		usageLimits, err := instancesetting.UsageLimitsToStore(setting.GetUsageLimitsSetting(), standInIDs)
		if err != nil {
			return nil, err
		}
		stored.Value = &storepb.InstanceSetting_UsageLimitsSetting{UsageLimitsSetting: usageLimits}
	default:
	}
	return stored, nil
}
