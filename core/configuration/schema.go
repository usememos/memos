package configuration

import (
	"fmt"
	"slices"
	"strings"

	"github.com/pkg/errors"
	"google.golang.org/protobuf/reflect/protoreflect"

	"github.com/usememos/memos/core/identityprovider"
	"github.com/usememos/memos/core/instancesetting"
	coreuser "github.com/usememos/memos/core/user"
	"github.com/usememos/memos/internal/identifier"
	apipb "github.com/usememos/memos/proto/gen/api"
)

// Kind is the kind of a configurable resource.
type Kind string

// The configurable kinds.
const (
	KindIdentityProvider Kind = "IdentityProvider"
	KindInstanceSetting  Kind = "InstanceSetting"
	KindUser             Kind = "User"
)

// ConfigurableInstanceSettingKeys are the instance setting keys a file may declare.
var ConfigurableInstanceSettingKeys = []string{"ACCESS", "GENERAL", "STORAGE", "MEMO_RELATED", "NOTIFICATION", "AI", "USAGE_LIMITS"}

// userFields are the User fields a file may set. The rest of a profile belongs
// to the user.
var userFields = []protoreflect.Name{"name", "username", "display_name", "email", "password", "role"}

// ParseResourceName returns the kind and identifier of a configurable resource name.
func ParseResourceName(name string) (Kind, string, error) {
	switch {
	case strings.HasPrefix(name, identityprovider.NamePrefix):
		uid := strings.TrimPrefix(name, identityprovider.NamePrefix)
		if !identifier.UIDMatcher.MatchString(uid) {
			return "", "", errors.Errorf("invalid identity provider name %q", name)
		}
		return KindIdentityProvider, uid, nil
	case strings.HasPrefix(name, instancesetting.NamePrefix):
		key := strings.TrimPrefix(name, instancesetting.NamePrefix)
		switch {
		case slices.Contains(ConfigurableInstanceSettingKeys, key):
			return KindInstanceSetting, key, nil
		case key == "BASIC":
			return "", "", errors.New("instance/settings/BASIC holds the instance secret and schema version and cannot be configured")
		case key == "TAGS":
			return "", "", errors.New("instance/settings/TAGS is kept only for compatibility and cannot be configured")
		case key == "CONFIGURATION_STATE":
			return "", "", errors.New("instance/settings/CONFIGURATION_STATE is the configuration state record and cannot be configured")
		default:
			return "", "", errors.Errorf("unknown instance setting %q", name)
		}
	case strings.HasPrefix(name, coreuser.NamePrefix):
		username := strings.TrimPrefix(name, coreuser.NamePrefix)
		if err := coreuser.ValidateUsername(username); err != nil {
			return "", "", errors.Errorf("invalid user name %q", name)
		}
		return KindUser, username, nil
	default:
		return "", "", errors.Errorf("%q is not an identity provider, instance setting, or user name", name)
	}
}

// checkDocument checks the rules one file must meet on its own.
func checkDocument(document *apipb.Configuration) []string {
	var problems []string
	report := func(format string, args ...any) {
		problems = append(problems, fmt.Sprintf(format, args...))
	}
	checkName := func(path, name string, want Kind) (string, bool) {
		if name == "" {
			report("%s.name is required", path)
			return "", false
		}
		kind, id, err := ParseResourceName(name)
		if err != nil {
			report("%s.name: %v", path, err)
			return "", false
		}
		if kind != want {
			report("%s.name: %s is not a %s name", path, name, want)
			return "", false
		}
		return id, true
	}

	for i, provider := range document.IdentityProviders {
		checkName(fmt.Sprintf("identityProviders[%d]", i), provider.GetName(), KindIdentityProvider)
	}

	for i, setting := range document.InstanceSettings {
		path := fmt.Sprintf("instanceSettings[%d]", i)
		key, ok := checkName(path, setting.GetName(), KindInstanceSetting)
		if !ok {
			continue
		}
		message := setting.ProtoReflect()
		expected := message.Descriptor().Fields().ByName(protoreflect.Name(strings.ToLower(key) + "_setting"))
		populated := message.WhichOneof(message.Descriptor().Oneofs().ByName("value"))
		switch {
		case populated == nil:
			report("%s.%s is required for %s", path, expected.JSONName(), key)
		case populated.Name() != expected.Name():
			report("%s.%s does not match %s; use %s", path, populated.JSONName(), key, expected.JSONName())
		default:
		}
	}

	for i, user := range document.Users {
		path := fmt.Sprintf("users[%d]", i)
		username, ok := checkName(path, user.GetName(), KindUser)
		if ok && user.GetUsername() != username {
			report("%s.username must equal %q, the username in name", path, username)
		}
		if user.GetRole() == apipb.User_ROLE_UNSPECIFIED {
			report("%s.role is required", path)
		}
		user.ProtoReflect().Range(func(field protoreflect.FieldDescriptor, _ protoreflect.Value) bool {
			if !slices.Contains(userFields, field.Name()) {
				report("%s.%s cannot be configured; it belongs to the user", path, field.JSONName())
			}
			return true
		})
	}

	for i, lifecycle := range document.Lifecycle {
		path := fmt.Sprintf("lifecycle[%d]", i)
		if lifecycle.GetResource() == "" {
			report("%s.resource is required", path)
			continue
		}
		kind, _, err := ParseResourceName(lifecycle.GetResource())
		if err != nil {
			report("%s.resource: %v", path, err)
			continue
		}
		if lifecycle.GetWriteOnlyVersion() < 0 {
			report("%s.writeOnlyVersion must not be negative", path)
		}
		if lifecycle.GetWriteOnlyVersion() != 0 && kind != KindUser {
			report("%s.writeOnlyVersion applies only to users", path)
		}
		for j, fieldPath := range lifecycle.GetIgnoreChanges() {
			if err := checkFieldPath(kindDescriptor(kind), fieldPath); err != nil {
				report("%s.ignoreChanges[%d]: %v", path, j, err)
			}
		}
	}

	for i, removed := range document.Removed {
		path := fmt.Sprintf("removed[%d]", i)
		if removed.GetResource() == "" {
			report("%s.resource is required", path)
			continue
		}
		if _, _, err := ParseResourceName(removed.GetResource()); err != nil {
			report("%s.resource: %v", path, err)
		}
	}
	return problems
}

