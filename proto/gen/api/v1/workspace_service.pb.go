// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.36.0
// 	protoc        (unknown)
// source: api/v1/workspace_service.proto

package apiv1

import (
	_ "google.golang.org/genproto/googleapis/api/annotations"
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
)

const (
	// Verify that this generated code is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	// Verify that runtime/protoimpl is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

type WorkspaceProfile struct {
	state protoimpl.MessageState `protogen:"open.v1"`
	// The name of instance owner.
	// Format: "users/{id}"
	Owner string `protobuf:"bytes,1,opt,name=owner,proto3" json:"owner,omitempty"`
	// version is the current version of instance
	Version string `protobuf:"bytes,2,opt,name=version,proto3" json:"version,omitempty"`
	// mode is the instance mode (e.g. "prod", "dev" or "demo").
	Mode string `protobuf:"bytes,3,opt,name=mode,proto3" json:"mode,omitempty"`
	// instance_url is the URL of the instance.
	InstanceUrl   string `protobuf:"bytes,6,opt,name=instance_url,json=instanceUrl,proto3" json:"instance_url,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *WorkspaceProfile) Reset() {
	*x = WorkspaceProfile{}
	mi := &file_api_v1_workspace_service_proto_msgTypes[0]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *WorkspaceProfile) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*WorkspaceProfile) ProtoMessage() {}

func (x *WorkspaceProfile) ProtoReflect() protoreflect.Message {
	mi := &file_api_v1_workspace_service_proto_msgTypes[0]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use WorkspaceProfile.ProtoReflect.Descriptor instead.
func (*WorkspaceProfile) Descriptor() ([]byte, []int) {
	return file_api_v1_workspace_service_proto_rawDescGZIP(), []int{0}
}

func (x *WorkspaceProfile) GetOwner() string {
	if x != nil {
		return x.Owner
	}
	return ""
}

func (x *WorkspaceProfile) GetVersion() string {
	if x != nil {
		return x.Version
	}
	return ""
}

func (x *WorkspaceProfile) GetMode() string {
	if x != nil {
		return x.Mode
	}
	return ""
}

func (x *WorkspaceProfile) GetInstanceUrl() string {
	if x != nil {
		return x.InstanceUrl
	}
	return ""
}

type GetWorkspaceProfileRequest struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *GetWorkspaceProfileRequest) Reset() {
	*x = GetWorkspaceProfileRequest{}
	mi := &file_api_v1_workspace_service_proto_msgTypes[1]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *GetWorkspaceProfileRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*GetWorkspaceProfileRequest) ProtoMessage() {}

func (x *GetWorkspaceProfileRequest) ProtoReflect() protoreflect.Message {
	mi := &file_api_v1_workspace_service_proto_msgTypes[1]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use GetWorkspaceProfileRequest.ProtoReflect.Descriptor instead.
func (*GetWorkspaceProfileRequest) Descriptor() ([]byte, []int) {
	return file_api_v1_workspace_service_proto_rawDescGZIP(), []int{1}
}

var File_api_v1_workspace_service_proto protoreflect.FileDescriptor

var file_api_v1_workspace_service_proto_rawDesc = []byte{
	0x0a, 0x1e, 0x61, 0x70, 0x69, 0x2f, 0x76, 0x31, 0x2f, 0x77, 0x6f, 0x72, 0x6b, 0x73, 0x70, 0x61,
	0x63, 0x65, 0x5f, 0x73, 0x65, 0x72, 0x76, 0x69, 0x63, 0x65, 0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f,
	0x12, 0x0c, 0x6d, 0x65, 0x6d, 0x6f, 0x73, 0x2e, 0x61, 0x70, 0x69, 0x2e, 0x76, 0x31, 0x1a, 0x1c,
	0x67, 0x6f, 0x6f, 0x67, 0x6c, 0x65, 0x2f, 0x61, 0x70, 0x69, 0x2f, 0x61, 0x6e, 0x6e, 0x6f, 0x74,
	0x61, 0x74, 0x69, 0x6f, 0x6e, 0x73, 0x2e, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x22, 0x79, 0x0a, 0x10,
	0x57, 0x6f, 0x72, 0x6b, 0x73, 0x70, 0x61, 0x63, 0x65, 0x50, 0x72, 0x6f, 0x66, 0x69, 0x6c, 0x65,
	0x12, 0x14, 0x0a, 0x05, 0x6f, 0x77, 0x6e, 0x65, 0x72, 0x18, 0x01, 0x20, 0x01, 0x28, 0x09, 0x52,
	0x05, 0x6f, 0x77, 0x6e, 0x65, 0x72, 0x12, 0x18, 0x0a, 0x07, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f,
	0x6e, 0x18, 0x02, 0x20, 0x01, 0x28, 0x09, 0x52, 0x07, 0x76, 0x65, 0x72, 0x73, 0x69, 0x6f, 0x6e,
	0x12, 0x12, 0x0a, 0x04, 0x6d, 0x6f, 0x64, 0x65, 0x18, 0x03, 0x20, 0x01, 0x28, 0x09, 0x52, 0x04,
	0x6d, 0x6f, 0x64, 0x65, 0x12, 0x21, 0x0a, 0x0c, 0x69, 0x6e, 0x73, 0x74, 0x61, 0x6e, 0x63, 0x65,
	0x5f, 0x75, 0x72, 0x6c, 0x18, 0x06, 0x20, 0x01, 0x28, 0x09, 0x52, 0x0b, 0x69, 0x6e, 0x73, 0x74,
	0x61, 0x6e, 0x63, 0x65, 0x55, 0x72, 0x6c, 0x22, 0x1c, 0x0a, 0x1a, 0x47, 0x65, 0x74, 0x57, 0x6f,
	0x72, 0x6b, 0x73, 0x70, 0x61, 0x63, 0x65, 0x50, 0x72, 0x6f, 0x66, 0x69, 0x6c, 0x65, 0x52, 0x65,
	0x71, 0x75, 0x65, 0x73, 0x74, 0x32, 0x97, 0x01, 0x0a, 0x10, 0x57, 0x6f, 0x72, 0x6b, 0x73, 0x70,
	0x61, 0x63, 0x65, 0x53, 0x65, 0x72, 0x76, 0x69, 0x63, 0x65, 0x12, 0x82, 0x01, 0x0a, 0x13, 0x47,
	0x65, 0x74, 0x57, 0x6f, 0x72, 0x6b, 0x73, 0x70, 0x61, 0x63, 0x65, 0x50, 0x72, 0x6f, 0x66, 0x69,
	0x6c, 0x65, 0x12, 0x28, 0x2e, 0x6d, 0x65, 0x6d, 0x6f, 0x73, 0x2e, 0x61, 0x70, 0x69, 0x2e, 0x76,
	0x31, 0x2e, 0x47, 0x65, 0x74, 0x57, 0x6f, 0x72, 0x6b, 0x73, 0x70, 0x61, 0x63, 0x65, 0x50, 0x72,
	0x6f, 0x66, 0x69, 0x6c, 0x65, 0x52, 0x65, 0x71, 0x75, 0x65, 0x73, 0x74, 0x1a, 0x1e, 0x2e, 0x6d,
	0x65, 0x6d, 0x6f, 0x73, 0x2e, 0x61, 0x70, 0x69, 0x2e, 0x76, 0x31, 0x2e, 0x57, 0x6f, 0x72, 0x6b,
	0x73, 0x70, 0x61, 0x63, 0x65, 0x50, 0x72, 0x6f, 0x66, 0x69, 0x6c, 0x65, 0x22, 0x21, 0x82, 0xd3,
	0xe4, 0x93, 0x02, 0x1b, 0x12, 0x19, 0x2f, 0x61, 0x70, 0x69, 0x2f, 0x76, 0x31, 0x2f, 0x77, 0x6f,
	0x72, 0x6b, 0x73, 0x70, 0x61, 0x63, 0x65, 0x2f, 0x70, 0x72, 0x6f, 0x66, 0x69, 0x6c, 0x65, 0x42,
	0xad, 0x01, 0x0a, 0x10, 0x63, 0x6f, 0x6d, 0x2e, 0x6d, 0x65, 0x6d, 0x6f, 0x73, 0x2e, 0x61, 0x70,
	0x69, 0x2e, 0x76, 0x31, 0x42, 0x15, 0x57, 0x6f, 0x72, 0x6b, 0x73, 0x70, 0x61, 0x63, 0x65, 0x53,
	0x65, 0x72, 0x76, 0x69, 0x63, 0x65, 0x50, 0x72, 0x6f, 0x74, 0x6f, 0x50, 0x01, 0x5a, 0x30, 0x67,
	0x69, 0x74, 0x68, 0x75, 0x62, 0x2e, 0x63, 0x6f, 0x6d, 0x2f, 0x75, 0x73, 0x65, 0x6d, 0x65, 0x6d,
	0x6f, 0x73, 0x2f, 0x6d, 0x65, 0x6d, 0x6f, 0x73, 0x2f, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x2f, 0x67,
	0x65, 0x6e, 0x2f, 0x61, 0x70, 0x69, 0x2f, 0x76, 0x31, 0x3b, 0x61, 0x70, 0x69, 0x76, 0x31, 0xa2,
	0x02, 0x03, 0x4d, 0x41, 0x58, 0xaa, 0x02, 0x0c, 0x4d, 0x65, 0x6d, 0x6f, 0x73, 0x2e, 0x41, 0x70,
	0x69, 0x2e, 0x56, 0x31, 0xca, 0x02, 0x0c, 0x4d, 0x65, 0x6d, 0x6f, 0x73, 0x5c, 0x41, 0x70, 0x69,
	0x5c, 0x56, 0x31, 0xe2, 0x02, 0x18, 0x4d, 0x65, 0x6d, 0x6f, 0x73, 0x5c, 0x41, 0x70, 0x69, 0x5c,
	0x56, 0x31, 0x5c, 0x47, 0x50, 0x42, 0x4d, 0x65, 0x74, 0x61, 0x64, 0x61, 0x74, 0x61, 0xea, 0x02,
	0x0e, 0x4d, 0x65, 0x6d, 0x6f, 0x73, 0x3a, 0x3a, 0x41, 0x70, 0x69, 0x3a, 0x3a, 0x56, 0x31, 0x62,
	0x06, 0x70, 0x72, 0x6f, 0x74, 0x6f, 0x33,
}

var (
	file_api_v1_workspace_service_proto_rawDescOnce sync.Once
	file_api_v1_workspace_service_proto_rawDescData = file_api_v1_workspace_service_proto_rawDesc
)

func file_api_v1_workspace_service_proto_rawDescGZIP() []byte {
	file_api_v1_workspace_service_proto_rawDescOnce.Do(func() {
		file_api_v1_workspace_service_proto_rawDescData = protoimpl.X.CompressGZIP(file_api_v1_workspace_service_proto_rawDescData)
	})
	return file_api_v1_workspace_service_proto_rawDescData
}

var file_api_v1_workspace_service_proto_msgTypes = make([]protoimpl.MessageInfo, 2)
var file_api_v1_workspace_service_proto_goTypes = []any{
	(*WorkspaceProfile)(nil),           // 0: memos.api.v1.WorkspaceProfile
	(*GetWorkspaceProfileRequest)(nil), // 1: memos.api.v1.GetWorkspaceProfileRequest
}
var file_api_v1_workspace_service_proto_depIdxs = []int32{
	1, // 0: memos.api.v1.WorkspaceService.GetWorkspaceProfile:input_type -> memos.api.v1.GetWorkspaceProfileRequest
	0, // 1: memos.api.v1.WorkspaceService.GetWorkspaceProfile:output_type -> memos.api.v1.WorkspaceProfile
	1, // [1:2] is the sub-list for method output_type
	0, // [0:1] is the sub-list for method input_type
	0, // [0:0] is the sub-list for extension type_name
	0, // [0:0] is the sub-list for extension extendee
	0, // [0:0] is the sub-list for field type_name
}

func init() { file_api_v1_workspace_service_proto_init() }
func file_api_v1_workspace_service_proto_init() {
	if File_api_v1_workspace_service_proto != nil {
		return
	}
	type x struct{}
	out := protoimpl.TypeBuilder{
		File: protoimpl.DescBuilder{
			GoPackagePath: reflect.TypeOf(x{}).PkgPath(),
			RawDescriptor: file_api_v1_workspace_service_proto_rawDesc,
			NumEnums:      0,
			NumMessages:   2,
			NumExtensions: 0,
			NumServices:   1,
		},
		GoTypes:           file_api_v1_workspace_service_proto_goTypes,
		DependencyIndexes: file_api_v1_workspace_service_proto_depIdxs,
		MessageInfos:      file_api_v1_workspace_service_proto_msgTypes,
	}.Build()
	File_api_v1_workspace_service_proto = out.File
	file_api_v1_workspace_service_proto_rawDesc = nil
	file_api_v1_workspace_service_proto_goTypes = nil
	file_api_v1_workspace_service_proto_depIdxs = nil
}
