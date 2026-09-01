package v1

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"

	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

var (
	errPollUIDRequired = errors.New("poll uid is required")
	errPollUIDTooLong  = errors.New("poll uid is too long")
)

// maxPollVoteOptions bounds the number of option indexes a single vote
// request may select, guarding against pathological payloads.
const maxPollVoteOptions = 64

// maxPollUIDLength bounds the poll UID path segment.
const maxPollUIDLength = 100

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
// embedded directly in memo Markdown content - so these endpoints only
// persist and serve the votes for a given client-generated poll UID.
func RegisterPollRoutes(router pollRouteRegistrar, storeInstance *store.Store, secret string) {
	authenticator := auth.NewAuthenticator(storeInstance, secret)

	router.GET("/api/v1/polls/:pollUid/votes", func(c *echo.Context) error {
		return handleListPollVotes(c, storeInstance, authenticator)
	})
	router.PUT("/api/v1/polls/:pollUid/votes", func(c *echo.Context) error {
		return handleSetPollVotes(c, storeInstance, authenticator)
	})
}

func handleListPollVotes(c *echo.Context, storeInstance *store.Store, authenticator *auth.Authenticator) error {
	pollUID, err := validatePollUID(c.Param("pollUid"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	ctx := c.Request().Context()
	user, err := authenticator.AuthenticateToUser(ctx, c.Request().Header.Get("Authorization"), c.Request().Header.Get("Cookie"))
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "authentication failed"})
	}

	votes, err := storeInstance.ListPollVotes(ctx, pollUID)
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
	pollUID, err := validatePollUID(c.Param("pollUid"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	ctx := c.Request().Context()
	user, err := authenticator.AuthenticateToUser(ctx, c.Request().Header.Get("Authorization"), c.Request().Header.Get("Cookie"))
	if err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "authentication failed"})
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
		if optionIndex < 0 {
			return c.JSON(http.StatusBadRequest, map[string]string{"error": "option index must not be negative"})
		}
	}

	votes, err := storeInstance.SetPollVotes(ctx, pollUID, user.ID, request.OptionIndexes)
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
// username-based public resource name (BuildUserName), matching the "users/{username}"
// format every other endpoint uses for User.name - not "users/{id}" - so the
// frontend's currentUser.name comparison used to highlight the caller's own
// selection actually matches.
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

func validatePollUID(pollUID string) (string, error) {
	if pollUID == "" {
		return "", errPollUIDRequired
	}
	if len(pollUID) > maxPollUIDLength {
		return "", errPollUIDTooLong
	}
	return pollUID, nil
}
