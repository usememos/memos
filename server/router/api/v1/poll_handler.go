package v1

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/usememos/memos/server/access"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

// maxPollVoteOptions bounds the number of option indexes a single vote
// request may select, guarding against pathological payloads.
const maxPollVoteOptions = 64

type pollRouteRegistrar interface {
	GET(path string, h echo.HandlerFunc, m ...echo.MiddlewareFunc) echo.RouteInfo
	PUT(path string, h echo.HandlerFunc, m ...echo.MiddlewareFunc) echo.RouteInfo
}

// pollVoteDTO is a single vote as returned to the frontend.
type pollVoteDTO struct {
	OptionIndex int32  `json:"optionIndex"`
	Voter       string `json:"voter"`
}

// pollVotesResponse lists all votes for a poll plus which user is asking.
type pollVotesResponse struct {
	Votes            []pollVoteDTO `json:"votes"`
	CurrentVoterName string        `json:"currentVoterName,omitempty"`
}

type setPollVotesRequest struct {
	OptionIndexes []int32 `json:"optionIndexes"`
}

// RegisterPollRoutes registers the poll voting REST endpoints. Poll
// definitions (question/options/type) are not backend resources - they are
// embedded directly in memo Markdown content - so these endpoints persist
// only the votes for a given poll UID. Every route is nested under the
// owning memo so access can be authorized the same way any other read of
// that memo would be (visibility, creator, space membership), and so the
// poll UID can be bound to that one memo (see store.EnsurePollBinding).
func RegisterPollRoutes(router pollRouteRegistrar, storeInstance *store.Store, secret string) {
	authenticator := auth.NewAuthenticator(storeInstance, secret)

	router.GET("/api/v1/memos/:memoUid/polls/:pollUid/votes", func(c *echo.Context) error {
		return handleListPollVotes(c, storeInstance, authenticator)
	})
	router.PUT("/api/v1/memos/:memoUid/polls/:pollUid/votes", func(c *echo.Context) error {
		return handleSetPollVotes(c, storeInstance, authenticator)
	})
}

// pollAccessError carries an HTTP status alongside a client-facing message,
// so resolvePollAccess can be a single choke point for every way a poll
// request can be rejected.
type pollAccessError struct {
	status  int
	message string
}

func (e *pollAccessError) Error() string { return e.message }

func pollError(status int, message string) *pollAccessError {
	return &pollAccessError{status: status, message: message}
}

func writePollError(c *echo.Context, err error) error {
	var accessErr *pollAccessError
	if errors.As(err, &accessErr) {
		return c.JSON(accessErr.status, map[string]string{"error": accessErr.message})
	}
	return c.JSON(http.StatusInternalServerError, map[string]string{"error": "internal error"})
}

// resolvePollAccess authenticates the caller, loads and authorizes the memo
// named by the :memoUid path param exactly as any other memo read would be,
// locates the ```poll block matching :pollUid in that memo's current
// content, and establishes (or validates) its poll/memo/definition binding.
// A non-nil *pollAccessError return is always safe to hand to writePollError.
func resolvePollAccess(c *echo.Context, storeInstance *store.Store, authenticator *auth.Authenticator) (*store.Memo, *store.User, *pollDefinition, error) {
	ctx := c.Request().Context()

	memoUID := c.Param("memoUid")
	if memoUID == "" {
		return nil, nil, nil, pollError(http.StatusBadRequest, "memo uid is required")
	}
	pollUID := c.Param("pollUid")
	if !pollUIDPattern.MatchString(pollUID) {
		return nil, nil, nil, pollError(http.StatusBadRequest, "invalid poll uid")
	}

	user, err := authenticator.AuthenticateToUser(ctx, c.Request().Header.Get("Authorization"), c.Request().Header.Get("Cookie"))
	if err != nil {
		return nil, nil, nil, pollError(http.StatusUnauthorized, "authentication failed")
	}

	memo, err := storeInstance.GetMemo(ctx, &store.FindMemo{UID: &memoUID})
	if err != nil {
		return nil, nil, nil, pollError(http.StatusInternalServerError, "failed to load memo")
	}
	if memo == nil {
		return nil, nil, nil, pollError(http.StatusNotFound, "memo not found")
	}

	allowAnonymous := false
	if user == nil {
		allowAnonymous, err = storeInstance.AllowsAnonymousAccess(ctx)
		if err != nil {
			return nil, nil, nil, pollError(http.StatusInternalServerError, "failed to resolve instance access policy")
		}
	}
	readContext, err := access.ResolveMemoReadContext(ctx, storeInstance, memo, user, allowAnonymous, nil)
	if err != nil {
		return nil, nil, nil, pollError(http.StatusInternalServerError, "failed to resolve memo access")
	}
	if decision := access.CheckMemoReadContext(readContext); !decision.Allowed() {
		return nil, nil, nil, pollAccessDenialError(decision.Denial)
	}

	def := findPollDefinitionInContent(memo.Content, pollUID)
	if def == nil {
		return nil, nil, nil, pollError(http.StatusNotFound, "poll not found in memo")
	}

	if _, err := storeInstance.EnsurePollBinding(ctx, pollUID, memo.ID, pollDefinitionHash(def)); err != nil {
		if errors.Is(err, store.ErrPollMemoMismatch) {
			return nil, nil, nil, pollError(http.StatusConflict, "poll uid is already used by a different memo")
		}
		return nil, nil, nil, pollError(http.StatusInternalServerError, "failed to bind poll")
	}

	return memo, user, def, nil
}

