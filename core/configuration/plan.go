package configuration

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/proto"

	"github.com/usememos/memos/core/identityprovider"
	"github.com/usememos/memos/core/instancesetting"
	coreuser "github.com/usememos/memos/core/user"
	apipb "github.com/usememos/memos/proto/gen/api"
	storepb "github.com/usememos/memos/proto/gen/store"
	"github.com/usememos/memos/store"
)

// Reader is what a plan reads from the instance. *store.Store implements it.
// Every read bypasses caches, so a plan sees what is stored.
type Reader interface {
	GetConfigurationState(ctx context.Context) (*storepb.InstanceConfigurationState, error)
	ListIdentityProviders(ctx context.Context, find *store.FindIdentityProvider) ([]*storepb.IdentityProvider, error)
	GetUncachedInstanceSetting(ctx context.Context, find *store.FindInstanceSetting) (*storepb.InstanceSetting, error)
	ListUsers(ctx context.Context, find *store.FindUser) ([]*store.User, error)
	ListUserIdentities(ctx context.Context, find *store.FindUserIdentity) ([]*store.UserIdentity, error)
}

// Plan is what apply would change.
type Plan struct {
	// Message is the plan as printed and as --json returns it.
	Message *apipb.Plan
	// next is the state record apply writes; nil when the plan has errors.
	next *storepb.InstanceConfigurationState
	// operations are the writes apply makes, in apply order.
	operations []*operation
}

// operation is what apply writes for one resource change.
type operation struct {
	change *apipb.ResourceChange
	kind   Kind

	// The identity provider to write, and the stored one's ID when it exists.
	provider   *storepb.IdentityProvider
	providerID int32

	// The instance setting to write, or the key to reset.
	setting    *storepb.InstanceSetting
	settingKey storepb.InstanceSettingKey

	// The managed part of a declared user, and the stored user when it exists.
	// A user created without a declared password gets an unusable random one.
	user           *apipb.User
	actualUser     *store.User
	randomPassword bool

	// The identity link to write, without its user ID, which apply resolves
	// from identityUsername once the user exists; and the stored link, if any.
	identity         *store.UserIdentity
	identityUsername string
	actualIdentity   *store.UserIdentity
}

// Valid reports whether the plan can be applied.
func (p *Plan) Valid() bool {
	return len(p.Message.Errors) == 0
}

// HasChanges reports whether apply would write anything.
func (p *Plan) HasChanges() bool {
	return p.Message.StateRecordChanges
}

// Apply order: identity providers are created and updated first, so a GENERAL
// setting that needs one finds it; linked identities follow the users they
// belong to; users are destroyed before providers.
const (
	rankIdentityProvider = iota
	rankInstanceSetting
	rankUser
	rankLinkedIdentity
	rankLinkedIdentityDestroy
	rankUserDestroy
	rankIdentityProviderDestroy
)

type rankedChange struct {
	rank   int
	change *apipb.ResourceChange
	op     *operation
}

// ComputePlan compares the desired state with what reader holds and returns
// what apply would do. It never writes. Problems that stop an apply, such as
// a managed resource no file declares any longer, are in the plan's errors.
func ComputePlan(ctx context.Context, desired *Desired, reader Reader) (*Plan, error) {
	state, err := reader.GetConfigurationState(ctx)
	if err != nil {
		return nil, err
	}
	p := &planner{
		ctx:       ctx,
		desired:   desired,
		reader:    reader,
		state:     state,
		managed:   map[string]*storepb.InstanceConfigurationState_ManagedResource{},
		lifecycle: map[string]*apipb.Lifecycle{},
		removed:   map[string]*apipb.Removed{},
		message:   &apipb.Plan{Serial: state.Serial, Warnings: slices.Clone(desired.Warnings)},
	}
	for _, resource := range state.Resources {
		p.managed[resource.Name] = resource
	}
	for _, lifecycle := range desired.Configuration.Lifecycle {
		p.lifecycle[lifecycle.Resource] = lifecycle
	}
	for _, removed := range desired.Configuration.Removed {
		p.removed[removed.Resource] = removed
	}

	steps := []func() error{p.planIdentityProviders, p.planInstanceSettings, p.planUsers, p.planLinkedIdentities, p.planUndeclared, p.checkAuthentication}
	for _, step := range steps {
		if err := step(); err != nil {
			return nil, err
		}
	}
	return p.finish(), nil
}

