package test

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/usememos/memos/internal/profile"
	"github.com/usememos/memos/internal/version"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/server/auth"
	apiv1 "github.com/usememos/memos/server/router/api/v1"
	"github.com/usememos/memos/store"
	"github.com/usememos/memos/store/db"
)

const (
	benchmarkTopLevelMemoCount = 5000
	benchmarkPageSize          = 16
)

type benchmarkService struct {
	*TestService
	hostUser          *store.User
	authenticatedCtx  context.Context
	publicCtx         context.Context
	pageTenToken      string
	commentParentName string
}

func newBenchmarkService(tb testing.TB) *benchmarkService {
	tb.Helper()

	ctx := context.Background()
	testService := newTestingServiceForTB(tb)

	hostUser, err := testService.CreateHostUser(ctx, "bench-host")
	if err != nil {
		tb.Fatalf("failed to create host user: %v", err)
	}

	commentParentName, err := seedListMemosBenchmarkData(ctx, testService.Store, hostUser)
	if err != nil {
		tb.Fatalf("failed to seed benchmark data: %v", err)
	}

	authenticatedCtx := context.WithValue(context.Background(), auth.UserIDContextKey, hostUser.ID)
	pageTenToken, err := getListMemosPageToken(authenticatedCtx, testService.Service, 10, benchmarkPageSize)
	if err != nil {
		tb.Fatalf("failed to build page token: %v", err)
	}

	return &benchmarkService{
		TestService:       testService,
		hostUser:          hostUser,
		authenticatedCtx:  authenticatedCtx,
		publicCtx:         context.Background(),
		pageTenToken:      pageTenToken,
		commentParentName: commentParentName,
	}
}

func newTestingServiceForTB(tb testing.TB) *TestService {
	tb.Helper()

	ctx := context.Background()
	dataDir := tb.TempDir()
	testProfile := getBenchmarkProfile(dataDir)
	dbDriver, err := db.NewDBDriver(testProfile)
	if err != nil {
		tb.Fatalf("failed to create db driver: %v", err)
	}

	testStore := store.New(dbDriver, testProfile)
	if err := testStore.Migrate(ctx); err != nil {
		tb.Fatalf("failed to migrate db: %v", err)
	}
	tb.Cleanup(func() {
		testStore.Close()
	})

	service := newServiceWithProfile(testProfile, testStore)
	return &TestService{
		Service: service,
		Store:   testStore,
		Profile: testProfile,
		Secret:  service.Secret,
	}
}

func getBenchmarkProfile(dataDir string) *profile.Profile {
	return &profile.Profile{
		Demo:        true,
		Version:     version.GetCurrentVersion(),
		InstanceURL: "http://localhost:8080",
		Driver:      "sqlite",
		DSN:         filepath.Join(dataDir, "bench.db"),
		Data:        dataDir,
	}
}

func newServiceWithProfile(testProfile *profile.Profile, testStore *store.Store) *apiv1.APIV1Service {
	service := apiv1.NewAPIV1Service("bench-secret", testProfile, testStore)
	return service
}

