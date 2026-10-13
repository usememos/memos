package memogit

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sort"
	"sync/atomic"
	"testing"

	"connectrpc.com/connect"
	"github.com/stretchr/testify/require"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/proto/gen/api/v1/apiv1connect"
)

// subDocListServer serves one listing page of documents and their
// sub-documents, either the way a current server does (sub-documents in the
// listing) or the way an older one does (only through ListMemoComments).
type subDocListServer struct {
	apiv1connect.UnimplementedMemoServiceHandler

	legacy   bool
	docs     []*v1pb.Memo
	subDocs  []*v1pb.Memo
	comments atomic.Int32
}

func (s *subDocListServer) ListMemos(_ context.Context, req *connect.Request[v1pb.ListMemosRequest]) (*connect.Response[v1pb.ListMemosResponse], error) {
	resp := &v1pb.ListMemosResponse{Memos: s.docs}
	if req.Msg.GetIncludeSubDocs() && !s.legacy {
		resp.SubDocs = s.subDocs
		resp.SubDocsIncluded = true
	}
	return connect.NewResponse(resp), nil
}

func (s *subDocListServer) ListMemoComments(_ context.Context, req *connect.Request[v1pb.ListMemoCommentsRequest]) (*connect.Response[v1pb.ListMemoCommentsResponse], error) {
	s.comments.Add(1)
	parentUID := uidFromName(req.Msg.GetName())
	var children []*v1pb.Memo
	for _, sd := range s.subDocs {
		if uid, _ := ParentUIDFromSubDocFolder(sd.GetFolderPath()); uid == parentUID {
			children = append(children, sd)
		}
	}
	return connect.NewResponse(&v1pb.ListMemoCommentsResponse{Memos: children}), nil
}

func TestListInScopeTakesSubDocsFromTheListing(t *testing.T) {
	for _, legacy := range []bool{false, true} {
		name := "current server"
		if legacy {
			name = "server without include_sub_docs"
		}
		t.Run(name, func(t *testing.T) {
			srv := &subDocListServer{
				legacy: legacy,
				docs: []*v1pb.Memo{
					fakeMemo("p1", "Work", "Plan", "x"),
					fakeMemo("p2", "Work/Deep", "Notes", "x"),
					fakeMemo("p3", "Home", "Recipes", "x"),
				},
				subDocs: []*v1pb.Memo{
					fakeMemo("s1", SubDocFolderPath("p1"), "Appendix", "x"),
					fakeMemo("s2", SubDocFolderPath("p2"), "Detail", "x"),
					fakeMemo("s3", SubDocFolderPath("p3"), "Out of scope", "x"),
				},
			}
			mux := http.NewServeMux()
			mux.Handle(apiv1connect.NewMemoServiceHandler(srv))
			hs := httptest.NewServer(mux)
			t.Cleanup(hs.Close)

			client := NewClient(&Config{Server: hs.URL, Token: "memos_pat_test"})
			ws := &WorkspaceConfig{Workspace: "workspaces/w1", Title: "KB", Dir: "KB", Folders: []string{"Work"}}
			docs, subDocs, err := listInScope(context.Background(), client, ws, "")
			require.NoError(t, err)

			require.Equal(t, []string{"p1", "p2"}, memoUIDs(docs))
			require.Equal(t, []string{"s1", "s2"}, memoUIDs(subDocs), "a sub-document is in scope exactly when its parent is")
			if legacy {
				require.EqualValues(t, 2, srv.comments.Load(), "fallback asks each in-scope parent")
			} else {
				require.Zero(t, srv.comments.Load(), "no per-document requests when the listing carries sub-documents")
			}
		})
	}
}

func memoUIDs(memos []*v1pb.Memo) []string {
	uids := make([]string, 0, len(memos))
	for _, m := range memos {
		uids = append(uids, uidFromName(m.GetName()))
	}
	sort.Strings(uids)
	return uids
}