type planner struct {
	ctx       context.Context
	desired   *Desired
	reader    Reader
	state     *storepb.InstanceConfigurationState
	managed   map[string]*storepb.InstanceConfigurationState_ManagedResource
	lifecycle map[string]*apipb.Lifecycle
	removed   map[string]*apipb.Removed
	message   *apipb.Plan
	changes   []rankedChange
	next      []*storepb.InstanceConfigurationState_ManagedResource

	providersByUID map[string]*storepb.IdentityProvider
	// The stored users the configuration declares, by username.
	declaredUsers map[string]*store.User

	// What the authentication invariant needs about the planned end state.
	providersAfter    map[string]bool
	providerDestroyed bool
	generalAfter      *storepb.InstanceGeneralSetting
	generalPlanned    bool
}

func (p *planner) fail(resource string, format string, args ...any) {
	p.message.Errors = append(p.message.Errors, resource+": "+fmt.Sprintf(format, args...))
}

// declared records the action for a declared resource from its field changes
// and whether it exists, and the state record entry apply would write.
func (p *planner) declared(rank int, name string, kind Kind, exists bool, changes []*apipb.FieldChange, entry *storepb.InstanceConfigurationState_ManagedResource, op *operation) {
	managed := p.managed[name]
	change := &apipb.ResourceChange{Resource: name, Source: p.desired.Sources[name], FieldChanges: changes}
	switch {
	case !exists:
		change.Action = apipb.ResourceChange_CREATE
		if managed != nil {
			change.Drift = true
			change.Message = "deleted outside the configuration since the last apply"
		}
	case managed == nil:
		change.Action = apipb.ResourceChange_ADOPT
	case len(changes) > 0:
		change.Action = apipb.ResourceChange_UPDATE
		// The declaration is what was last applied, so the instance changed.
		change.Drift = managed.Digest == entry.Digest
	default:
		change.Action = apipb.ResourceChange_NO_OP
	}

	lifecycle := p.lifecycle[name]
	entry.Name = name
	entry.Kind = string(kind)
	entry.Source = p.desired.Sources[name]
	entry.IgnoredFields = slices.Clone(lifecycle.GetIgnoreChanges())
	entry.PreventDestroy = lifecycle.GetPreventDestroy()
	if change.Action == apipb.ResourceChange_NO_OP && managed != nil {
		entry.AppliedTs = managed.AppliedTs
	}
	op.change, op.kind = change, kind
	p.changes = append(p.changes, rankedChange{rank: rank, change: change, op: op})
	p.next = append(p.next, entry)
}

func (p *planner) planIdentityProviders() error {
	providers, err := p.reader.ListIdentityProviders(p.ctx, &store.FindIdentityProvider{})
	if err != nil {
		return errors.Wrap(err, "failed to read identity providers")
	}
	p.providersByUID = map[string]*storepb.IdentityProvider{}
	p.providersAfter = map[string]bool{}
	for _, provider := range providers {
		p.providersByUID[provider.Uid] = provider
		p.providersAfter[provider.Uid] = true
	}

	for _, declared := range sortedByName(p.desired.Configuration.IdentityProviders, (*apipb.IdentityProvider).GetName) {
		desiredStore := identityprovider.ToStore(declared)
		desiredAPI := identityprovider.FromStore(desiredStore)
		var actualAPI proto.Message
		ignored := p.lifecycle[declared.Name].GetIgnoreChanges()
		op := &operation{provider: desiredStore}
		actual, exists := p.providersByUID[desiredStore.Uid]
		if exists {
			actualAPI = identityprovider.FromStore(actual)
			op.providerID = actual.Id
			if len(ignored) > 0 {
				merged := proto.CloneOf(desiredAPI)
				copyFields(merged, actualAPI, ignored)
				op.provider = identityprovider.ToStore(merged)
			}
		}
		changes := diffResource(actualAPI, desiredAPI, ignored)
		entry := &storepb.InstanceConfigurationState_ManagedResource{
			ManagedFields: []string{"*"},
			Digest:        digest(desiredAPI, p.lifecycle[declared.Name]),
		}
		p.declared(rankIdentityProvider, declared.Name, KindIdentityProvider, exists, changes, entry, op)
		p.providersAfter[desiredStore.Uid] = true
	}
	return nil
}