func seedListMemosBenchmarkData(ctx context.Context, stores *store.Store, hostUser *store.User) (string, error) {
	topLevelMemos := make([]*store.Memo, 0, benchmarkTopLevelMemoCount)
	commentParentName := ""

	for i := 0; i < benchmarkTopLevelMemoCount; i++ {
		visibility := store.Private
		if i%4 == 0 {
			visibility = store.Public
		}
		memo, err := stores.CreateMemo(ctx, &store.Memo{
			UID:        fmt.Sprintf("memo-%06d", i),
			CreatorID:  hostUser.ID,
			Content:    benchmarkMemoContent(i),
			Visibility: visibility,
		})
		if err != nil {
			return "", err
		}
		topLevelMemos = append(topLevelMemos, memo)

		if i%3 == 0 {
			if _, err := stores.CreateAttachment(ctx, &store.Attachment{
				UID:       fmt.Sprintf("att-%06d", i),
				CreatorID: hostUser.ID,
				Filename:  fmt.Sprintf("memo-%06d.png", i),
				Type:      "image/png",
				Size:      2048,
				MemoID:    &memo.ID,
			}); err != nil {
				return "", err
			}
		}

		if i%5 == 0 {
			if _, err := stores.UpsertReaction(ctx, &store.Reaction{
				CreatorID:    hostUser.ID,
				ContentID:    "memos/" + memo.UID,
				ReactionType: "thumbs-up",
			}); err != nil {
				return "", err
			}
		}
	}

	for i, memo := range topLevelMemos {
		if i+1 < len(topLevelMemos) && i%4 == 0 {
			if _, err := stores.UpsertMemoRelation(ctx, &store.MemoRelation{
				MemoID:        memo.ID,
				RelatedMemoID: topLevelMemos[i+1].ID,
				Type:          store.MemoRelationReference,
			}); err != nil {
				return "", err
			}
		}

		if i%6 == 0 {
			commentMemo, err := stores.CreateMemo(ctx, &store.Memo{
				UID:        fmt.Sprintf("comment-%06d", i),
				CreatorID:  hostUser.ID,
				Content:    fmt.Sprintf("Comment for memo %06d", i),
				Visibility: store.Private,
			})
			if err != nil {
				return "", err
			}
			if _, err := stores.UpsertMemoRelation(ctx, &store.MemoRelation{
				MemoID:        commentMemo.ID,
				RelatedMemoID: memo.ID,
				Type:          store.MemoRelationComment,
			}); err != nil {
				return "", err
			}
			if commentParentName == "" {
				commentParentName = "memos/" + memo.UID
			}
		}
	}

	return commentParentName, nil
}

func benchmarkMemoContent(i int) string {
	return fmt.Sprintf("# Bench Memo %06d\n\nThis is benchmark memo %06d with enough content to exercise snippet generation.\n\n- task one\n- task two\n", i, i)
}

func getListMemosPageToken(ctx context.Context, service *apiv1.APIV1Service, page int, pageSize int32) (string, error) {
	pageToken := ""
	for range page - 1 {
		resp, err := service.ListMemos(ctx, &v1pb.ListMemosRequest{
			PageSize:  pageSize,
			PageToken: pageToken,
		})
		if err != nil {
			return "", err
		}
		pageToken = resp.NextPageToken
		if pageToken == "" {
			break
		}
	}
	return pageToken, nil
}

func BenchmarkListMemos(b *testing.B) {
	bench := newBenchmarkService(b)

	b.Run("authenticated_first_page", func(b *testing.B) {
		req := &v1pb.ListMemosRequest{PageSize: benchmarkPageSize}
		b.ReportAllocs()
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			resp, err := bench.Service.ListMemos(bench.authenticatedCtx, req)
			if err != nil {
				b.Fatalf("ListMemos failed: %v", err)
			}
			if len(resp.Memos) == 0 {
				b.Fatal("expected memos in authenticated benchmark response")
			}
		}
	})

	b.Run("authenticated_page_ten", func(b *testing.B) {
		req := &v1pb.ListMemosRequest{PageSize: benchmarkPageSize, PageToken: bench.pageTenToken}
		b.ReportAllocs()
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			resp, err := bench.Service.ListMemos(bench.authenticatedCtx, req)
			if err != nil {
				b.Fatalf("ListMemos failed: %v", err)
			}
			if len(resp.Memos) == 0 {
				b.Fatal("expected memos in paged benchmark response")
			}
		}
	})

	b.Run("public_first_page", func(b *testing.B) {
		req := &v1pb.ListMemosRequest{PageSize: benchmarkPageSize}
		b.ReportAllocs()
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			resp, err := bench.Service.ListMemos(bench.publicCtx, req)
			if err != nil {
				b.Fatalf("ListMemos failed: %v", err)
			}
			if len(resp.Memos) == 0 {
				b.Fatal("expected memos in public benchmark response")
			}
		}
	})
}

func BenchmarkListMemoCommentsPreview(b *testing.B) {
	bench := newBenchmarkService(b)
	if bench.commentParentName == "" {
		b.Fatal("expected seeded memo with comments")
	}

	req := &v1pb.ListMemoCommentsRequest{
		Name:     bench.commentParentName,
		PageSize: 3,
	}

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resp, err := bench.Service.ListMemoComments(bench.authenticatedCtx, req)
		if err != nil {
			b.Fatalf("ListMemoComments failed: %v", err)
		}
		if len(resp.Memos) == 0 {
			b.Fatal("expected comments in benchmark response")
		}
	}
}
