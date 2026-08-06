package v1

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/types/known/timestamppb"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

// TestGatewayMarshalerOmitsUnsetMessageFields pins the REST payload shape the
// generated OpenAPI schema describes. grpc-gateway's stock marshaler writes
// `"motionMedia": null` for a plain image attachment, which no schema declares
// as nullable, and clients that validate against the spec — including strict
// MCP clients, whose tool outputSchema is that same schema — reject the
// response outright.
func TestGatewayMarshalerOmitsUnsetMessageFields(t *testing.T) {
	attachment := &v1pb.Attachment{
		Name:       "attachments/plainimage1",
		CreateTime: timestamppb.New(time.Unix(1700000000, 0).UTC()),
		Filename:   "sunset.png",
		Type:       "image/png",
	}

	payload := marshalThroughGateway(t, attachment)

	require.NotContains(t, payload, "motionMedia", "an unset message field must be omitted, not emitted as null")
	// Scalar defaults stay in the payload: the schema lists filename and type as
	// required, so dropping unpopulated scalars would break validation instead.
	require.Equal(t, "", payload["externalLink"])
	require.Equal(t, "sunset.png", payload["filename"])
	require.Equal(t, "image/png", payload["type"])
	require.Equal(t, "0", payload["size"])
}

func TestGatewayMarshalerKeepsPopulatedMessageFields(t *testing.T) {
	attachment := &v1pb.Attachment{
		Name:     "attachments/livephoto1",
		Filename: "walk.heic",
		Type:     "image/heic",
		MotionMedia: &v1pb.MotionMedia{
			Family:  v1pb.MotionMediaFamily_APPLE_LIVE_PHOTO,
			Role:    v1pb.MotionMediaRole_STILL,
			GroupId: "group1",
		},
	}

	payload := marshalThroughGateway(t, attachment)

	motionMedia, ok := payload["motionMedia"].(map[string]any)
	require.True(t, ok, "a populated message field must still be emitted: %v", payload["motionMedia"])
	require.Equal(t, "APPLE_LIVE_PHOTO", motionMedia["family"])
	require.Equal(t, "group1", motionMedia["groupId"])
}

// TestGatewayMarshalerKeepsEmptyCollections guards the other half of the
// default-value behaviour: list fields the schema types as arrays must not
// disappear when empty.
func TestGatewayMarshalerKeepsEmptyCollections(t *testing.T) {
	memo := &v1pb.Memo{
		Name:       "memos/plainmemo1",
		Content:    "",
		State:      v1pb.State_NORMAL,
		Visibility: v1pb.Visibility_PRIVATE,
	}

	payload := marshalThroughGateway(t, memo)

	require.Equal(t, []any{}, payload["attachments"])
	require.Equal(t, []any{}, payload["relations"])
	require.Equal(t, "", payload["content"])
	require.Equal(t, false, payload["pinned"])
	// location is `optional` in the proto, so it is already omitted rather than
	// null; property has no such marker and would otherwise be null here.
	require.NotContains(t, payload, "location")
	require.NotContains(t, payload, "property")
}

func marshalThroughGateway(t *testing.T, message any) map[string]any {
	t.Helper()

	data, err := newGatewayMarshaler().Marshal(message)
	require.NoError(t, err)

	payload := map[string]any{}
	require.NoError(t, json.Unmarshal(data, &payload))
	return payload
}