func (p *planner) planInstanceSettings() error {
	for _, declared := range sortedByName(p.desired.Configuration.InstanceSettings, (*apipb.InstanceSetting).GetName) {
		desiredStore, err := p.settingToStore(declared)
		if err != nil {
			p.fail(declared.Name, "%v", err)
			continue
		}
		actual, err := p.reader.GetUncachedInstanceSetting(p.ctx, &store.FindInstanceSetting{Name: desiredStore.Key.String()})
		if err != nil {
			return errors.Wrapf(err, "failed to read %s", declared.Name)
		}
		desiredAPI, err := p.settingFromStore(desiredStore)
		if err != nil {
			return err
		}
		var actualAPI proto.Message
		ignored := p.lifecycle[declared.Name].GetIgnoreChanges()
		op := &operation{setting: desiredStore, settingKey: desiredStore.Key}
		if actual != nil {
			instancesetting.Normalize(actual)
			if actualAPI, err = p.settingFromStore(actual); err != nil {
				return err
			}
			if len(ignored) > 0 {
				merged := proto.CloneOf(desiredAPI)
				copyFields(merged, actualAPI, ignored)
				if op.setting, err = p.settingToStore(merged); err != nil {
					p.fail(declared.Name, "%v", err)
					continue
				}
			}
		}
		changes := diffResource(actualAPI, desiredAPI, ignored)
		entry := &storepb.InstanceConfigurationState_ManagedResource{
			ManagedFields: []string{"*"},
			Digest:        digest(desiredAPI, p.lifecycle[declared.Name]),
			References:    settingReferences(declared),
		}
		p.declared(rankInstanceSetting, declared.Name, KindInstanceSetting, actual != nil, changes, entry, op)
		if desiredStore.Key == storepb.InstanceSettingKey_GENERAL {
			p.generalAfter = desiredStore.GetGeneralSetting()
			p.generalPlanned = true
		}
	}
	return nil
}

// settingToStore converts a declared setting as apply writes it: usage limits
// name users by resource name, resolved here, and the value is normalized the
// way every stored write normalizes it, so equal settings compare equal.
func (p *planner) settingToStore(setting *apipb.InstanceSetting) (*storepb.InstanceSetting, error) {
	stored := instancesetting.ToStore(setting)
	if stored.Key == storepb.InstanceSettingKey_USAGE_LIMITS {
		names := []string{}
		for _, limit := range setting.GetUsageLimitsSetting().GetLimits() {
			names = append(names, limit.GetUsers()...)
		}
		userIDs, err := p.resolveUserNames(names)
		if err != nil {
			return nil, err
		}
		usageLimits, err := instancesetting.UsageLimitsToStore(setting.GetUsageLimitsSetting(), userIDs)
		if err != nil {
			return nil, err
		}
		stored.Value = &storepb.InstanceSetting_UsageLimitsSetting{UsageLimitsSetting: usageLimits}
	}
	instancesetting.Normalize(stored)
	return stored, nil
}

// settingReferences lists the users a declared usage-limits setting names,
// sorted and without repeats; other settings name no resources.
func settingReferences(setting *apipb.InstanceSetting) []string {
	var names []string
	for _, limit := range setting.GetUsageLimitsSetting().GetLimits() {
		names = append(names, limit.GetUsers()...)
	}
	slices.Sort(names)
	return slices.Compact(names)
}