func kindDescriptor(kind Kind) protoreflect.MessageDescriptor {
	switch kind {
	case KindIdentityProvider:
		return (&apipb.IdentityProvider{}).ProtoReflect().Descriptor()
	case KindInstanceSetting:
		return (&apipb.InstanceSetting{}).ProtoReflect().Descriptor()
	default:
		return (&apipb.User{}).ProtoReflect().Descriptor()
	}
}

// checkFieldPath reports whether path names a field of descriptor by JSON
// names, descending through singular message fields.
func checkFieldPath(descriptor protoreflect.MessageDescriptor, path string) error {
	if path == "" {
		return errors.New("field path must not be empty")
	}
	segments := strings.Split(path, ".")
	for i, segment := range segments {
		field := descriptor.Fields().ByJSONName(segment)
		if field == nil {
			return errors.Errorf("%q has no field %q", descriptor.Name(), segment)
		}
		if i == 0 && field.Name() == "name" {
			return errors.New("name is the resource identity and cannot be ignored")
		}
		if i == len(segments)-1 {
			return nil
		}
		if field.Kind() != protoreflect.MessageKind || field.IsList() || field.IsMap() {
			return errors.Errorf("%q is not a message field", strings.Join(segments[:i+1], "."))
		}
		descriptor = field.Message()
	}
	return nil
}

// merger combines files into one desired state and checks the rules that span
// files: one declaration per resource, lifecycle rules for declared resources,
// and removals of resources no file still declares.
type merger struct {
	desired          *Desired
	problems         []string
	lifecycleSources map[string]string
	removedSources   map[string]string
}

func newMerger(desired *Desired) *merger {
	return &merger{desired: desired, lifecycleSources: map[string]string{}, removedSources: map[string]string{}}
}

func (m *merger) add(file string, document *apipb.Configuration, userFields map[int][]string) {
	claim := func(sources map[string]string, name, what string) bool {
		if previous, ok := sources[name]; ok {
			m.problems = append(m.problems, fmt.Sprintf("%s: %s for %s is also declared in %s", file, what, name, previous))
			return false
		}
		sources[name] = file
		return true
	}
	config := m.desired.Configuration
	for _, provider := range document.IdentityProviders {
		if claim(m.desired.Sources, provider.GetName(), "resource") {
			config.IdentityProviders = append(config.IdentityProviders, provider)
		}
	}
	for _, setting := range document.InstanceSettings {
		if claim(m.desired.Sources, setting.GetName(), "resource") {
			config.InstanceSettings = append(config.InstanceSettings, setting)
		}
	}
	for i, user := range document.Users {
		if claim(m.desired.Sources, user.GetName(), "resource") {
			config.Users = append(config.Users, user)
			m.desired.UserFields[user.GetName()] = userFields[i]
		}
	}
	for _, lifecycle := range document.Lifecycle {
		if claim(m.lifecycleSources, lifecycle.GetResource(), "a lifecycle rule") {
			config.Lifecycle = append(config.Lifecycle, lifecycle)
		}
	}
	for _, removed := range document.Removed {
		if claim(m.removedSources, removed.GetResource(), "a removed entry") {
			config.Removed = append(config.Removed, removed)
		}
	}
}

func (m *merger) checkReferences() {
	for _, lifecycle := range m.desired.Configuration.Lifecycle {
		if _, ok := m.desired.Sources[lifecycle.GetResource()]; !ok {
			m.problems = append(m.problems, fmt.Sprintf("%s: the lifecycle rule names %s, which no file declares",
				m.lifecycleSources[lifecycle.GetResource()], lifecycle.GetResource()))
		}
	}
	for _, removed := range m.desired.Configuration.Removed {
		if declaredIn, ok := m.desired.Sources[removed.GetResource()]; ok {
			m.problems = append(m.problems, fmt.Sprintf("%s: %s is removed but still declared in %s",
				m.removedSources[removed.GetResource()], removed.GetResource(), declaredIn))
		}
	}
}
