package configuration

import (
	"fmt"
	"slices"
	"strings"

	"google.golang.org/protobuf/proto"

	storepb "github.com/usememos/memos/proto/gen/store"
)

// ManagedError reports an API write refused because the configuration
// manages what it would change.
type ManagedError struct {
	// Resource is the resource name.
	Resource string
	// Source is the configuration file that declares it.
	Source string
	// Fields are the managed JSON-name paths the write would change.
	Fields []string
	// ReferencedBy, when set, is the managed resource that names Resource;
	// Source is then the file that declares it.
	ReferencedBy string
}

func (e *ManagedError) Error() string {
	if e.ReferencedBy != "" {
		return fmt.Sprintf("%s is named by %s in %s; remove it there and apply first", e.Resource, e.ReferencedBy, e.Source)
	}
	return fmt.Sprintf("%s is managed by configuration in %s; change %s there", e.Resource, e.Source, strings.Join(e.Fields, ", "))
}

// CheckChange returns a *ManagedError when state manages resource and changed,
// the JSON-name paths a write would change, includes a managed field that
// lifecycle ignoreChanges does not release. A write that changes nothing the
// configuration manages, such as one resending managed values, passes.
func CheckChange(state *storepb.InstanceConfigurationState, resource string, changed []string) error {
	managed := findManaged(state, resource)
	if managed == nil {
		return nil
	}
	var refused []string
	for _, path := range changed {
		if coveredBy(path, managed.ManagedFields) && !coveredBy(path, managed.IgnoredFields) {
			refused = append(refused, path)
		}
	}
	if len(refused) == 0 {
		return nil
	}
	return &ManagedError{Resource: resource, Source: managed.Source, Fields: refused}
}

// CheckExistence returns a *ManagedError when state manages resource, so the
// API can neither create one with its name nor delete it.
func CheckExistence(state *storepb.InstanceConfigurationState, resource string) error {
	managed := findManaged(state, resource)
	if managed == nil {
		return nil
	}
	return &ManagedError{Resource: resource, Source: managed.Source, Fields: slices.Clone(managed.ManagedFields)}
}

// CheckReference returns a *ManagedError when a resource state manages names
// resource, so the API can neither rename nor delete it: the next plan would
// not resolve the name.
func CheckReference(state *storepb.InstanceConfigurationState, resource string) error {
	for _, managed := range state.GetResources() {
		if slices.Contains(managed.References, resource) {
			return &ManagedError{Resource: resource, Source: managed.Source, ReferencedBy: managed.Name}
		}
	}
	return nil
}

// Manages reports whether state manages resource.
func Manages(state *storepb.InstanceConfigurationState, resource string) bool {
	return findManaged(state, resource) != nil
}

// ChangedPaths lists the JSON-name paths that differ between two API
// messages of the same type; a nil before lists every set field of after.
func ChangedPaths(before, after proto.Message) []string {
	paths := []string{}
	for _, change := range diffResource(before, after, nil) {
		paths = append(paths, change.Path)
	}
	return paths
}

func findManaged(state *storepb.InstanceConfigurationState, resource string) *storepb.InstanceConfigurationState_ManagedResource {
	for _, managed := range state.GetResources() {
		if managed.Name == resource {
			return managed
		}
	}
	return nil
}

// coveredBy reports whether path is one of fields or lies beneath one; "*"
// covers every path.
func coveredBy(path string, fields []string) bool {
	for _, field := range fields {
		if field == "*" || path == field || strings.HasPrefix(path, field+".") || strings.HasPrefix(path, field+"[") {
			return true
		}
	}
	return false
}