func (p *planner) settingFromStore(setting *storepb.InstanceSetting) (*apipb.InstanceSetting, error) {
	result := instancesetting.FromStore(setting)
	if setting.Key == storepb.InstanceSettingKey_USAGE_LIMITS {
		userIDs := []int32{}
		for _, limit := range setting.GetUsageLimitsSetting().GetLimits() {
			userIDs = append(userIDs, limit.GetUserIds()...)
		}
		userNames := map[int32]string{}
		if len(userIDs) > 0 {
			users, err := p.reader.ListUsers(p.ctx, &store.FindUser{IDList: userIDs})
			if err != nil {
				return nil, errors.Wrap(err, "failed to read users named by usage limits")
			}
			for _, user := range users {
				userNames[user.ID] = coreuser.NamePrefix + user.Username
			}
		}
		result.Value = &apipb.InstanceSetting_UsageLimitsSetting_{
			UsageLimitsSetting: instancesetting.UsageLimitsFromStore(setting.GetUsageLimitsSetting(), userNames),
		}
	}
	return result, nil
}

func (p *planner) resolveUserNames(names []string) (map[string]int32, error) {
	if len(names) == 0 {
		return map[string]int32{}, nil
	}
	usernames := make([]string, 0, len(names))
	for _, name := range names {
		usernames = append(usernames, strings.TrimPrefix(name, coreuser.NamePrefix))
	}
	users, err := p.reader.ListUsers(p.ctx, &store.FindUser{UsernameList: usernames})
	if err != nil {
		return nil, errors.Wrap(err, "failed to read users named by usage limits")
	}
	byName := map[string]int32{}
	for _, user := range users {
		byName[coreuser.NamePrefix+user.Username] = user.ID
	}
	for _, name := range names {
		if _, ok := byName[name]; !ok {
			return nil, errors.Errorf("usageLimitsSetting names %s, which does not exist", name)
		}
	}
	return byName, nil
}

func (p *planner) planUsers() error {
	declaredUsers := sortedByName(p.desired.Configuration.Users, (*apipb.User).GetName)
	usernames := make([]string, 0, len(declaredUsers))
	for _, user := range declaredUsers {
		usernames = append(usernames, user.Username)
	}
	actualByName := map[string]*store.User{}
	if len(usernames) > 0 {
		users, err := p.reader.ListUsers(p.ctx, &store.FindUser{UsernameList: usernames})
		if err != nil {
			return errors.Wrap(err, "failed to read users")
		}
		for _, user := range users {
			actualByName[user.Username] = user
		}
	}
	p.declaredUsers = actualByName

	linkedUsers := map[string]bool{}
	for _, identity := range p.desired.Configuration.LinkedIdentities {
		userName, _ := splitLinkedIdentityName(identity.GetName())
		linkedUsers[userName] = true
	}

	for _, declared := range declaredUsers {
		name := declared.Name
		actual := actualByName[declared.Username]
		lifecycle := p.lifecycle[name]
		optional := p.desired.UserFields[name]
		version := lifecycle.GetWriteOnlyVersion()
		recorded := p.managed[name].GetWriteOnlyVersion()
		sendPassword := actual == nil || version > recorded
		// A user with a declared linked identity signs in through its provider,
		// so it may be created without a password, as SSO provisioning creates
		// users: with a random password nobody knows.
		randomPassword := actual == nil && declared.Password == "" && linkedUsers[name]
		if randomPassword {
			sendPassword = false
		}
		if sendPassword && declared.Password == "" {
			if actual == nil {
				p.fail(name, "password is required to create the user, unless a linked identity is declared for it")
			} else {
				p.fail(name, "writeOnlyVersion is %d, above the %d last applied, but no password is declared", version, recorded)
			}
			continue
		}

		managedView := managedUserView(declared, optional)
		changes := p.userChanges(managedView, actual, sendPassword, version)
		entry := &storepb.InstanceConfigurationState_ManagedResource{
			ManagedFields:    append([]string{"username", "role"}, optional...),
			Digest:           digest(managedView, lifecycle),
			WriteOnlyVersion: max(version, recorded),
		}
		op := &operation{user: managedView, actualUser: actual, randomPassword: randomPassword}
		p.declared(rankUser, name, KindUser, actual != nil, changes, entry, op)
		if randomPassword {
			op.change.Message = "created without a password; signs in through its linked identity"
		}
	}
	return nil
}

