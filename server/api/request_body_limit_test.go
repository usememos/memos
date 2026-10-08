package api

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// Only procedures that carry file bytes inline keep the large body cap; every
// other request is bounded by the general cap so buffered bodies cannot be
// used to exhaust memory.
func TestRequestBodyLimitPerProcedure(t *testing.T) {
	require.EqualValues(t, uploadRequestLimit, requestBodyLimit(attachmentUploadProcedure))
	require.EqualValues(t, uploadRequestLimit, requestBodyLimit(importMemosProcedure))
	require.EqualValues(t, MaxAPIRequestBytes, requestBodyLimit("/memos.api.AttachmentService/CreateAttachment"))
	require.EqualValues(t, MaxAPIRequestBytes, requestBodyLimit("/memos.api.AIService/Transcribe"))
	for _, procedure := range []string{
		"/memos.api.AuthService/SignIn",
		"/memos.api.UserService/CreateUser",
		"/memos.api.MemoService/CreateMemo",
		"/memos.api.MemoService/ListMemos",
	} {
		require.EqualValues(t, maxGeneralRequestBytes, requestBodyLimit(procedure), procedure)
	}
	require.Less(t, int64(maxGeneralRequestBytes), int64(MaxAPIRequestBytes))
}