func pollAccessDenialError(denial access.MemoReadDenial) error {
	switch denial {
	case access.MemoReadDenialNotFound:
		return pollError(http.StatusNotFound, "memo not found")
	case access.MemoReadDenialUnauthenticated:
		return pollError(http.StatusUnauthorized, "authentication required")
	default:
		return pollError(http.StatusForbidden, "permission denied")
	}
}

func handleListPollVotes(c *echo.Context, storeInstance *store.Store, authenticator *auth.Authenticator) error {
	_, user, def, err := resolvePollAccess(c, storeInstance, authenticator)
	if err != nil {
		return writePollError(c, err)
	}

	ctx := c.Request().Context()
	votes, err := storeInstance.ListPollVotes(ctx, def.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to list poll votes"})
	}

	response, err := buildPollVotesResponse(ctx, storeInstance, votes, user)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to resolve voters"})
	}
	return c.JSON(http.StatusOK, response)
}

func handleSetPollVotes(c *echo.Context, storeInstance *store.Store, authenticator *auth.Authenticator) error {
	memo, user, def, err := resolvePollAccess(c, storeInstance, authenticator)
	if err != nil {
		return writePollError(c, err)
	}
	if user == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "authentication required"})
	}

	var request setPollVotesRequest
	if err := json.NewDecoder(c.Request().Body).Decode(&request); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}
	if len(request.OptionIndexes) > maxPollVoteOptions {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "too many selected options"})
	}
	for _, optionIndex := range request.OptionIndexes {
		if optionIndex < 0 || int(optionIndex) >= len(def.Options) {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "option index out of range"})
		}
	}

	ctx := c.Request().Context()
	votes, err := storeInstance.SetPollVotes(ctx, def.ID, memo.ID, user.ID, request.OptionIndexes)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to save poll votes"})
	}

	response, err := buildPollVotesResponse(ctx, storeInstance, votes, user)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to resolve voters"})
	}
	return c.JSON(http.StatusOK, response)
}

// buildPollVotesResponse resolves each vote's numeric voter ID to the
// username-based public resource name (BuildUserName), matching the
// "users/{username}" format every other endpoint uses for User.name - not
// "users/{id}" - so the frontend's currentUser.name comparison used to
// highlight the caller's own selection actually matches.
func buildPollVotesResponse(ctx context.Context, storeInstance *store.Store, votes []*store.PollVote, currentUser *store.User) (pollVotesResponse, error) {
	response := pollVotesResponse{Votes: make([]pollVoteDTO, 0, len(votes))}

	voterIDSet := make(map[int32]struct{}, len(votes))
	for _, vote := range votes {
		voterIDSet[vote.VoterID] = struct{}{}
	}
	voterIDList := make([]int32, 0, len(voterIDSet))
	for voterID := range voterIDSet {
		voterIDList = append(voterIDList, voterID)
	}

	usernameByID := make(map[int32]string, len(voterIDList))
	if currentUser != nil {
		usernameByID[currentUser.ID] = currentUser.Username
	}
	missingIDList := make([]int32, 0, len(voterIDList))
	for _, voterID := range voterIDList {
		if _, ok := usernameByID[voterID]; !ok {
			missingIDList = append(missingIDList, voterID)
		}
	}
	if len(missingIDList) > 0 {
		voters, err := storeInstance.ListUsers(ctx, &store.FindUser{IDList: missingIDList})
		if err != nil {
			return response, err
		}
		for _, voter := range voters {
			usernameByID[voter.ID] = voter.Username
		}
	}

	for _, vote := range votes {
		username, ok := usernameByID[vote.VoterID]
		if !ok {
			// The voter's account no longer resolves (e.g. deleted); omit the
			// name rather than emitting an incorrect resource reference.
			continue
		}
		response.Votes = append(response.Votes, pollVoteDTO{
			OptionIndex: vote.OptionIndex,
			Voter:       BuildUserName(username),
		})
	}
	if currentUser != nil {
		response.CurrentVoterName = BuildUserName(currentUser.Username)
	}
	return response, nil
}