// managedUserView is the part of a declared user the configuration manages.
func managedUserView(declared *apipb.User, optional []string) *apipb.User {
	view := &apipb.User{Name: declared.Name, Username: declared.Username, Role: declared.Role, Password: declared.Password}
	if slices.Contains(optional, "displayName") {
		view.DisplayName = declared.DisplayName
	}
	if slices.Contains(optional, "email") {
		// Layer 2 already rejected an email that does not normalize.
		view.Email, _ = store.NormalizeEmail(declared.Email)
	}
	return view
}

func (p *planner) userChanges(view *apipb.User, actual *store.User, sendPassword bool, version int32) []*apipb.FieldChange {
	ignored := p.lifecycle[view.Name].GetIgnoreChanges()
	optional := p.desired.UserFields[view.Name]
	changes := []*apipb.FieldChange{}
	add := func(path, before, after string) {
		if slices.Contains(ignored, path) {
			return
		}
		if before != after {
			changes = append(changes, &apipb.FieldChange{Path: path, Before: before, After: after})
		}
	}
	if actual == nil {
		add("username", "", strconv.Quote(view.Username))
		add("role", "", view.Role.String())
		for _, field := range optional {
			if field == "displayName" {
				add(field, "", strconv.Quote(view.DisplayName))
			} else {
				add(field, "", strconv.Quote(view.Email))
			}
		}
	} else {
		add("role", coreuser.RoleFromStore(actual.Role).String(), view.Role.String())
		for _, field := range optional {
			if field == "displayName" {
				add(field, strconv.Quote(actual.Nickname), strconv.Quote(view.DisplayName))
			} else {
				add(field, strconv.Quote(actual.Email), strconv.Quote(view.Email))
			}
		}
	}
	if sendPassword {
		before := ""
		if actual != nil {
			before = writeOnlyPlaceholder
		}
		changes = append(changes, &apipb.FieldChange{Path: "password", Before: before, After: fmt.Sprintf("(write-only, version %d)", version)})
	}
	return changes
}

// planLinkedIdentities plans the identity links of declared users. The user is
// declared, so the schema layer already guarantees planUsers saw it; the
// provider must exist after apply; and a subject already linked to another
// user is never taken over, since the plan cannot know which binding is right.
func (p *planner) planLinkedIdentities() error {
	for _, declared := range sortedByName(p.desired.Configuration.LinkedIdentities, (*apipb.LinkedIdentity).GetName) {
		name := declared.Name
		userName, providerName := splitLinkedIdentityName(name)
		username := strings.TrimPrefix(userName, coreuser.NamePrefix)
		uid := strings.TrimPrefix(providerName, identityprovider.NamePrefix)
		if !p.providersAfter[uid] {
			p.fail(name, "names %s, which would not exist after apply", providerName)
			continue
		}
		user := p.declaredUsers[username]
		holders, err := p.reader.ListUserIdentities(p.ctx, &store.FindUserIdentity{Provider: &uid, ExternUID: &declared.ExternalUid})
		if err != nil {
			return errors.Wrapf(err, "failed to read the identity links of %s", providerName)
		}
		if len(holders) > 0 && (user == nil || holders[0].UserID != user.ID) {
			holder, err := p.userName(holders[0].UserID)
			if err != nil {
				return err
			}
			p.fail(name, "the %s subject is already linked to %s; unlink it there first", providerName, holder)
			continue
		}

		var actual *store.UserIdentity
		if user != nil {
			links, err := p.reader.ListUserIdentities(p.ctx, &store.FindUserIdentity{UserID: &user.ID, Provider: &uid})
			if err != nil {
				return errors.Wrapf(err, "failed to read the identity links of %s", userName)
			}
			if len(links) > 0 {
				actual = links[0]
			}
		}
		desiredAPI := &apipb.LinkedIdentity{Name: name, ExternalUid: declared.ExternalUid}
		var actualAPI proto.Message
		if actual != nil {
			actualAPI = &apipb.LinkedIdentity{Name: name, ExternalUid: actual.ExternUID}
		}
		changes := diffResource(actualAPI, desiredAPI, nil)
		entry := &storepb.InstanceConfigurationState_ManagedResource{
			ManagedFields: []string{"*"},
			Digest:        digest(desiredAPI, p.lifecycle[name]),
			References:    []string{providerName},
		}
		op := &operation{
			identity:         &store.UserIdentity{Provider: uid, ExternUID: declared.ExternalUid},
			identityUsername: username,
			actualIdentity:   actual,
			actualUser:       user,
		}
		p.declared(rankLinkedIdentity, name, KindLinkedIdentity, actual != nil, changes, entry, op)
	}
	return nil
}

