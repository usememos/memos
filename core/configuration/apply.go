package configuration

import (
	"context"
	stderrors "errors"
	"strings"
	"time"

	"github.com/pkg/errors"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"

	coreuser "github.com/usememos/memos/core/user"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// ApplyMetadata says who applied, for the state record.
type ApplyMetadata struct {
	// AppliedBy names the apply path and host, such as "cli host-1".
	AppliedBy string
	// Version is the Memos version applying.
	Version string
	// Now is the time to record.
	Now time.Time
}

// errPlanInvalid ends the apply transaction without writing.
var errPlanInvalid = stderrors.New("the plan cannot be applied")

// Apply plans desired against the instance inside one serializable
// transaction and, when the plan is valid and has changes, writes it and the
// state record in that same transaction: an apply either completes or changes
// nothing. It returns the plan it applied; a plan with errors is returned
// with them and nothing is written. The state is the record after the apply.
func Apply(ctx context.Context, desired *Desired, s *store.Store, metadata ApplyMetadata) (*Plan, *storepb.InstanceConfigurationState, error) {
	var applied *Plan
	state, err := s.RunConfigurationTransaction(ctx, func(ctx context.Context, tx *store.ConfigurationTransaction) (*storepb.InstanceConfigurationState, error) {
		plan, err := ComputePlan(ctx, desired, tx)
		if err != nil {
			return nil, err
		}
		applied = plan
		if !plan.Valid() {
			return nil, errPlanInvalid
		}
		if !plan.HasChanges() {
			return nil, nil
		}
		for _, op := range plan.operations {
			if err := applyOperation(ctx, tx, op, metadata.Now); err != nil {
				return nil, errors.Wrap(err, op.change.Resource)
			}
		}
		next := proto.CloneOf(plan.next)
		next.AppliedTs = metadata.Now.Unix()
		next.AppliedBy = metadata.AppliedBy
		next.Version = metadata.Version
		for _, resource := range next.Resources {
			if resource.AppliedTs == 0 {
				resource.AppliedTs = metadata.Now.Unix()
			}
		}
		return next, nil
	})
	if errors.Is(err, errPlanInvalid) {
		return applied, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}
	return applied, state, nil
}

func applyOperation(ctx context.Context, tx *store.ConfigurationTransaction, op *operation, now time.Time) error {
	action := op.change.Action
	switch action {
	case apipb.ResourceChange_NO_OP, apipb.ResourceChange_RELEASE:
		return nil
	case apipb.ResourceChange_CREATE, apipb.ResourceChange_ADOPT, apipb.ResourceChange_UPDATE:
		if action == apipb.ResourceChange_ADOPT && len(op.change.FieldChanges) == 0 {
			// The stored value already is the declared one.
			return nil
		}
	case apipb.ResourceChange_DESTROY, apipb.ResourceChange_RESET:
	default:
		return errors.Errorf("unexpected action %s", action)
	}

	switch op.kind {
	case KindIdentityProvider:
		switch {
		case action == apipb.ResourceChange_DESTROY:
			return tx.DeleteIdentityProvider(ctx, op.providerID)
		case op.providerID != 0:
			return tx.ReplaceIdentityProvider(ctx, op.providerID, op.provider)
		default:
			return tx.CreateIdentityProvider(ctx, op.provider)
		}
	case KindInstanceSetting:
		if action != apipb.ResourceChange_RESET {
			return tx.UpsertInstanceSetting(ctx, op.setting)
		}
		// ACCESS is written explicitly: a missing row would be initialized at
		// the next start from the legacy instance URL rule.
		if op.settingKey == storepb.InstanceSettingKey_ACCESS {
			return tx.UpsertInstanceSetting(ctx, &storepb.InstanceSetting{
				Key: storepb.InstanceSettingKey_ACCESS,
				Value: &storepb.InstanceSetting_AccessSetting{AccessSetting: &storepb.InstanceAccessSetting{
					AccessMode: storepb.InstanceAccessMode_INSTANCE_ACCESS_MODE_PRIVATE,
				}},
			})
		}
		return tx.DeleteInstanceSetting(ctx, op.settingKey)
	default:
		return applyUser(ctx, tx, op, now)
	}
}

// applyUser writes exactly the fields the plan lists, which already leave out
// ignored fields, undeclared profile fields, and values that did not change.
func applyUser(ctx context.Context, tx *store.ConfigurationTransaction, op *operation, now time.Time) error {
	role := coreuser.RoleToStore(op.user.Role)
	var passwordHash string
	for _, field := range op.change.FieldChanges {
		if field.Path == "password" {
			hash, err := bcrypt.GenerateFromPassword([]byte(op.user.Password), bcrypt.DefaultCost)
			if err != nil {
				return errors.Wrap(err, "failed to hash the password")
			}
			passwordHash = string(hash)
		}
	}

	if op.actualUser == nil {
		_, err := tx.CreateUser(ctx, &store.User{
			Username:     op.user.Username,
			Role:         role,
			Email:        op.user.Email,
			Nickname:     op.user.DisplayName,
			PasswordHash: passwordHash,
		})
		return err
	}
	if len(op.change.FieldChanges) == 0 {
		return nil
	}
	updatedTsSec := now.Unix()
	update := &store.UpdateUser{ID: op.actualUser.ID, UpdatedTs: &updatedTsSec}
	for _, field := range op.change.FieldChanges {
		switch field.Path {
		case "role":
			update.Role = &role
		case "displayName":
			update.Nickname = &op.user.DisplayName
		case "email":
			update.Email = &op.user.Email
		case "password":
			update.PasswordHash = &passwordHash
		default:
		}
	}
	return tx.UpdateUser(ctx, update)
}

// copyFields sets each JSON-name path of dst to its value in src, clearing it
// where src has none. Paths name singular fields, as ignoreChanges must.
func copyFields(dst, src proto.Message, paths []string) {
	for _, path := range paths {
		segments := strings.Split(path, ".")
		to, from := dst.ProtoReflect(), src.ProtoReflect()
		fromSet := true
		for i, segment := range segments {
			field := to.Descriptor().Fields().ByJSONName(segment)
			if field == nil {
				break
			}
			if i == len(segments)-1 {
				if fromSet && from.Has(field) {
					to.Set(field, cloneValue(from.Get(field)))
				} else {
					to.Clear(field)
				}
				break
			}
			if fromSet && from.Has(field) {
				from = from.Get(field).Message()
			} else {
				fromSet = false
			}
			to = to.Mutable(field).Message()
		}
	}
}

// cloneValue copies a message value so dst never shares it with src; scalars
// and lists of scalars are immutable from here on and are shared as they are.
func cloneValue(value protoreflect.Value) protoreflect.Value {
	if message, ok := value.Interface().(protoreflect.Message); ok {
		return protoreflect.ValueOfMessage(proto.Clone(message.Interface()).ProtoReflect())
	}
	return value
}
