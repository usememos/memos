package api

import (
	"context"
	stderrors "errors"
	"strings"
	"time"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/usememos/memos/core/configuration"
	apipb "github.com/usememos/memos/proto/gen/api"
	"github.com/usememos/memos/store"
)

// reasonManagedByConfiguration is the ErrorInfo reason of a write refused
// because declarative configuration manages what it would change.
const reasonManagedByConfiguration = "MANAGED_BY_CONFIGURATION"

func (s *APIService) GetConfigurationStatus(ctx context.Context, _ *apipb.GetConfigurationStatusRequest) (*apipb.ConfigurationStatus, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get current user: %v", err)
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}
	if user.Role != store.RoleAdmin {
		return nil, status.Errorf(codes.PermissionDenied, "permission denied")
	}
	state, err := s.Store.GetConfigurationState(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to read the configuration state: %v", err)
	}
	result := &apipb.ConfigurationStatus{
		Serial:       state.Serial,
		ConfigDigest: state.ConfigDigest,
		AppliedBy:    state.AppliedBy,
		Version:      state.Version,
	}
	if state.AppliedTs != 0 {
		result.ApplyTime = timestamppb.New(time.Unix(state.AppliedTs, 0))
	}
	for _, resource := range state.Resources {
		result.ManagedResources = append(result.ManagedResources, &apipb.ConfigurationStatus_ManagedResource{
			Resource:      resource.Name,
			Source:        resource.Source,
			ManagedFields: resource.ManagedFields,
			IgnoredFields: resource.IgnoredFields,
		})
	}
	return result, nil
}

// checkManagedChange refuses a write that would change fields of a resource
// the configuration manages; changed lists the JSON-name paths the write
// changes. The configuration state is read from the database, so every
// replica enforces ownership whether or not it read the files.
func (s *APIService) checkManagedChange(ctx context.Context, resource string, changed []string) error {
	if len(changed) == 0 {
		// A write that changes nothing is never refused.
		return nil
	}
	state, err := s.Store.GetConfigurationState(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to read the configuration state: %v", err)
	}
	return managedStatus(configuration.CheckChange(state, resource, changed))
}

// checkManagedExistence refuses creating or deleting a resource the
// configuration manages.
func (s *APIService) checkManagedExistence(ctx context.Context, resource string) error {
	state, err := s.Store.GetConfigurationState(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to read the configuration state: %v", err)
	}
	return managedStatus(configuration.CheckExistence(state, resource))
}

// checkManagedReference refuses renaming or deleting a resource that a
// resource the configuration manages names, such as a user a managed
// usage-limits setting lists.
func (s *APIService) checkManagedReference(ctx context.Context, resource string) error {
	state, err := s.Store.GetConfigurationState(ctx)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to read the configuration state: %v", err)
	}
	return managedStatus(configuration.CheckReference(state, resource))
}

// managedStatus turns a refusal into FAILED_PRECONDITION with an ErrorInfo
// naming the resource, the file that declares it, and the fields.
func managedStatus(err error) error {
	var managed *configuration.ManagedError
	if !stderrors.As(err, &managed) {
		return err
	}
	st := status.New(codes.FailedPrecondition, managed.Error())
	metadata := map[string]string{
		"resource": managed.Resource,
		"source":   managed.Source,
		"fields":   strings.Join(managed.Fields, ","),
	}
	if managed.ReferencedBy != "" {
		metadata["referenced_by"] = managed.ReferencedBy
	}
	detailed, detailErr := st.WithDetails(&errdetails.ErrorInfo{
		Reason:   reasonManagedByConfiguration,
		Domain:   errorInfoDomain,
		Metadata: metadata,
	})
	if detailErr != nil {
		return st.Err()
	}
	return detailed.Err()
}