// userName returns the resource name of the stored user with id.
func (p *planner) userName(id int32) (string, error) {
	users, err := p.reader.ListUsers(p.ctx, &store.FindUser{ID: &id})
	if err != nil {
		return "", errors.Wrap(err, "failed to read user")
	}
	if len(users) == 0 {
		return "a deleted user", nil
	}
	return coreuser.NamePrefix + users[0].Username, nil
}

// storedLinkedIdentity returns the identity link a managed linked identity
// name describes, or nil when the user or the link is gone.
func (p *planner) storedLinkedIdentity(name string) (*store.User, *store.UserIdentity, error) {
	userName, providerName := splitLinkedIdentityName(name)
	username := strings.TrimPrefix(userName, coreuser.NamePrefix)
	uid := strings.TrimPrefix(providerName, identityprovider.NamePrefix)
	users, err := p.reader.ListUsers(p.ctx, &store.FindUser{Username: &username})
	if err != nil {
		return nil, nil, errors.Wrap(err, "failed to read user")
	}
	if len(users) == 0 {
		return nil, nil, nil
	}
	links, err := p.reader.ListUserIdentities(p.ctx, &store.FindUserIdentity{UserID: &users[0].ID, Provider: &uid})
	if err != nil {
		return nil, nil, errors.Wrapf(err, "failed to read the identity links of %s", userName)
	}
	if len(links) == 0 {
		return users[0], nil, nil
	}
	return users[0], links[0], nil
}

// planUndeclared handles managed resources no file declares any longer: a
// removed entry destroys, resets, or releases them; without one, removal was
// not explicit and the plan fails.
func (p *planner) planUndeclared() error {
	for _, managed := range p.state.Resources {
		name := managed.Name
		if _, declared := p.desired.Sources[name]; declared {
			continue
		}
		removed := p.removed[name]
		kind, id, err := ParseResourceName(name)
		if err != nil {
			p.fail(name, "the state record names a resource this version cannot manage: %v", err)
			continue
		}
		change := &apipb.ResourceChange{Resource: name}
		op := &operation{change: change, kind: kind}
		rank := map[Kind]int{KindIdentityProvider: rankIdentityProvider, KindInstanceSetting: rankInstanceSetting, KindUser: rankUser, KindLinkedIdentity: rankLinkedIdentity}[kind]
		switch {
		case removed == nil:
			change.Action = apipb.ResourceChange_ERROR
			change.Message = "managed but no longer declared; add a removed entry to destroy or release it"
			p.fail(name, "%s", change.Message)
		case !removed.Destroy:
			change.Action = apipb.ResourceChange_RELEASE
		case managed.PreventDestroy:
			change.Action = apipb.ResourceChange_ERROR
			change.Message = "preventDestroy was set when last applied; apply once without it, then destroy"
			p.fail(name, "%s", change.Message)
		case kind == KindUser:
			// Deleting a user deletes their memos and attachment files and must
			// respect their spaces; that belongs to the deletion flow in Settings.
			change.Action = apipb.ResourceChange_ERROR
			change.Message = "configuration cannot delete a user; release it with destroy false, then delete the user in Settings"
			p.fail(name, "%s", change.Message)
		case kind == KindInstanceSetting:
			change.Action = apipb.ResourceChange_RESET
			op.settingKey = storepb.InstanceSettingKey(storepb.InstanceSettingKey_value[id])
			if id == storepb.InstanceSettingKey_GENERAL.String() {
				p.generalAfter = &storepb.InstanceGeneralSetting{}
				p.generalPlanned = true
			}
		case kind == KindLinkedIdentity:
			user, link, err := p.storedLinkedIdentity(name)
			if err != nil {
				return err
			}
			if link == nil {
				change.Action = apipb.ResourceChange_RELEASE
				change.Message = "already deleted outside the configuration"
				break
			}
			change.Action = apipb.ResourceChange_DESTROY
			rank = rankLinkedIdentityDestroy
			op.actualUser, op.actualIdentity = user, link
		default:
			if !p.providersAfter[id] {
				change.Action = apipb.ResourceChange_RELEASE
				change.Message = "already deleted outside the configuration"
				break
			}
			change.Action = apipb.ResourceChange_DESTROY
			rank = rankIdentityProviderDestroy
			op.providerID = p.providersByUID[id].GetId()
			delete(p.providersAfter, id)
			p.providerDestroyed = true
		}
		p.changes = append(p.changes, rankedChange{rank: rank, change: change, op: op})
	}
	return nil
}

