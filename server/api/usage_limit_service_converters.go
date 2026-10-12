package api

import (
	"github.com/usememos/memos/core/usagelimit"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
)

// convertUsageLimitFromStore converts a stored usage limit. username is the
// name of the user the limit applies to, or empty for a default.
func convertUsageLimitFromStore(limit *storepb.InstanceUsageLimitsSetting_UsageLimit, username string) *apipb.UsageLimit {
	return &apipb.UsageLimit{
		Name:       UsageLimitNamePrefix + limit.Uid,
		Metric:     apipb.UsageLimit_Metric(limit.Metric),
		User:       usageLimitUserName(username),
		Value:      limit.Value,
		CreateTime: limit.CreateTime,
		UpdateTime: limit.UpdateTime,
	}
}

// usageLimitUserName returns the user field of a usage limit: the user's
// resource name, or empty for a default.
func usageLimitUserName(username string) string {
	if username == "" {
		return ""
	}
	return BuildUserName(username)
}

func convertEffectiveLimitToProto(limit usagelimit.Limit) *apipb.UserUsage_EffectiveLimit {
	effective := &apipb.UserUsage_EffectiveLimit{Value: limit.Value}
	if limit.Source != "" {
		effective.UsageLimit = UsageLimitNamePrefix + limit.Source
	}
	return effective
}
