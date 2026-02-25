package v1

import (
	"context"
	"fmt"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/usememos/memos/plugin/ai"
	v1pb "github.com/usememos/memos/proto/gen/api/v1"
	"github.com/usememos/memos/store"
)

func (s *APIV1Service) GenerateInsight(ctx context.Context, request *v1pb.GenerateInsightRequest) (*v1pb.GenerateInsightResponse, error) {
	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	aiConfig, err := s.Store.GetInstanceAIConfigSetting(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get AI config")
	}
	if !aiConfig.Enabled {
		return nil, status.Errorf(codes.FailedPrecondition, "AI features are not enabled")
	}
	if aiConfig.ApiKey == "" {
		return nil, status.Errorf(codes.FailedPrecondition, "AI API key is not configured")
	}

	if len(request.MemoNames) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "at least one memo name is required")
	}

	var memoContents []string
	for _, memoName := range request.MemoNames {
		memoUID, err := ExtractMemoUIDFromName(memoName)
		if err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "invalid memo name: %s", memoName)
		}
		memos, err := s.Store.ListMemos(ctx, &store.FindMemo{
			UID:       &memoUID,
			CreatorID: &user.ID,
		})
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to get memo")
		}
		if len(memos) == 0 {
			continue
		}
		memoContents = append(memoContents, memos[0].Content)
	}

	if len(memoContents) == 0 {
		return nil, status.Errorf(codes.InvalidArgument, "no valid memos found")
	}

	perspectives := []struct {
		Name   string
		Prompt string
	}{
		{"批判思维导师", "你是一位犀利的批判思维导师。你善于发现思维中的盲点、矛盾和未被质疑的假设。你的语气直接但不刻薄，像一个严格但关心学生的教授。"},
		{"心理洞察伙伴", "你是一位温暖且富有洞察力的心理顾问。你善于从文字中发现情绪模式、内在需求和深层动机。你的语气温柔但精准，像一面能映照内心的镜子。"},
		{"创意联想者", "你是一位充满好奇心的创意思考者。你善于在看似无关的事物间发现隐藏的联系，用类比和隐喻激发新的思考角度。你的语气轻松但深刻。"},
		{"系统思考者", "你是一位系统思维专家。你善于从碎片信息中识别出模式、循环和因果关系。你关注全局结构而非单个事件，帮助人看到「森林」而非「树木」。"},
		{"苏格拉底式提问者", "你是一位善于提问的苏格拉底式导师。你几乎不给答案，而是通过精心设计的问题引导人自己发现盲点和可能性。每个问题都指向更深的思考层次。"},
	}

	perspIdx := 0
	for _, c := range strings.Join(memoContents, "") {
		perspIdx = (perspIdx + int(c)) % len(perspectives)
	}
	perspective := perspectives[perspIdx]

	systemPrompt := fmt.Sprintf(`%s

你的任务是深度阅读用户的一组笔记，生成一份洞察报告。

要求：
1. **识别核心主题**：这些笔记整体在探讨什么？
2. **揭示思维模式**：用户可能没有意识到的重复模式、隐含假设或思维盲点
3. **提出深刻问题**：3-5个能激发更深思考的问题（不是行动建议）

格式要求：
- 使用 Markdown 格式
- 开头用一句话概括核心发现
- 正文 300-500 字
- 结尾列出启发性问题
- 语言：与笔记使用的语言保持一致

重要原则：
- 不要总结笔记内容，要提供笔记之上的「元认知」
- 不要给行动建议，要帮用户「发现更好的问题」
- 保持诚实和犀利，不要讨好用户`, perspective.Prompt)

	userContent := "以下是我的笔记，请帮我生成洞察：\n\n"
	for i, content := range memoContents {
		userContent += fmt.Sprintf("--- 笔记 %d ---\n%s\n\n", i+1, content)
	}

	client := ai.NewClient(ai.Config{
		APIKey:     aiConfig.ApiKey,
		APIBaseURL: aiConfig.ApiBaseUrl,
		Model:      aiConfig.Model,
	})

	insight, err := client.GenerateCompletion(ctx, []ai.ChatMessage{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: userContent},
	})
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate insight: %v", err)
	}

	return &v1pb.GenerateInsightResponse{
		Insight: insight,
	}, nil
}