// checkAuthentication fails a plan that ends with password sign-in disabled
// for regular users and no identity provider, when the plan itself touches
// either. An unrelated plan only warns about a stored state already like that.
func (p *planner) checkAuthentication() error {
	general := p.generalAfter
	if !p.generalPlanned {
		stored, err := p.reader.GetUncachedInstanceSetting(p.ctx, &store.FindInstanceSetting{Name: storepb.InstanceSettingKey_GENERAL.String()})
		if err != nil {
			return errors.Wrap(err, "failed to read GENERAL")
		}
		general = stored.GetGeneralSetting()
	}
	if !general.GetDisallowPasswordAuth() || len(p.providersAfter) > 0 {
		return nil
	}
	const problem = "password sign-in is disabled for regular users and no identity provider would remain"
	if p.generalPlanned || p.providerDestroyed {
		p.message.Errors = append(p.message.Errors, problem)
	} else {
		p.message.Warnings = append(p.message.Warnings, "the stored configuration already has "+problem+"; administrators can still sign in with a password")
	}
	return nil
}

func (p *planner) finish() *Plan {
	slices.SortStableFunc(p.changes, func(a, b rankedChange) int {
		if a.rank != b.rank {
			return a.rank - b.rank
		}
		return strings.Compare(a.change.Resource, b.change.Resource)
	})
	writes := false
	plan := &Plan{Message: p.message}
	for _, ranked := range p.changes {
		p.message.ResourceChanges = append(p.message.ResourceChanges, ranked.change)
		plan.operations = append(plan.operations, ranked.op)
		if ranked.change.Action != apipb.ResourceChange_NO_OP {
			writes = true
		}
	}
	if !plan.Valid() {
		return plan
	}

	slices.SortFunc(p.next, func(a, b *storepb.InstanceConfigurationState_ManagedResource) int {
		return strings.Compare(a.Name, b.Name)
	})
	plan.next = &storepb.InstanceConfigurationState{
		Serial:       p.state.Serial,
		ConfigDigest: digest(p.desired.Configuration),
		Resources:    p.next,
	}
	p.message.StateRecordChanges = writes || !sameRecord(p.state, plan.next)
	return plan
}

// sameRecord compares the managed resources of two state records, ignoring
// the apply metadata a plan does not compute. The config digest is left out:
// it is informational, so a change to it alone, such as a deleted leftover
// removed entry, is not worth an apply.
func sameRecord(a, b *storepb.InstanceConfigurationState) bool {
	strip := func(state *storepb.InstanceConfigurationState) *storepb.InstanceConfigurationState {
		stripped := &storepb.InstanceConfigurationState{}
		for _, resource := range state.Resources {
			resource = proto.CloneOf(resource)
			resource.AppliedTs = 0
			stripped.Resources = append(stripped.Resources, resource)
		}
		slices.SortFunc(stripped.Resources, func(x, y *storepb.InstanceConfigurationState_ManagedResource) int {
			return strings.Compare(x.Name, y.Name)
		})
		return stripped
	}
	return proto.Equal(strip(a), strip(b))
}

func sortedByName[T any](items []T, name func(T) string) []T {
	sorted := slices.Clone(items)
	slices.SortFunc(sorted, func(a, b T) int { return strings.Compare(name(a), name(b)) })
	return sorted
}
