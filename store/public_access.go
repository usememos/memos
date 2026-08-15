package store

import (
	"context"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// AllowPublicAccess reports whether anonymous visitors may access public
// instance content, per the persisted GENERAL setting allow_public_access.
//
// The read goes through the normal instance-setting cache, and every read or
// update synchronizes the in-memory policy on the profile, so toggling the
// setting takes effect immediately without a per-request database query. A read
// failure fails closed and leaves the instance private.
func (s *Store) AllowPublicAccess(ctx context.Context) bool {
	if s == nil {
		return false
	}
	setting, err := s.GetInstanceGeneralSetting(ctx)
	if err != nil {
		s.profile.SetAllowAnonymous(false)
		return false
	}
	allowed := setting.GetAllowPublicAccess()
	s.profile.SetAllowAnonymous(allowed)
	return allowed
}

// syncPublicAccessPolicy publishes the persisted policy after the GENERAL
// setting changes. Deployment-configured GENERAL settings are already resolved
// inside the upserted value, so the same sync applies.
func (s *Store) syncPublicAccessPolicy(setting *storepb.InstanceGeneralSetting) {
	if s.profile != nil {
		s.profile.SetAllowAnonymous(setting.GetAllowPublicAccess())
	}
}
